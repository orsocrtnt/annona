import { prisma } from "@/services/prisma/client";
import { conversationScope, ConversationError, transaction, type ConversationActor } from "@/domains/order-conversation/order-conversation.service";
import { getFulfillmentStatusLabel } from "@/lib/constants/order-status";
import { DEFAULT_DRIVER_LOCATION_SETTINGS, driverLocationSettingsSchema } from "@/lib/validations/driver-location-settings";
import { trackingPosition, trackingService, trackingTarget, trackingTimeline } from "./tracking.policy";

export async function getOrderTracking(actor: ConversationActor, orderId: string) {
  const scope = conversationScope(actor);
  return transaction(async tx => {
    const order = await tx.order.findFirst({ where: { id: orderId, ...scope }, select: {
      id: true, reference: true, status: true, deliveryCategory: true, updatedAt: true,
      company: { select: { settings: true } },
      stops: { orderBy: { sequence: "asc" }, select: { latitude: true, longitude: true } },
      deliveries: { where: { companyId: actor.companyId!, ...(actor.role === "CLIENT" ? { customerId: actor.id } : actor.role === "DRIVER" ? { driverId: actor.id } : {}) }, orderBy: [{ createdAt: "asc" }, { id: "asc" }], select: {
        id: true, reference: true, status: true, deliveryCategory: true, latitude: true, longitude: true, pickupLatitude: true, pickupLongitude: true, driverId: true, driverName: true, missionAcceptedAt: true, missionStartedAt: true, completedAt: true, updatedAt: true,
        driver: { select: { companyId: true, status: true, settings: true, driverLocation: true } },
        trackingEvents: { select: { id: true, label: true, description: true, occurredAt: true } },
      } },
    } });
    if (!order) throw new ConversationError(404, "Commande introuvable.");
    const raw = (order.company.settings as { locationTracking?: unknown } | null)?.locationTracking;
    const config = driverLocationSettingsSchema.safeParse(raw ?? {});
    const threshold = config.success ? config.data.onlineThresholdSeconds : DEFAULT_DRIVER_LOCATION_SETTINGS.onlineThresholdSeconds;
    const now = new Date();
    return { orderId: order.id, reference: order.reference, status: order.status, statusLabel: getFulfillmentStatusLabel(order.status, order.deliveryCategory), updatedAt: order.updatedAt.toISOString(), serverTime: now.toISOString(), deliveries: order.deliveries.map(d => ({
      id: d.id, reference: d.reference, status: d.status, statusLabel: getFulfillmentStatusLabel(d.status, d.deliveryCategory), driverName: d.driverId ? d.driverName : null,
      missionAcceptedAt: d.missionAcceptedAt?.toISOString() ?? null, missionStartedAt: d.missionStartedAt?.toISOString() ?? null, completedAt: d.completedAt?.toISOString() ?? null, updatedAt: d.updatedAt.toISOString(),
      position: trackingPosition(d, d.driver?.companyId === actor.companyId ? d.driver : null, threshold, now, trackingTarget({ ...d, order: { stops: order.stops } })), timeline: trackingTimeline(d.trackingEvents),
    })) };
  });
}
export async function getDriverService(driverId: string, companyId: string) {
  const driver = await prisma.user.findFirst({ where: { id: driverId, companyId, status: "ACTIVE", role: { systemRole: "DRIVER" } }, select: { settings: true } });
  if (!driver) throw new ConversationError(404, "Chauffeur introuvable.");
  return trackingService(driver.settings);
}
export async function setDriverService(driverId: string, companyId: string, active: boolean) {
  return transaction(async tx => {
    const driver = await tx.user.findFirst({ where: { id: driverId, companyId, status: "ACTIVE", role: { systemRole: "DRIVER" } }, select: { settings: true, updatedAt: true } });
    if (!driver) throw new ConversationError(404, "Chauffeur introuvable.");
    const current = trackingService(driver.settings);
    if (current.active === active) return current;
    const now = new Date(Math.max(Date.now(), +driver.updatedAt + 1));
    const state = { active, startedAt: active ? now.toISOString() : current.startedAt, endedAt: active ? null : now.toISOString() };
    const settings = driver.settings && typeof driver.settings === "object" && !Array.isArray(driver.settings) ? driver.settings : {};
    const claimed = await tx.user.updateMany({ where: { id: driverId, companyId, updatedAt: driver.updatedAt }, data: { settings: { ...settings, trackingService: state }, updatedAt: now } });
    if (claimed.count !== 1) throw new ConversationError(409, "Le service a changé. Actualisez puis réessayez.");
    // New service never revives a location received during a previous service.
    await tx.driverLocation.deleteMany({ where: { driverId } });
    return state;
  });
}
