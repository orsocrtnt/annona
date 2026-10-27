import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const surfaces = [
  "src/app/api/admin",
  "src/app/(back-office)/admin",
  "src/features/admin",
  "src/domains/admin",
];
const markers = [
  /impersonat/i,
  /masquerad/i,
  /loginAs/i,
  /signInAs/i,
  /actAs/i,
  /assumeRole/i,
  /switchUser/i,
  /switchCompany/i,
];
const sessionWrites = [
  /createSession/i,
  /setSession/i,
  /signIn\s*\(/i,
  /signInWith/i,
  /generateLink/i,
  /auth\.admin/i,
  /cookies\s*\(\s*\)\s*\.set/,
  /exchangeCode/i,
  /updateUserById/i,
];

function filesUnder(root: string) {
  return readdirSync(root, { recursive: true })
    .map((entry) => entry.toString().split("\\").join("/"))
    .filter((entry) => entry.endsWith(".ts") || entry.endsWith(".tsx"))
    .map((entry) => join(root, entry))
    .sort();
}

test("ADMIN-1 impersonation : les routes plateforme n'exportent que GET", () => {
  const routes = filesUnder("src/app/api/admin").filter((file) => file.endsWith("route.ts"));
  assert.deepEqual(routes, [
    "src/app/api/admin/access-events/route.ts",
    "src/app/api/admin/companies/[id]/route.ts",
    "src/app/api/admin/companies/route.ts",
    "src/app/api/admin/incidents/route.ts",
    "src/app/api/admin/operation-jobs/route.ts",
    "src/app/api/admin/overview/route.ts",
    "src/app/api/admin/saas-health/route.ts",
    "src/app/api/admin/service-health/route.ts",
    "src/app/api/admin/subscriptions/route.ts",
    "src/app/api/admin/support-tickets/route.ts",
    "src/app/api/admin/users/route.ts",
  ]);
  for (const file of routes) {
    const source = readFileSync(file, "utf8");
    const methods = [...source.matchAll(/export\s+(?:async\s+)?(?:function|const)\s+(GET|POST|PATCH|PUT|DELETE)\b/g)].map((match) => match[1]);
    assert.deepEqual(methods, ["GET"], file);
  }
});

test("ADMIN-1 impersonation : aucune surface admin ne change de session, de jeton ou d'entreprise", () => {
  const hits: string[] = [];
  for (const root of surfaces) {
    for (const file of filesUnder(root)) {
      const source = readFileSync(file, "utf8");
      for (const marker of [...markers, ...sessionWrites]) {
        if (marker.test(source)) hits.push(`${file} ${marker}`);
      }
    }
  }
  assert.deepEqual(hits, []);
});
