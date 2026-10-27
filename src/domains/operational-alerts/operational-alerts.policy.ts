import { createHash } from "node:crypto";
import { formatPlace } from "@/lib/format/place";

type Message = { id: string; requestKey: string; kind: string; internal: boolean; body: string; authorName: string; createdAt: Date };
type Delivery = { id: string; reference: string; status: string; completedAt: Date | null; driverId?: string | null };
type Order = { id: string; reference: string; status: string; requestedDeliveryDate: Date | null; deliveries: Delivery[] };
export type OperationalAlert = { id: string; orderId: string; deliveryId: string | null; reference: string; title: string; detail: string; internal: boolean; deadline: Date | null; state: "OPEN" | "ACKNOWLEDGED" | "RESOLVED" | "CLOSED"; acknowledged: Message | null; resolution: Message | null; canAct: boolean };
const active = new Set(["PENDING", "ASSIGNED", "PURCHASING", "IN_DELIVERY"]);
const closedDelivery = new Set(["DELIVERED", "FAILED", "CANCELLED", "INVOICED", "PAID"]);
export function alertActionKey(id: string, action: "ack" | "resolve") {
  return `alert1:${createHash("sha256").update(id).digest("hex")}:${action}`;
}
export function isOperationalOrderClosed(order: { status: string; deliveries: Array<{ completedAt: Date | null; status: string }> }) {
  return order.status === "CANCELLED" || (order.deliveries.length > 0 && order.deliveries.every(d => Boolean(d.completedAt) || closedDelivery.has(d.status)));
}
export function deriveOperationalAlerts(order: Order, messages: Message[], canAct: boolean, now = new Date(), driverId?: string): OperationalAlert[] {
  const closed = isOperationalOrderClosed(order);
  const sources: Array<Pick<OperationalAlert, "id" | "deliveryId" | "title" | "detail" | "internal" | "deadline"> & { closed: boolean }> = [];
  const due = order.requestedDeliveryDate;
  if (due && +due < +now) for (const d of order.deliveries) {
    if (driverId && d.driverId !== driverId) continue;
    const id = `late:${d.id}:${due.toISOString()}`;
    // Une date estimée ou une simple création ne constitue pas une échéance.
    const hasAction = messages.some(m => m.requestKey === alertActionKey(id, "ack") || m.requestKey === alertActionKey(id, "resolve"));
    if ((!d.completedAt && active.has(d.status)) || (d.completedAt && +d.completedAt > +due) || hasAction) sources.push({ id, deliveryId: d.id, title: `Retard — ${d.reference}`, detail: "Date de livraison demandée dépassée. À vérifier avec le chauffeur.", deadline: due, internal: false, closed: closed || Boolean(d.completedAt) || !active.has(d.status) });
  }
  for (const message of messages) if (message.kind === "INCIDENT" && !message.requestKey.startsWith("alert1:")) sources.push({ id: `incident:${message.id}`, deliveryId: null, title: message.internal ? "Incident interne" : "Incident signalé", detail: message.body, deadline: null, internal: message.internal, closed });
  return sources.map(({ closed: sourceClosed, ...source }) => {
    const acknowledged = messages.find(m => m.requestKey === alertActionKey(source.id, "ack")) ?? null;
    const resolution = messages.find(m => m.requestKey === alertActionKey(source.id, "resolve")) ?? null;
    const state = resolution ? "RESOLVED" : sourceClosed ? "CLOSED" : acknowledged ? "ACKNOWLEDGED" : "OPEN";
    return { ...source, orderId: order.id, reference: order.reference, state, acknowledged, resolution, canAct: canAct && !sourceClosed && !resolution };
  });
}

type AlertTargetOrder = {
  shippingAddress?: string | null;
  shippingCity?: string | null;
  customer?: { firstName: string; lastName: string } | null;
  deliveries: Array<{ id: string; address?: string | null; city?: string | null }>;
};

/** Qui et où, pour lire une alerte sans déchiffrer ses références (liste des alertes). */
export function describeAlertTarget(order: AlertTargetOrder, deliveryId: string | null) {
  const delivery = deliveryId ? order.deliveries.find(d => d.id === deliveryId) : undefined;
  const place = formatPlace(delivery?.address ?? order.shippingAddress, delivery?.city ?? order.shippingCity);
  const customerName = order.customer ? `${order.customer.firstName} ${order.customer.lastName}`.trim() : "";
  return { customerName: customerName || null, place };
}
