import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";

const paths = {
  connected: "outputs/test2/connected.json",
  browser: "outputs/test2/browser.json",
  operational: "outputs/v1-go/browser-operational.json",
};

const raw = Object.fromEntries(
  await Promise.all(
    Object.entries(paths).map(async ([name, path]) => [name, await readFile(path, "utf8")])
  )
);

const forbidden = [
  /DATABASE_URL/i,
  /SUPABASE_(?:SERVICE|ANON|URL)/i,
  /postgres(?:ql)?:\/\//i,
  /authorization/i,
  /set-cookie/i,
  /password/i,
  /Demo2026/i,
  /sk-[a-z0-9_-]{12,}/i,
  /eyJ[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{10,}/,
];

for (const [name, content] of Object.entries(raw)) {
  for (const pattern of forbidden) {
    assert.doesNotMatch(content, pattern, `${name}: preuve potentiellement sensible`);
  }
}

const connected = JSON.parse(raw.connected);
const browser = JSON.parse(raw.browser);
const operational = JSON.parse(raw.operational);
assert.equal(connected.passed, true);
assert.equal(connected.clean, true);
assert.deepEqual(connected.idempotency, {
  standardConcurrentCreate: true,
  courierConcurrentCreate: true,
});
assert.deepEqual(connected.courier, {
  order: "DELIVERED",
  delivery: "DELIVERED",
  pickupRequired: true,
  invalidSkipRefused: true,
  adminClientTimelineConsistent: true,
});
assert.deepEqual(connected.failureReason, {
  missingReasonRefused: true,
  adminClientTimelineConsistent: true,
});
assert.deepEqual(connected.fixtureResidue, {
  companies: 0,
  users: 0,
  orders: 0,
  deliveries: 0,
  invoices: 0,
  jobs: 0,
});
assert.equal(browser.passed, true);
assert.deepEqual(browser.pageErrors, []);
assert.equal(browser.accessRefusals.clientToStaffApi, 403);
assert.equal(browser.accessRefusals.driverToClientApi, 403);
assert.equal(operational.passed, true);
assert.equal(operational.clean, true);
assert.deepEqual(operational.pageErrors, []);
assert.equal(operational.r01.doubleClickDispatched, true);
assert.equal(operational.r01.oneOrderPersisted, true);
assert.equal(operational.r01.referenceVisible, true);
assert.ok(operational.r01.responseStatuses.every((status) => status === 201));
assert.deepEqual(operational.r02, {
  courierFormSubmitted: true,
  pickupSkipRefused: true,
});
assert.equal(operational.r06.acknowledgementVisible, true);
assert.equal(operational.r06.pickupThenDelivery, true);
assert.equal(operational.r06.realPhotoUploaded, true);
assert.equal(operational.r06.proofVisibleToClientAndAdmin, true);
assert.ok(operational.r06.realProximityResponses.length >= 3);
assert.ok(operational.r06.realProximityResponses.every((status) => status === 200));
assert.equal(operational.r10.absentReasonRecorded, true);
assert.equal(operational.r10.clientAdminTrackingConsistent, true);
assert.deepEqual(operational.cleanup, {
  markedOrders: 0,
  proofObjectRemoved: true,
  error: null,
});

const summary = {
  task: "TEST-2",
  passed: true,
  suites: {
    localRules: "npm test — toutes les règles locales",
    connected: {
      companies: connected.companies,
      roles: connected.roles,
      delivered: connected.delivered,
      failed: connected.failed,
      idempotency: connected.idempotency,
      courier: connected.courier,
      failureReason: connected.failureReason,
      invoice: connected.invoice,
      tenantIsolation: connected.tenantIsolation,
      clean: connected.clean,
    },
    browser: browser.roles,
    networkFailure: browser.failureScenario,
    operationalBrowser: {
      r01: operational.r01,
      r02: operational.r02,
      r06: operational.r06,
      r10: operational.r10,
      clean: operational.clean,
    },
  },
  secretScan: "passed",
  persistentTrace: false,
};

await mkdir("outputs/test2", { recursive: true });
await writeFile("outputs/test2/summary.json", `${JSON.stringify(summary, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ passed: true, secretScan: "passed" }));
