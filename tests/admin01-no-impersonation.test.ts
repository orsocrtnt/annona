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

// Exceptions, décision C10 : le super-administrateur crée et désactive les codes commerciaux,
// données de la plateforme et non d'une entreprise cliente (voir tests/sales01-admin-routes.test.ts).
const PLATFORM_WRITES: Record<string, string[]> = {
  "src/app/api/admin/sales-codes/[id]/route.ts": ["GET", "PATCH"],
  "src/app/api/admin/sales-codes/route.ts": ["GET", "POST"],
  // DEMO-LIVE : remise à neuf des démos, espaces de la plateforme (aucune entreprise cliente).
  "src/app/api/admin/demo-pool/route.ts": ["GET", "POST"],
  // Couper / rétablir l'accès d'un compte ou d'une entreprise (demande du propriétaire, 5 novembre 2026).
  "src/app/api/admin/users/[id]/access/route.ts": ["POST"],
  "src/app/api/admin/companies/[id]/access/route.ts": ["POST"],
  // ADMIN-ESPACE lot 2 : case « contacté » d'une inscription à la liste d'attente (donnée de la plateforme).
  "src/app/api/admin/waitlist/[id]/route.ts": ["PATCH"],
  // ADMIN-ESPACE lot 4 : pilotes accompagnés, suivi propre à la plateforme (l'entreprise liée n'est que lue).
  "src/app/api/admin/pilots/route.ts": ["GET", "POST"],
  "src/app/api/admin/pilots/[id]/route.ts": ["GET", "PATCH"],
  "src/app/api/admin/pilots/[id]/notes/route.ts": ["POST"],
  // ADMIN-ESPACE lot 5 : campagnes de prospection du propriétaire (données de la plateforme).
  "src/app/api/admin/campaigns/route.ts": ["GET", "POST"],
  "src/app/api/admin/campaigns/[id]/route.ts": ["GET", "PATCH"],
  "src/app/api/admin/campaigns/[id]/recipients/route.ts": ["POST"],
  "src/app/api/admin/campaigns/[id]/send/route.ts": ["POST"],
  "src/app/api/admin/campaigns/opt-outs/route.ts": ["POST"],
};

test("ADMIN-1 impersonation : les routes plateforme n'exportent que GET, hors codes commerciaux", () => {
  const routes = filesUnder("src/app/api/admin").filter((file) => file.endsWith("route.ts"));
  assert.deepEqual(routes, [
    "src/app/api/admin/access-events/route.ts",
    "src/app/api/admin/campaigns/[id]/recipients/route.ts",
    "src/app/api/admin/campaigns/[id]/route.ts",
    "src/app/api/admin/campaigns/[id]/send/route.ts",
    "src/app/api/admin/campaigns/opt-outs/route.ts",
    "src/app/api/admin/campaigns/route.ts",
    "src/app/api/admin/companies/[id]/access/route.ts",
    "src/app/api/admin/companies/[id]/route.ts",
    "src/app/api/admin/companies/route.ts",
    "src/app/api/admin/contact-messages/route.ts",
    "src/app/api/admin/demo-pool/route.ts",
    "src/app/api/admin/home/route.ts",
    "src/app/api/admin/incidents/route.ts",
    "src/app/api/admin/operation-jobs/route.ts",
    "src/app/api/admin/overview/route.ts",
    "src/app/api/admin/pilots/[id]/notes/route.ts",
    "src/app/api/admin/pilots/[id]/route.ts",
    "src/app/api/admin/pilots/route.ts",
    "src/app/api/admin/saas-health/route.ts",
    "src/app/api/admin/sales-codes/[id]/route.ts",
    "src/app/api/admin/sales-codes/route.ts",
    "src/app/api/admin/search/route.ts",
    "src/app/api/admin/service-health/route.ts",
    "src/app/api/admin/subscriptions/route.ts",
    "src/app/api/admin/support-tickets/route.ts",
    "src/app/api/admin/users/[id]/access/route.ts",
    "src/app/api/admin/users/route.ts",
    "src/app/api/admin/waitlist/[id]/route.ts",
    "src/app/api/admin/waitlist/export/route.ts",
    "src/app/api/admin/waitlist/funnel/route.ts",
    "src/app/api/admin/waitlist/route.ts",
  ]);
  for (const file of routes) {
    const source = readFileSync(file, "utf8");
    const methods = [...source.matchAll(/export\s+(?:async\s+)?(?:function|const)\s+(GET|POST|PATCH|PUT|DELETE)\b/g)].map((match) => match[1]);
    assert.deepEqual(methods, PLATFORM_WRITES[file] ?? ["GET"], file);
    if (file in PLATFORM_WRITES) assert.doesNotMatch(source, /companyId|prisma\./, `${file} ne touche aucune donnée d'entreprise`);
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
