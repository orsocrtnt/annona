import assert from "node:assert/strict";
import test from "node:test";
import { isDeliverySlotOpen, resolveDeliverySlot } from "../src/domains/order/delivery-slot";
import { deliverySlotRange, formatWeightKg } from "../src/lib/format/delivery-slot";
import { createClientOrderSchema } from "../src/lib/validations/order";
import { companyDeliverySlotsSchema, DEFAULT_DELIVERY_SLOTS, parseDeliverySlots, type CompanyDeliverySlots } from "../src/lib/validations/delivery-slots";

const slots: CompanyDeliverySlots = { mode: "SLOTS", slots: [{ start: "09:00", end: "12:00" }, { start: "14:00", end: "18:00" }] };
const now = new Date("2026-10-30T10:00:00Z"); // 11:00 à Paris
const order = { deliveryCategory: "STANDARD", requestedDeliveryDate: "2026-11-02", requestedDeliverySlot: "09:00-12:00" };

test("mode au jour : la date est gardée telle quelle, aucun créneau exigé ni posé", () => {
  assert.deepEqual(resolveDeliverySlot(DEFAULT_DELIVERY_SLOTS, { ...order, requestedDeliverySlot: undefined }, now), { ok: true, requestedDeliveryDate: "2026-11-02" });
});

test("mode créneaux : début et fin calculés côté serveur en heure de Paris, heure d'hiver comme d'été", () => {
  assert.deepEqual(resolveDeliverySlot(slots, order, now), { ok: true, requestedDeliveryDate: "2026-11-02T11:00:00.000Z", deliverySlotStart: "2026-11-02T08:00:00.000Z" });
  assert.deepEqual(resolveDeliverySlot(slots, { ...order, requestedDeliveryDate: "2027-07-01" }, now), { ok: true, requestedDeliveryDate: "2027-07-01T10:00:00.000Z", deliverySlotStart: "2027-07-01T07:00:00.000Z" });
});

test("mode créneaux : absent, inconnu, déjà fini ou date invalide sont refusés", () => {
  assert.deepEqual(resolveDeliverySlot(slots, { ...order, requestedDeliverySlot: undefined }, now), { ok: false, error: "DELIVERY_SLOT_REQUIRED" });
  assert.deepEqual(resolveDeliverySlot(slots, { ...order, requestedDeliveryDate: undefined }, now), { ok: false, error: "DELIVERY_SLOT_REQUIRED" });
  assert.deepEqual(resolveDeliverySlot(slots, { ...order, requestedDeliverySlot: "07:00-08:00" }, now), { ok: false, error: "DELIVERY_SLOT_INVALID" });
  assert.deepEqual(resolveDeliverySlot(slots, { ...order, requestedDeliveryDate: "2026-02-31" }, now), { ok: false, error: "DELIVERY_SLOT_INVALID" });
  assert.deepEqual(resolveDeliverySlot(slots, { ...order, requestedDeliveryDate: "2026-10-30", requestedDeliverySlot: "07:00-08:00" }, now), { ok: false, error: "DELIVERY_SLOT_INVALID" });
  assert.deepEqual(resolveDeliverySlot({ ...slots, slots: [{ start: "07:00", end: "08:00" }] }, { ...order, requestedDeliveryDate: "2026-10-30", requestedDeliverySlot: "07:00-08:00" }, now), { ok: false, error: "DELIVERY_SLOT_PAST" });
});

test("créneau commencé mais pas fini : encore réservable ; fini : fermé", () => {
  assert.equal(isDeliverySlotOpen("2026-10-30", { start: "09:00", end: "12:00" }, now), true);
  assert.equal(isDeliverySlotOpen("2026-10-30", { start: "07:00", end: "08:00" }, now), false);
});

test("mission spéciale : devis sans créneau, même en mode créneaux", () => {
  assert.deepEqual(resolveDeliverySlot(slots, { deliveryCategory: "SPECIAL_MISSION" }, now), { ok: true, requestedDeliveryDate: undefined });
});

test("réglage : chevauchement, créneau inversé et liste vide refusés ; lecture tolérante et triée", () => {
  assert.equal(companyDeliverySlotsSchema.safeParse({ mode: "SLOTS", slots: [] }).success, false);
  assert.equal(companyDeliverySlotsSchema.safeParse({ mode: "SLOTS", slots: [{ start: "12:00", end: "09:00" }] }).success, false);
  assert.equal(companyDeliverySlotsSchema.safeParse({ mode: "SLOTS", slots: [{ start: "09:00", end: "12:00" }, { start: "11:00", end: "13:00" }] }).success, false);
  assert.equal(companyDeliverySlotsSchema.safeParse({ mode: "DAY", slots: [] }).success, true);
  assert.deepEqual(parseDeliverySlots("n'importe quoi"), DEFAULT_DELIVERY_SLOTS);
  assert.deepEqual(parseDeliverySlots({ mode: "SLOTS", slots: [slots.slots[1], slots.slots[0]] }), slots);
});

const validOrder = {
  deliveryCategory: "STANDARD",
  items: [{ name: "Colis", quantity: 1 }],
  shippingAddress: "12 rue de Rivoli",
  shippingCity: "Paris",
  shippingPostalCode: "75001",
  requestedDeliveryDate: "2026-11-02",
};

test("poids : facultatif, champ vide accepté, négatif ou démesuré refusé, heure de créneau jamais lue du client", () => {
  const parse = (extra: Record<string, unknown>) => createClientOrderSchema.safeParse({ ...validOrder, ...extra });
  assert.equal(parse({}).data?.weightKg, undefined);
  assert.equal(parse({ weightKg: "" }).data?.weightKg, undefined);
  assert.equal(parse({ weightKg: "4.5" }).data?.weightKg, 4.5);
  assert.equal(parse({ weightKg: 0 }).success, false);
  assert.equal(parse({ weightKg: -2 }).success, false);
  assert.equal(parse({ weightKg: 5000 }).success, false);
  assert.equal(parse({ deliverySlotStart: "2026-11-02T01:00:00Z" }).data && "deliverySlotStart" in parse({ deliverySlotStart: "x" }).data!, false);
});

test("affichage : plage en heure de Paris et poids à la française", () => {
  assert.equal(deliverySlotRange("2026-11-02T08:00:00Z", "2026-11-02T11:00:00Z"), "09:00 – 12:00");
  assert.equal(formatWeightKg("4.50"), "4,5 kg");
});

test("récurrence : le créneau choisi est exigé en mode créneaux, inutile au jour", async () => {
  const { deliverySlotChoiceError } = await import("../src/domains/order/delivery-slot");
  assert.equal(deliverySlotChoiceError(DEFAULT_DELIVERY_SLOTS, undefined), null);
  assert.equal(deliverySlotChoiceError(slots, undefined), "DELIVERY_SLOT_REQUIRED");
  assert.equal(deliverySlotChoiceError(slots, "07:00-08:00"), "DELIVERY_SLOT_INVALID");
  assert.equal(deliverySlotChoiceError(slots, "09:00-12:00"), null);
});

test("occurrence : créneau repris ; supprimé ou mode au jour, la commande part quand même au jour", async () => {
  const { recurringOccurrenceDelivery } = await import("../src/domains/order/delivery-slot");
  const input = { deliveryCategory: "STANDARD", date: "2026-11-02", key: "09:00-12:00" };
  assert.deepEqual(recurringOccurrenceDelivery(slots, input), { requestedDeliveryDate: "2026-11-02T11:00:00.000Z", deliverySlotStart: "2026-11-02T08:00:00.000Z" });
  assert.deepEqual(recurringOccurrenceDelivery(slots, { ...input, key: "07:00-08:00" }), { requestedDeliveryDate: "2026-11-02" });
  assert.deepEqual(recurringOccurrenceDelivery(slots, { ...input, key: null }), { requestedDeliveryDate: "2026-11-02" });
  assert.deepEqual(recurringOccurrenceDelivery(DEFAULT_DELIVERY_SLOTS, input), { requestedDeliveryDate: "2026-11-02" });
});

test("occurrence rejouée après la fin du créneau : résultat identique, la clé d'idempotence reste valable", async () => {
  const { recurringOccurrenceDelivery } = await import("../src/domains/order/delivery-slot");
  assert.ok(recurringOccurrenceDelivery(slots, { deliveryCategory: "STANDARD", date: "2020-01-06", key: "09:00-12:00" }).deliverySlotStart);
});

test("message IA : l'heure du message choisit le créneau, sans jamais en inventer", async () => {
  const { suggestDeliverySlot } = await import("../src/domains/order/delivery-slot");
  assert.equal(suggestDeliverySlot(slots.slots, "10:30")?.start, "09:00");
  assert.equal(suggestDeliverySlot(slots.slots, "13:00")?.start, "14:00");
  assert.equal(suggestDeliverySlot(slots.slots, "20:00"), null);
  assert.equal(suggestDeliverySlot(slots.slots, null), null);
});

test("message IA : créneau et poids transmis à la commande, champs vides absents", async () => {
  const { buildOrderInputFromForm } = await import("../src/domains/order-intake/order-intake.form");
  const stop = { address: "", city: "", postalCode: "", contactName: "", phone: "", instructions: "" };
  const values = { deliveryCategory: "STANDARD" as const, pickup: stop, delivery: stop, requestedDeliveryDate: "2026-11-02", deadlineLabel: "", urgent: false, packageName: "Colis", quantity: 1, instructions: "" };
  const filled = buildOrderInputFromForm({ ...values, requestedDeliverySlot: "09:00-12:00", weightKg: "4.5" });
  assert.equal(filled.requestedDeliverySlot, "09:00-12:00");
  assert.equal(filled.weightKg, "4.5");
  const empty = buildOrderInputFromForm({ ...values, requestedDeliverySlot: "", weightKg: "" });
  assert.equal("requestedDeliverySlot" in empty, false);
  assert.equal("weightKg" in empty, false);
});
