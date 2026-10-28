import { createHash } from "node:crypto";
import { Prisma, type SystemRole } from "@prisma/client";
import { prisma } from "@/services/prisma/client";
import { STAFF_ROLES } from "@/lib/permissions/rbac";
import { filterMiniAdminPermissions } from "@/lib/permissions/mini-admin";
import { enqueueOperationJob } from "@/domains/operations/operation-job.service";
import { clientAuthorName } from "@/domains/delivery/client-driver";

export type ConversationActor = { id: string; companyId: string | null; role: SystemRole; permissions: string[]; name: string };
export type MessageInput = { body: string; kind: string; internal: boolean; requestKey: string };
export class ConversationError extends Error {
  constructor(public status: number, message: string) { super(message); this.name = "ConversationError"; }
}
export function isConversationStaff(actor: ConversationActor) { return STAFF_ROLES.includes(actor.role); }
export function conversationScope(actor: ConversationActor): Prisma.OrderWhereInput {
  if (!actor.companyId) throw new ConversationError(403, "Entreprise non associée.");
  if (actor.role === "CLIENT" && actor.permissions.includes("dashboard:client")) return { companyId: actor.companyId, customerId: actor.id };
  if (actor.role === "DRIVER" && actor.permissions.includes("dashboard:driver")) return { companyId: actor.companyId, deliveries: { some: { companyId: actor.companyId, driverId: actor.id } } };
  if (isConversationStaff(actor) && actor.permissions.some(p => ["orders:read", "deliveries:read"].includes(p))) return { companyId: actor.companyId };
  throw new ConversationError(403, "Accès aux échanges refusé.");
}
const includeOrder = { deliveries: { select: { id: true, reference: true, companyId: true, driverId: true, updatedAt: true, status: true, completedAt: true } } } satisfies Prisma.OrderInclude;
const terminal = new Set(["DELIVERED", "FAILED", "CANCELLED", "INVOICED", "PAID"]);
export function conversationClosed(order: { status: string; deliveries: { status: string; completedAt: Date | null }[] }) {
  return order.status === "CANCELLED" || (order.deliveries.length > 0
    ? order.deliveries.every(d => Boolean(d.completedAt) || terminal.has(d.status))
    : terminal.has(order.status));
}
function canWrite(actor: ConversationActor) { return !isConversationStaff(actor) || actor.permissions.some(p => ["orders:update", "deliveries:update", "deliveries:dispatch"].includes(p)); }
function visible(actor: ConversationActor): Prisma.OrderMessageWhereInput { return isConversationStaff(actor) ? {} : { internal: false }; }
function after(seen?: { seenAt: Date; seenId: string } | null): Prisma.OrderMessageWhereInput {
  return seen ? { OR: [{ createdAt: { gt: seen.seenAt } }, { createdAt: seen.seenAt, id: { gt: seen.seenId } }] } : {};
}
export async function transaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try { return await prisma.$transaction(fn, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 10_000, timeout: 30_000 }); }
    catch (e) { if (attempt < 3 && e instanceof Prisma.PrismaClientKnownRequestError && ["P2034", "P2002"].includes(e.code)) continue; throw e; }
  }
}
export async function authorizedOrder(tx: Prisma.TransactionClient, actor: ConversationActor, orderId: string, lock = false) {
  const scope = conversationScope(actor);
  const order = await tx.order.findFirst({ where: { id: orderId, ...scope }, include: includeOrder });
  if (!order) throw new ConversationError(404, "Commande introuvable.");
  if (lock) {
    // Verrou partagé avec changements de commande, sans altérer la version métier.
    const claim = await tx.order.updateMany({ where: { id: order.id, companyId: actor.companyId!, updatedAt: order.updatedAt }, data: { updatedAt: order.updatedAt } });
    if (claim.count !== 1) throw new ConversationError(409, "La commande a changé. Actualisez les échanges.");
    // Le verrou de la livraison sérialise l'envoi avec une réaffectation concurrente.
    if (actor.role === "DRIVER") {
      const delivery = order.deliveries.find(d => d.driverId === actor.id && d.companyId === actor.companyId)!;
      const claimed = await tx.delivery.updateMany({ where: { id: delivery.id, driverId: actor.id, companyId: actor.companyId!, updatedAt: delivery.updatedAt }, data: { updatedAt: delivery.updatedAt } });
      if (claimed.count !== 1) throw new ConversationError(404, "Commande introuvable.");
    }
  }
  return order;
}
export async function getOrderConversation(actor: ConversationActor, orderId: string, beforeId?: string) {
  return transaction(async tx => {
    const order = await authorizedOrder(tx, actor, orderId);
    const base = { orderId, ...visible(actor) };
    const before = beforeId ? await tx.orderMessage.findFirst({ where: { ...base, id: beforeId } }) : null;
    if (beforeId && !before) throw new ConversationError(400, "Page inconnue.");
    const rows = await tx.orderMessage.findMany({ where: { ...base, ...(before ? { OR: [{ createdAt: { lt: before.createdAt } }, { createdAt: before.createdAt, id: { lt: before.id } }] } : {}) }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 51 });
    const hasMore = rows.length > 50;
    // Client : un livreur n'apparaît que par son prénom (le back-office garde le nom complet).
    const messages = rows.slice(0, 50).reverse().map(({ requestKey, ...message }) => { void requestKey; return actor.role === "CLIENT" ? { ...message, authorName: clientAuthorName(message.authorName, message.authorRole) } : message; });
    const read = await tx.orderThreadRead.findUnique({ where: { orderId_userId: { orderId, userId: actor.id } } });
    const unread = await tx.orderMessage.count({ where: { ...base, authorId: { not: actor.id }, ...after(read) } });
    return { orderId, reference: order.reference, messages, hasMore, unread, canWrite: canWrite(actor) && !conversationClosed(order), canNote: isConversationStaff(actor) && canWrite(actor), closed: conversationClosed(order), watermark: messages.at(-1)?.id ?? null };
  });
}
export async function postOrderMessage(actor: ConversationActor, orderId: string, input: MessageInput) {
  if (!canWrite(actor) || (input.internal && !isConversationStaff(actor))) throw new ConversationError(403, "Publication non autorisée.");
  return transaction(async tx => {
    const order = await authorizedOrder(tx, actor, orderId, true);
    const replay = await tx.orderMessage.findUnique({ where: { orderId_authorId_requestKey: { orderId, authorId: actor.id, requestKey: input.requestKey } } });
    if (replay) {
      if (replay.body !== input.body || replay.kind !== input.kind || replay.internal !== input.internal) throw new ConversationError(409, "Cette tentative correspond à un autre message.");
      return { messageId: replay.id, jobId: null, replay: true };
    }
    if (conversationClosed(order)) throw new ConversationError(409, "Mission terminée : échanges en lecture seule.");
    // Horodatage strictement croissant sous verrou : un envoi attendu derrière un
    // autre ne peut pas apparaître avant le watermark déjà lu (horloge/transaction).
    const latest = await tx.orderMessage.findFirst({ where: { orderId }, orderBy: [{ createdAt: "desc" }, { id: "desc" }] });
    const createdAt = new Date(Math.max(Date.now(), latest ? +latest.createdAt + 1 : 0));
    const message = await tx.orderMessage.create({ data: { orderId, authorId: actor.id, authorName: actor.name, authorRole: actor.role, createdAt, ...input } });
    const job = await enqueueOperationJob(tx, { jobKey: `order-message:${message.id}`, type: "CLIENT_NOTIFICATION", companyId: order.companyId, payload: { kind: "ORDER_MESSAGE", messageId: message.id } });
    return { messageId: message.id, jobId: job.id, replay: false };
  });
}
export async function markOrderConversationRead(actor: ConversationActor, orderId: string, messageId: string) {
  return transaction(async tx => {
    await authorizedOrder(tx, actor, orderId);
    const message = await tx.orderMessage.findFirst({ where: { id: messageId, orderId, ...visible(actor) } });
    if (!message) throw new ConversationError(404, "Message introuvable.");
    const key = { orderId, userId: actor.id };
    const current = await tx.orderThreadRead.findUnique({ where: { orderId_userId: key } });
    if (!current || message.createdAt > current.seenAt || (+message.createdAt === +current.seenAt && message.id > current.seenId)) {
      await tx.orderThreadRead.upsert({ where: { orderId_userId: key }, create: { ...key, seenAt: message.createdAt, seenId: message.id }, update: { seenAt: message.createdAt, seenId: message.id } });
    }
    await tx.clientNotification.updateMany({ where: { userId: actor.id, orderMessage: { is: { orderId, ...visible(actor), OR: [{ createdAt: { lt: message.createdAt } }, { createdAt: message.createdAt, id: { lte: message.id } }] } } }, data: { readAt: new Date() } });
  });
}
export async function deliverOrderMessageNotification(messageId: string) {
  await transaction(async tx => {
    const message = await tx.orderMessage.findUnique({ where: { id: messageId }, include: { order: { include: includeOrder } } });
    if (!message) return;
    const users = await tx.user.findMany({ where: { companyId: message.order.companyId, status: "ACTIVE", id: { not: message.authorId } }, include: { role: { include: { permissions: { include: { permission: true } } } } } });
    for (const user of users) {
      const slugs = user.role.permissions.map(p => p.permission.slug);
      const permissions = user.role.systemRole === "MINI_ADMIN" ? filterMiniAdminPermissions(slugs, user.settings) : slugs;
      const actor: ConversationActor = { id: user.id, companyId: user.companyId, role: user.role.systemRole, permissions, name: "" };
      try { conversationScope(actor); } catch { continue; }
      if (message.internal && !isConversationStaff(actor)) continue;
      if (actor.role === "CLIENT" && message.order.customerId !== actor.id) continue;
      if (actor.role === "DRIVER" && !message.order.deliveries.some(d => d.driverId === actor.id && d.companyId === actor.companyId)) continue;
      const seen = await tx.orderThreadRead.findUnique({ where: { orderId_userId: { orderId: message.orderId, userId: user.id } } });
      const read = seen && (+seen.seenAt > +message.createdAt || (+seen.seenAt === +message.createdAt && seen.seenId >= message.id));
      const id = `msg_${createHash("sha256").update(`${message.id}:${user.id}`).digest("hex").slice(0, 24)}`;
      await tx.clientNotification.upsert({ where: { id }, update: {}, create: { id, userId: user.id, type: "ORDER_MESSAGE", title: message.internal ? "Nouvelle note interne" : "Nouveau message de commande", body: "Un échange opérationnel est disponible.", href: null, orderMessageId: message.id, readAt: read ? new Date() : null } });
    }
  });
}
export async function listOrderMessageNotifications(actor: ConversationActor) {
  const scope = conversationScope(actor);
  const rows = await prisma.clientNotification.findMany({ where: { userId: actor.id, type: "ORDER_MESSAGE", readAt: null, orderMessage: { is: { ...visible(actor), order: { is: scope } } } }, include: { orderMessage: { select: { orderId: true, order: { select: { reference: true } } } } }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 50 });
  return rows.map(row => ({ id: row.id, orderId: row.orderMessage!.orderId, reference: row.orderMessage!.order.reference, title: row.title }));
}
