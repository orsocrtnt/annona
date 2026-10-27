import { Prisma } from "@prisma/client";
import { prisma } from "@/services/prisma/client";
import { authorizedOrder, conversationScope, ConversationError, isConversationStaff, transaction, type ConversationActor } from "@/domains/order-conversation/order-conversation.service";
import { enqueueOperationJob } from "@/domains/operations/operation-job.service";
import { alertActionKey, deriveOperationalAlerts, describeAlertTarget } from "@/domains/operational-alerts/operational-alerts.policy";

export function canActOnOperationalAlerts(actor: ConversationActor) {
  return isConversationStaff(actor) && actor.permissions.some(p => ["orders:update", "deliveries:update", "deliveries:dispatch"].includes(p));
}
async function alertsForOrder(tx: Prisma.TransactionClient, actor: ConversationActor, order: Awaited<ReturnType<typeof authorizedOrder>>) {
  const messages = await tx.orderMessage.findMany({ where: { orderId: order.id, ...(!isConversationStaff(actor) ? { internal: false } : {}), OR: [{ kind: "INCIDENT" }, { requestKey: { startsWith: "alert1:" } }] }, orderBy: [{ createdAt: "asc" }, { id: "asc" }], select: { id: true, requestKey: true, kind: true, internal: true, body: true, authorName: true, createdAt: true } });
  // Les clés réservées sont utilisées seulement côté serveur, jamais exposées.
  return deriveOperationalAlerts(order, messages, canActOnOperationalAlerts(actor), new Date(), actor.role === "DRIVER" ? actor.id : undefined).map(row => ({ ...row, acknowledged: row.acknowledged ? { body: row.acknowledged.body, authorName: row.acknowledged.authorName, createdAt: row.acknowledged.createdAt } : null, resolution: row.resolution ? { body: row.resolution.body, authorName: row.resolution.authorName, createdAt: row.resolution.createdAt } : null }));
}
export async function getOrderOperationalAlerts(actor: ConversationActor, id: string) {
  return transaction(async tx => alertsForOrder(tx, actor, await authorizedOrder(tx, actor, id)));
}
export async function listOperationalAlerts(actor: ConversationActor) {
  const scope = conversationScope(actor);
  // Liste explicite bornée ; les dossiers plus anciens restent consultables individuellement.
  const orders = await prisma.order.findMany({ where: { AND: [scope, { status: { not: "CANCELLED" }, deliveries: { some: { status: { in: ["PENDING", "ASSIGNED", "PURCHASING", "IN_DELIVERY"] }, completedAt: null, ...(actor.role === "DRIVER" ? { driverId: actor.id } : {}) } } }, { OR: [{ requestedDeliveryDate: { lt: new Date() }, deliveries: { some: { status: { in: ["PENDING", "ASSIGNED", "PURCHASING", "IN_DELIVERY"] }, completedAt: null } } }, { messages: { some: { kind: "INCIDENT", ...(!isConversationStaff(actor) ? { internal: false } : {}) } } }] }] }, include: { customer: { select: { firstName: true, lastName: true } }, deliveries: { select: { id: true, reference: true, driverId: true, status: true, completedAt: true, address: true, city: true } }, messages: { where: { ...(!isConversationStaff(actor) ? { internal: false } : {}), OR: [{ kind: "INCIDENT" }, { requestKey: { startsWith: "alert1:" } }] }, orderBy: [{ createdAt: "asc" }, { id: "asc" }], select: { id: true, requestKey: true, kind: true, internal: true, body: true, authorName: true, createdAt: true } } }, orderBy: [{ updatedAt: "desc" }, { id: "desc" }], take: 101 });
  return { alerts: orders.slice(0, 100).flatMap(order => deriveOperationalAlerts(order, order.messages, canActOnOperationalAlerts(actor), new Date(), actor.role === "DRIVER" ? actor.id : undefined).map(row => ({ ...row, ...describeAlertTarget(order, row.deliveryId) }))).filter(row => ["OPEN", "ACKNOWLEDGED"].includes(row.state)).map(row => ({ id: row.id, orderId: row.orderId, deliveryId: row.deliveryId, reference: row.reference, title: row.title, state: row.state, internal: row.internal, deadline: row.deadline, customerName: row.customerName, place: row.place })), hasMore: orders.length > 100 };
}
export async function actOnOperationalAlert(actor: ConversationActor, orderId: string, input: { alertId: string; action: "ack" | "resolve"; note: string }) {
  if (!canActOnOperationalAlerts(actor)) throw new ConversationError(403, "Seule l’équipe habilitée peut traiter une alerte.");
  return transaction(async tx => {
    const order = await authorizedOrder(tx, actor, orderId);
    // Même ordre de verrouillage que mutations livraison : livraisons puis commande.
    // Tri stable pour deux actions sur une commande multi-livraisons.
    for (const delivery of [...order.deliveries].sort((a, b) => a.id.localeCompare(b.id))) {
      const claim = await tx.delivery.updateMany({ where: { id: delivery.id, companyId: actor.companyId!, updatedAt: delivery.updatedAt }, data: { updatedAt: delivery.updatedAt } });
      if (claim.count !== 1) throw new ConversationError(409, "La mission a changé. Actualisez les alertes.");
    }
    const orderClaim = await tx.order.updateMany({ where: { id: order.id, companyId: actor.companyId!, updatedAt: order.updatedAt }, data: { updatedAt: order.updatedAt } });
    if (orderClaim.count !== 1) throw new ConversationError(409, "La commande a changé. Actualisez les alertes.");
    const row = (await alertsForOrder(tx, actor, order)).find(a => a.id === input.alertId);
    if (!row) throw new ConversationError(404, "Alerte introuvable ou échéance modifiée.");
    const key = alertActionKey(row.id, input.action);
    const existing = await tx.orderMessage.findFirst({ where: { orderId, requestKey: key } });
    if (existing) return { messageId: existing.id, jobId: null, replay: true };
    if (!row.canAct) throw new ConversationError(409, "Alerte déjà résolue ou mission terminée.");
    if (input.action === "resolve" && !row.acknowledged) throw new ConversationError(409, "Prenez en compte l’alerte avant de la résoudre.");
    const latest = await tx.orderMessage.findFirst({ where: { orderId }, orderBy: [{ createdAt: "desc" }, { id: "desc" }] });
    const message = await tx.orderMessage.create({ data: { orderId, authorId: actor.id, authorName: actor.name, authorRole: actor.role, kind: "INSTRUCTION", internal: row.internal, requestKey: key, body: `${row.title} — ${input.action === "ack" ? "Prise en compte" : "Résolution"} : ${input.note}`, createdAt: new Date(Math.max(Date.now(), latest ? +latest.createdAt + 1 : 0)) } });
    const job = await enqueueOperationJob(tx, { jobKey: `order-message:${message.id}`, companyId: order.companyId, type: "CLIENT_NOTIFICATION", payload: { kind: "ORDER_MESSAGE", messageId: message.id } });
    return { messageId: message.id, jobId: job.id, replay: false };
  });
}
