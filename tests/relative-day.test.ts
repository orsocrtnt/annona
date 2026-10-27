import assert from "node:assert/strict";
import test from "node:test";
import { fullDateLabel, relativeDayLabel } from "../src/lib/format/relative-day";

const now = new Date("2026-10-27T10:00:00Z"); // 11:00 à Paris

test("les jours proches se lisent en mots, à l'heure de Paris", () => {
  assert.equal(relativeDayLabel("2026-10-27T13:30:00Z", now, { withTime: true }), "Aujourd'hui 14:30");
  assert.equal(relativeDayLabel("2026-10-27T13:30:00Z", now), "Aujourd'hui");
  assert.equal(relativeDayLabel("2026-10-26T08:00:00Z", now), "Hier");
  assert.equal(relativeDayLabel("2026-10-28T08:00:00Z", now, { withTime: true }), "Demain 09:00");
  assert.equal(relativeDayLabel("2026-10-26T23:30:00Z", now), "Aujourd'hui", "00:30 à Paris, déjà le 27");
});

test("au-delà, une date courte, avec l'année si elle diffère", () => {
  assert.equal(relativeDayLabel("2026-10-23T08:00:00Z", now), "23 oct.");
  assert.equal(relativeDayLabel("2025-12-02T08:00:00Z", now), "2 déc. 2025");
  assert.equal(relativeDayLabel("pas une date", now), "—");
});

test("la date complète reste disponible pour l'infobulle", () => {
  assert.match(fullDateLabel("2026-10-27T13:30:00Z"), /mardi 27 octobre 2026.*14:30/);
  assert.equal(fullDateLabel("x"), "");
});

test("une commande en cours dont l'échéance est passée est en retard, jamais une commande close", async () => {
  const { isOrderOverdue } = await import("../src/lib/orders/overdue");
  assert.equal(isOrderOverdue("ASSIGNED", "2026-10-27T09:00:00Z", now), true);
  assert.equal(isOrderOverdue("IN_DELIVERY", "2026-10-27T11:00:00Z", now), false, "échéance à venir");
  assert.equal(isOrderOverdue("DELIVERED", "2026-10-20T09:00:00Z", now), false);
  assert.equal(isOrderOverdue("CANCELLED", "2026-10-20T09:00:00Z", now), false);
  assert.equal(isOrderOverdue("PENDING", null, now), false);
});

test("le lieu n'ajoute la ville que si l'adresse ne la contient pas", async () => {
  const { formatPlace } = await import("../src/lib/format/place");
  assert.equal(formatPlace("12 rue Lepic", "Paris"), "12 rue Lepic, Paris");
  assert.equal(formatPlace("8 rue Oberkampf, 75011 Paris", "Paris"), "8 rue Oberkampf, 75011 Paris");
  assert.equal(formatPlace(null, " "), null);
});

test("date-heure unique des fiches et ancienneté d'un signal", async () => {
  const { dateTimeLabel, elapsedLabel } = await import("../src/lib/format/relative-day");
  assert.equal(dateTimeLabel("2026-10-27T13:30:00Z"), "27 oct. 2026 à 14:30");
  assert.equal(dateTimeLabel("x"), "—");
  const t = Date.parse("2026-10-27T10:00:00Z");
  assert.equal(elapsedLabel(new Date(t - 4_000), t), "à l'instant");
  assert.equal(elapsedLabel(new Date(t - 25_000), t), "il y a 25 s");
  assert.equal(elapsedLabel(new Date(t - 3 * 60_000), t), "il y a 3 min");
  assert.equal(elapsedLabel(new Date(t - 2 * 3_600_000), t), "il y a 2 h");
  assert.equal(elapsedLabel("2026-10-25T09:00:00Z", t), "le 25 oct. 2026 à 10:00");
});

test("le nom seul, sans le rôle en préfixe", async () => {
  const { withoutRolePrefix } = await import("../src/lib/format/person-labels");
  assert.equal(withoutRolePrefix("Livreur Jean Dupont"), "Jean Dupont");
  assert.equal(withoutRolePrefix("Client Sophie Martin"), "Sophie Martin");
  assert.equal(withoutRolePrefix("Karim Benali"), "Karim Benali");
  assert.equal(withoutRolePrefix(null), "");
});

test("la prochaine livraison dit son jour, pas seulement l'heure", async () => {
  const { etaDayLabel, formatEta } = await import("../src/features/client-portal/utils");
  assert.equal(formatEta("2026-10-27T13:30:00Z"), "14:30", "heure de Paris");
  assert.equal(etaDayLabel("2026-10-27T13:30:00Z", now), "aujourd'hui");
  assert.equal(etaDayLabel("2026-10-28T13:30:00Z", now), "demain");
  assert.equal(etaDayLabel("2026-10-30T13:30:00Z", now), "le 30 oct.");
  assert.equal(etaDayLabel(null, now), "Aucune livraison prévue");
});

test("une facture se titre par sa date", async () => {
  const { invoiceTitle } = await import("../src/features/client-portal/utils");
  assert.equal(invoiceTitle("2026-10-27T08:00:00Z", now), "Facture d'aujourd'hui");
  assert.equal(invoiceTitle("2026-10-26T08:00:00Z", now), "Facture d'hier");
  assert.equal(invoiceTitle("2026-10-20T08:00:00Z", now), "Facture du 20 oct.");
});

test("une ligne de facture sans montant lisible n'affiche pas « NaN € »", async () => {
  const { invoiceLineTotal } = await import("../src/features/client-portal/utils");
  assert.match(invoiceLineTotal({ amount: 12.5, quantity: 2 }), /^25,00\s€$/);
  assert.match(invoiceLineTotal({ amount: "4.90", quantity: 1 }), /^4,90\s€$/);
  assert.equal(invoiceLineTotal({ amount: undefined as unknown as number, quantity: 2 }), "—");
});
