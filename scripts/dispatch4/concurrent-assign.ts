/**
 * DISPATCH-4 — test d'intégration opt-in sur PostgreSQL RÉEL (tutelliv-dev uniquement).
 * Hors `npm run check`. Lancement :
 *   npx dotenv -e <chemin>/.env.local -- npm run test:dispatch-concurrency
 * Requêtes concurrentes réelles (Promise.all, 10) avec un pool de 5 connexions :
 *  (a) double clic : 10 « Affecter » simultanés, même livreur → une affectation, un événement ;
 *  (b) deux dispatchers : 10 clics simultanés sur deux livreurs différents → un seul gagnant ;
 *  (c) auto-dispatch (meilleur score) contre clic du dispatcher → une seule affectation ;
 *  (d) plafond de charge 1 : deux livraisons vers le même livreur en même temps → une seule.
 * Livraisons sans client : aucune notification n'est mise en file ni envoyée.
 * Données préfixées E2E, supprimées dans `finally`, même en cas d'échec.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { validateDevEnvironment } from "../env2/verify-dev-env";

const PARALLEL = 10;

async function main() {
  const envErrors = validateDevEnvironment(process.env);
  if (envErrors.length) {
    console.log(JSON.stringify({ passed: false, reason: "ENVIRONNEMENT_NON_DEV", errors: envErrors }));
    process.exitCode = 2;
    return;
  }
  process.env.DATABASE_CONNECTION_LIMIT = "5";
  // Aucun appel au service de trajet : les livreurs de test n'ont pas de position.
  delete process.env.DRIVE_ROUTE_OSRM_URL;

  const { prisma } = await import("../../src/services/prisma/client");
  const { assignFromSuggestion, tryAutoAssignDelivery } = await import("../../src/domains/delivery/auto-dispatch.service");

  const tag = randomUUID().slice(0, 8);
  const slug = `e2e-dispatch4-${tag}`;
  const report: Record<string, unknown> = { tag, connectionLimit: process.env.DATABASE_CONNECTION_LIMIT, parallel: PARALLEL };
  let companyId: string | null = null;

  try {
    const driverRole = await prisma.role.findFirst({ where: { systemRole: "DRIVER" }, select: { id: true } });
    assert.ok(driverRole, "DISPATCH4_DRIVER_ROLE_MISSING");
    const company = await prisma.company.create({
      data: {
        name: `E2E DISPATCH-4 ${tag}`,
        slug,
        isDemo: true,
        settings: {
          dispatchRules: {
            enabled: true,
            strategy: "PRIORITY_LIST",
            bestScore: true,
            maxActiveDeliveriesPerDriver: 1,
            prioritizeCourier: true,
            autoAssignCategories: { STANDARD: true, COURIER: true, SPECIAL_MISSION: false },
            allowDriverSelfClaim: false,
            driverRules: [],
            zoneDriverMap: {},
            defaultDriverId: null,
          },
        },
      },
    });
    companyId = company.id;
    const newDriver = (name: string) => prisma.user.create({
      data: { authId: `${slug}-${name}`, email: `${name}@${slug}.invalid`, firstName: "E2E", lastName: name, status: "ACTIVE", roleId: driverRole.id, companyId: company.id },
    });
    const drivers: Record<string, { id: string }> = {};
    for (const name of ["a", "b", "c", "d", "e"]) drivers[name] = await newDriver(name);
    let n = 0;
    const newDelivery = async () => {
      n += 1;
      const order = await prisma.order.create({
        data: { reference: `E2E-D4-${tag}-${n}`, totalAmount: 10, companyId: company.id, shippingAddress: "1 rue E2E", shippingCity: "Paris", shippingPostalCode: "75011" },
      });
      return prisma.delivery.create({
        data: { reference: `E2E-LIV-D4-${tag}-${n}`, address: "1 rue E2E", city: "Paris", postalCode: "75011", companyId: company.id, orderId: order.id, pickupLatitude: 48.8566, pickupLongitude: 2.3522 },
      });
    };
    const settle = async <T>(tasks: Array<() => Promise<T>>) => {
      const started = Date.now();
      const results = await Promise.allSettled(tasks.map((task) => task()));
      return { results, ms: Date.now() - started };
    };
    const errors = (results: PromiseSettledResult<unknown>[]) =>
      results.flatMap((r) => (r.status === "rejected" ? [String((r.reason as Error)?.message ?? r.reason).split(":")[0] ?? ""] : []));
    const events = (deliveryId: string) => prisma.trackingEvent.count({ where: { deliveryId } });
    const read = (deliveryId: string) => prisma.delivery.findUniqueOrThrow({ where: { id: deliveryId }, select: { driverId: true, status: true } });

    // (a) Double clic : même livreur, 10 fois en même temps.
    const d1 = await newDelivery();
    const a = await settle(Array.from({ length: PARALLEL }, () => () => assignFromSuggestion(company.id, d1.id, drivers.a!.id)));
    const a1 = await read(d1.id);
    assert.equal(a1.driverId, drivers.a!.id, "a : livreur affecté");
    assert.equal(a1.status, "ASSIGNED");
    assert.equal(await events(d1.id), 1, "a : un seul événement d'historique");
    assert.deepEqual(errors(a.results), [], "a : chaque clic répété est un succès idempotent");
    report.a = { ms: a.ms, fulfilled: a.results.filter((r) => r.status === "fulfilled").length };

    // (b) Deux dispatchers, deux livreurs différents, 10 clics entrelacés.
    const d2 = await newDelivery();
    const b = await settle(Array.from({ length: PARALLEL }, (_, i) => () => assignFromSuggestion(company.id, d2.id, (i % 2 ? drivers.b : drivers.c)!.id)));
    const b1 = await read(d2.id);
    assert.ok(b1.driverId === drivers.b!.id || b1.driverId === drivers.c!.id, "b : un des deux livreurs");
    assert.equal(await events(d2.id), 1, "b : un seul événement");
    const loser = b1.driverId === drivers.b!.id ? drivers.c!.id : drivers.b!.id;
    assert.equal(await prisma.delivery.count({ where: { driverId: loser, companyId: company.id } }), 0, "b : le perdant n'a rien");
    const bErrors = errors(b.results);
    assert.ok(bErrors.every((code) => ["DELIVERY_NOT_AVAILABLE", "DELIVERY_ASSIGNMENT_CONFLICT"].includes(code)), `b : conflits explicites (${bErrors.join(",")})`);
    assert.equal(bErrors.length, PARALLEL / 2, "b : les 5 clics vers le perdant échouent ; ceux du gagnant sont idempotents");
    report.b = { ms: b.ms, errors: bErrors };

    // (c) Auto-dispatch (meilleur score) contre clic du dispatcher vers « d ».
    const d3 = await newDelivery();
    const c = await settle<unknown>(Array.from({ length: PARALLEL }, (_, i) =>
      i % 2 ? () => tryAutoAssignDelivery(company.id, d3.id) : () => assignFromSuggestion(company.id, d3.id, drivers.d!.id)));
    const c1 = await read(d3.id);
    assert.equal(c1.status, "ASSIGNED", "c : affectée");
    assert.equal(await events(d3.id), 1, "c : un seul événement");
    const autoAssigned = c.results.filter((r) => r.status === "fulfilled" && (r.value as { assigned?: boolean })?.assigned === true).length;
    report.c = { ms: c.ms, winner: c1.driverId === drivers.d!.id ? "clic" : "auto", autoAssigned, errors: errors(c.results) };

    // (d) Plafond 1 : deux livraisons vers « e » en même temps.
    const [d4, d5] = [await newDelivery(), await newDelivery()];
    const d = await settle(Array.from({ length: PARALLEL }, (_, i) => () => assignFromSuggestion(company.id, (i % 2 ? d4 : d5).id, drivers.e!.id)));
    const eActive = await prisma.delivery.count({ where: { driverId: drivers.e!.id, status: "ASSIGNED" } });
    assert.equal(eActive, 1, "d : une seule livraison pour un plafond de 1");
    const dErrors = errors(d.results);
    assert.ok(dErrors.every((code) => code === "DRIVER_OVER_CAPACITY"), `d : refus explicite de charge (${dErrors.join(",")})`);
    assert.equal((await events(d4.id)) + (await events(d5.id)), 1, "d : un seul événement");
    report.d = { ms: d.ms, errors: dErrors.length };

    report.passed = true;
  } catch (error) {
    report.passed = false;
    report.error = error instanceof Error ? error.message : String(error);
    process.exitCode = 1;
  } finally {
    const cleanup: Record<string, number> = {};
    if (companyId) {
      cleanup.jobs = (await prisma.operationJob.deleteMany({ where: { companyId } })).count;
      cleanup.orders = (await prisma.order.deleteMany({ where: { companyId } })).count;
      cleanup.users = (await prisma.user.deleteMany({ where: { companyId } })).count;
      cleanup.companies = (await prisma.company.deleteMany({ where: { id: companyId } })).count;
      cleanup.leftover = await prisma.company.count({ where: { slug: { startsWith: "e2e-dispatch4-" } } });
    }
    report.cleanup = cleanup;
    await prisma.$disconnect();
    console.log(JSON.stringify(report, null, 2));
  }
}

void main();
