// DEMO-1 — journée de démonstration d'un environnement du lot de démo : volumes de Théo (13 novembre 2026), journée
// remise à l'heure de Paris, client et livreur de démo avec quelque chose à essayer, contraintes d'unicité du schéma.
import assert from "node:assert/strict";
import test from "node:test";
import { buildDemoScenario, demoPersonaUserId, demoPoolPrefix, DEMO_SCENARIO } from "@/domains/demo/demo-scenario";

// Lundi 16 novembre 2026 (heure d'hiver : Paris = UTC+1).
const at = (hour: number, minute = 0) => new Date(Date.UTC(2026, 10, 16, hour - 1, minute));
const todayDb = new Date(Date.UTC(2026, 10, 16)).getTime();
const tomorrowDb = new Date(Date.UTC(2026, 10, 17)).getTime();
const time = (value: unknown) => (value instanceof Date ? value.getTime() : Number.NaN);

function stopsByRound(scenario: ReturnType<typeof buildDemoScenario>) {
  const byRound = new Map<string, typeof scenario.stops>();
  for (const stop of scenario.stops) byRound.set(stop.roundId, [...(byRound.get(stop.roundId) ?? []), stop]);
  return byRound;
}

test("DEMO-1 : volumes de Théo — 60 à 70 arrêts par tournée du matin, 15 à 20 produits, 200 arrêts par jour au plus", () => {
  const scenario = buildDemoScenario({ slot: 3, now: at(9) });
  assert.equal(scenario.products.length, 100);
  assert.equal(scenario.merchants.length, 172);
  const byRound = stopsByRound(scenario);
  const weekdayMorning = scenario.rounds.filter((round) => String(round.slotId).endsWith("_matin") && new Date(String(round.date)).getUTCDay() !== 0);
  assert.ok(weekdayMorning.length >= 10);
  for (const round of weekdayMorning) {
    const count = byRound.get(round.id!)?.length ?? 0;
    assert.ok(count >= 60 && count <= 70, `${round.id} : ${count} arrêts`);
  }
  const perDay = new Map<number, number>();
  for (const order of scenario.orders) perDay.set(time(order.deliveryDate), (perDay.get(time(order.deliveryDate)) ?? 0) + 1);
  for (const count of perDay.values()) assert.ok(count <= 200, `${count} commandes un même jour`);
  const linesPerOrder = new Map<string, number>();
  for (const line of scenario.orderLines) linesPerOrder.set(line.orderId, (linesPerOrder.get(line.orderId) ?? 0) + 1);
  for (const [orderId, count] of linesPerOrder) {
    const [min, max] = DEMO_SCENARIO.linesPerOrder;
    assert.ok(count >= min && count <= max, `${orderId} : ${count} lignes`);
  }
  assert.equal(linesPerOrder.size, scenario.orders.length);
});

test("DEMO-1 : identifiants propres à l'environnement, déterministes, contraintes d'unicité du schéma respectées", () => {
  const first = buildDemoScenario({ slot: 3, now: at(9) });
  const again = buildDemoScenario({ slot: 3, now: at(9, 30) });
  assert.deepEqual(again.orders.map((order) => order.id), first.orders.map((order) => order.id));
  assert.deepEqual(again.merchants, first.merchants);

  const other = buildDemoScenario({ slot: 4, now: at(9) });
  const ids = (scenario: typeof first) => [
    scenario.companyId,
    ...[scenario.categories, scenario.products, scenario.zones, scenario.slots, scenario.merchants, scenario.merchantPrices, scenario.users, scenario.recurringOrders, scenario.orders, scenario.rounds, scenario.stops].flatMap((rows) => rows.map((row) => String(row.id))),
  ];
  for (const value of ids(first)) assert.ok(value.startsWith(demoPoolPrefix(3)), value);
  const otherIds = new Set(ids(other));
  assert.ok(ids(first).every((value) => !otherIds.has(value)));
  assert.notEqual(first.company.slug, other.company.slug);
  assert.equal(new Set(first.users.map((user) => user.email)).size, first.users.length);
  assert.ok(first.users.every((user) => user.email.endsWith("@demo.annona.example")));

  const unique = <T>(values: T[]) => new Set(values).size === values.length;
  assert.ok(unique(first.orders.map((order) => `${order.merchantId}|${time(order.deliveryDate)}|${order.slotId}`)));
  assert.ok(unique(first.orders.map((order) => order.reference)));
  assert.ok(unique(first.stops.map((stop) => stop.orderId)));
  assert.ok(unique(first.orderLines.map((line) => `${line.orderId}|${line.productId}`)));
  assert.ok(unique(first.merchantPrices.map((price) => `${price.merchantId}|${price.productId}`)));
  const productIds = new Set(first.products.map((product) => product.id));
  assert.ok(first.orderLines.every((line) => productIds.has(line.productId)));
  assert.throws(() => demoPoolPrefix(0), RangeError);
});

test("DEMO-1 : à 9h, tournées du matin en cours — arrêts déjà passés livrés, les suivants à faire", () => {
  const now = at(9);
  const scenario = buildDemoScenario({ slot: 1, now });
  const orders = new Map(scenario.orders.map((order) => [order.id, order]));
  const todayMorning = scenario.rounds.filter((round) => time(round.date) === todayDb && String(round.slotId).endsWith("_matin"));
  assert.equal(todayMorning.length, 2);
  for (const round of todayMorning) {
    assert.equal(round.status, "IN_PROGRESS");
    const stops = scenario.stops.filter((stop) => stop.roundId === round.id);
    const delivered = stops.filter((stop) => stop.status === "DELIVERED");
    assert.ok(delivered.length > 0 && delivered.length < stops.length);
    for (const stop of delivered) {
      assert.ok(time(stop.deliveredAt) <= now.getTime());
      assert.equal(orders.get(stop.orderId)?.status, "DELIVERED");
    }
    for (const stop of stops.filter((item) => item.status === "PENDING")) assert.equal(orders.get(stop.orderId)?.status, "PREPARED");
  }
  // Historique terminé, lendemain commandé mais pas verrouillé avant 17h.
  assert.ok(scenario.rounds.filter((round) => time(round.date) < todayDb).every((round) => round.status === "COMPLETED"));
  const tomorrow = scenario.orders.filter((order) => time(order.deliveryDate) === tomorrowDb);
  assert.ok(tomorrow.length > 0 && tomorrow.every((order) => order.status === "VALIDATED" && order.lockedAt === null));
  assert.ok(scenario.rounds.every((round) => time(round.date) !== tomorrowDb));
});

test("DEMO-1 : à 21h, le livreur de démo a encore des arrêts à faire ; le lendemain est verrouillé, tournées calculées", () => {
  const scenario = buildDemoScenario({ slot: 2, now: at(21) });
  const driver = scenario.users.find((user) => user.persona === "driver")!;
  const playable = scenario.rounds.filter((round) => time(round.date) === todayDb && round.driverId === driver.id && round.status === "IN_PROGRESS");
  assert.equal(playable.length, 1);
  assert.ok(scenario.stops.some((stop) => stop.roundId === playable[0]!.id && stop.status === "PENDING"));
  const tomorrow = scenario.orders.filter((order) => time(order.deliveryDate) === tomorrowDb);
  assert.ok(tomorrow.length > 0 && tomorrow.every((order) => order.status === "LOCKED" && order.lockedAt instanceof Date));
  const tomorrowRounds = scenario.rounds.filter((round) => time(round.date) === tomorrowDb);
  assert.ok(tomorrowRounds.length >= 2 && tomorrowRounds.every((round) => round.status === "DRAFT"));
});

test("DEMO-1 : le client de démo n'a pas commandé pour demain, mais a sa commande de la semaine dernière à recopier", () => {
  for (const hour of [9, 21]) {
    const scenario = buildDemoScenario({ slot: 5, now: at(hour) });
    const client = scenario.users.find((user) => user.persona === "client")!;
    assert.ok(client.merchantId);
    const own = scenario.orders.filter((order) => order.merchantId === client.merchantId);
    assert.ok(own.every((order) => time(order.deliveryDate) !== tomorrowDb));
    const lastWeek = new Date(Date.UTC(2026, 10, 9)).getTime();
    assert.ok(own.some((order) => time(order.deliveryDate) === lastWeek && order.status === "DELIVERED"));
  }
});

test("DEMO-1 : un compte par espace à essayer, le client rattaché à son commerce", () => {
  const scenario = buildDemoScenario({ slot: 7, now: at(9) });
  const personas = scenario.users.flatMap((user) => (user.persona ? [user.persona] : []));
  assert.deepEqual([...personas].sort(), ["admin", "baker", "client", "driver"]);
  const roles = Object.fromEntries(scenario.users.filter((user) => user.persona).map((user) => [user.persona, user.role]));
  assert.deepEqual(roles, { admin: "ADMIN", baker: "BAKER", driver: "DRIVER", client: "MERCHANT" });
  assert.equal(scenario.users.filter((user) => user.role === "DRIVER").length, 4);
  // La page /demo retrouve le compte de chaque espace sans recalculer la journée.
  for (const user of scenario.users) if (user.persona) assert.equal(user.id, demoPersonaUserId(7, user.persona));
});

test("DEMO-1 : à toute heure, les quatre tournées du jour sont en cours, chacune avec son livreur et des arrêts des deux côtés", () => {
  for (const [hour, minute] of [[0, 30], [3, 0], [9, 0], [13, 0], [16, 30], [21, 0], [23, 45]] as const) {
    const now = at(hour, minute);
    const scenario = buildDemoScenario({ slot: 6, now });
    const today = scenario.rounds.filter((round) => time(round.date) === todayDb);
    assert.equal(today.length, 4, `${hour}h${minute}`);
    assert.ok(today.every((round) => round.status === "IN_PROGRESS"), `${hour}h${minute}`);
    assert.equal(new Set(today.map((round) => round.driverId)).size, 4);
    const orders = new Map(scenario.orders.map((order) => [order.id, order]));
    const progress = today.map((round) => {
      const stops = scenario.stops.filter((stop) => stop.roundId === round.id);
      const delivered = stops.filter((stop) => stop.status === "DELIVERED");
      assert.ok(delivered.length > 0 && delivered.length < stops.length, `${round.id} à ${hour}h${minute}`);
      for (const stop of delivered) {
        assert.ok(time(stop.deliveredAt) <= now.getTime());
        assert.equal(orders.get(stop.orderId)?.status, "DELIVERED");
      }
      for (const stop of stops.filter((item) => item.status === "PENDING")) {
        assert.ok(time(stop.estimatedArrivalAt) > now.getTime() - 15 * 60_000, "les arrêts à faire ne sont pas déjà en retard");
        assert.equal(orders.get(stop.orderId)?.status, "PREPARED");
        assert.ok(time(orders.get(stop.orderId)?.preparedAt) <= now.getTime());
      }
      return delivered.length / stops.length;
    });
    assert.ok(new Set(progress.map((value) => Math.round(value * 10))).size >= 2, "des stades d'avancement différents");
  }
});
