import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const expected = [
  "access-events/route.ts",
  "campaigns/[id]/recipients/route.ts",
  "campaigns/[id]/route.ts",
  "campaigns/[id]/send/route.ts",
  "campaigns/opt-outs/route.ts",
  "campaigns/route.ts",
  "companies/[id]/access/route.ts",
  "companies/[id]/route.ts",
  "companies/route.ts",
  "contact-messages/route.ts",
  "demo-pool/route.ts",
  "home/route.ts",
  "incidents/route.ts",
  "operation-jobs/route.ts",
  "overview/route.ts",
  "pilots/[id]/notes/route.ts",
  "pilots/[id]/route.ts",
  "pilots/route.ts",
  "prospection/sheet/route.ts",
  "saas-health/route.ts",
  "sales-codes/[id]/route.ts",
  "sales-codes/route.ts",
  "search/route.ts",
  "service-health/route.ts",
  "subscriptions/route.ts",
  "support-tickets/route.ts",
  "users/[id]/access/route.ts",
  "users/route.ts",
  "waitlist/[id]/route.ts",
  "waitlist/export/route.ts",
  "waitlist/funnel/route.ts",
  "waitlist/route.ts",
];

function discover(directory: string): string[] {
  return readdirSync(directory, { recursive: true })
    .map((entry) => entry.toString().split("\\").join("/"))
    .filter((entry) => entry.endsWith("route.ts"))
    .sort();
}

test("ADMIN-1 inventaire : les GET plateforme gardent les trois protections", () => {
  const found = discover("src/app/api/admin");
  assert.deepEqual(found, expected);
  for (const file of expected) {
    const source = readFileSync(join("src/app/api/admin", file), "utf8");
    assert.match(source, /requireStaffRole\("dashboard:admin"\)/);
    assert.match(source, /requireRole\(auth\.context, \["SUPER_ADMIN"\]\)/);
    assert.match(source, /"Cache-Control": "no-store"/);
  }
});
