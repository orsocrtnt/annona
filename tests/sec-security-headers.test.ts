import assert from "node:assert/strict";
import test from "node:test";
import { buildContentSecurityPolicy, buildSecurityHeaders } from "../src/lib/security/security-headers";
import nextConfig from "../next.config";

// SEC-5 : en-têtes de sécurité globaux ; CSP en Report-Only tant que la recette
// navigateur des cartes (OSM, OpenFreeMap, IGN, OSRM) n'est pas faite.
const ENV = {
  NEXT_PUBLIC_SUPABASE_URL: "https://abcd.supabase.co",
  NEXT_PUBLIC_MAP_TILE_URL: "https://data.geopf.fr/wmts?layer=PLAN&z={z}&x={x}&y={y}",
  NEXT_PUBLIC_MAP_STYLE_URL: "https://tiles.example-maps.test/styles/positron",
  NEXT_PUBLIC_OSRM_URL: "https://osrm.example-routing.test",
};
function directives(policy: string) {
  return new Map(policy.split(";").map((part) => part.trim()).filter(Boolean).map((part) => {
    const [name, ...values] = part.split(/\s+/);
    return [name!, values];
  }));
}

test("en-têtes de base : anti-iframe, nosniff, referrer, permissions minimales", () => {
  const headers = new Map(buildSecurityHeaders(ENV).map(({ key, value }) => [key, value]));
  assert.equal(headers.get("X-Frame-Options"), "DENY");
  assert.equal(headers.get("X-Content-Type-Options"), "nosniff");
  assert.equal(headers.get("Referrer-Policy"), "strict-origin-when-cross-origin");
  const permissions = headers.get("Permissions-Policy") ?? "";
  assert.match(permissions, /geolocation=\(self\)/);
  assert.match(permissions, /microphone=\(\)/);
  assert.match(permissions, /payment=\(\)/);
  assert.ok(headers.has("Content-Security-Policy-Report-Only"));
  assert.ok(!headers.has("Content-Security-Policy"), "CSP bloquante interdite avant recette navigateur");
});

test("CSP : domaines réellement utilisés autorisés, rien de plus large", () => {
  const csp = directives(buildContentSecurityPolicy(ENV));
  assert.deepEqual(csp.get("default-src"), ["'self'"]);
  assert.deepEqual(csp.get("frame-ancestors"), ["'none'"]);
  assert.deepEqual(csp.get("object-src"), ["'none'"]);
  assert.deepEqual(csp.get("base-uri"), ["'self'"]);
  const connect = csp.get("connect-src") ?? [];
  for (const origin of ["https://abcd.supabase.co", "wss://abcd.supabase.co", "https://osrm.example-routing.test", "https://tiles.example-maps.test", "https://data.geopf.fr"]) {
    assert.ok(connect.includes(origin), `connect-src ${origin}`);
  }
  const img = csp.get("img-src") ?? [];
  for (const origin of ["https://data.geopf.fr", "https://tiles.example-maps.test", "https://*.supabase.co", "data:", "blob:"]) {
    assert.ok(img.includes(origin), `img-src ${origin}`);
  }
  assert.ok((csp.get("worker-src") ?? []).includes("blob:"));
  for (const [name, values] of csp) assert.ok(!values.includes("*") && !values.includes("https:"), `${name} trop large`);
});

test("CSP par défaut : OSM, OpenFreeMap et OSRM publics quand aucune variable n'est fournie", () => {
  const csp = directives(buildContentSecurityPolicy({}));
  const connect = csp.get("connect-src") ?? [];
  const img = csp.get("img-src") ?? [];
  assert.ok(img.includes("https://tile.openstreetmap.org"));
  assert.ok(connect.includes("https://tiles.openfreemap.org"));
  assert.ok(connect.includes("https://router.project-osrm.org"));
  assert.ok(!connect.some((value) => value.includes("undefined")));
});

test("CSP : URL de variable invalide ignorée, pas de source fantaisiste", () => {
  const csp = buildContentSecurityPolicy({ NEXT_PUBLIC_OSRM_URL: "pas une url", NEXT_PUBLIC_SUPABASE_URL: "javascript:alert(1)" });
  assert.doesNotMatch(csp, /pas|javascript|undefined|null/);
});

test("next.config : en-têtes appliqués à toutes les routes", async () => {
  assert.equal(typeof nextConfig.headers, "function");
  const rules = await nextConfig.headers!();
  const all = rules.find((rule) => rule.source === "/:path*");
  assert.ok(all, "règle globale");
  const keys = all!.headers.map((header) => header.key);
  for (const key of ["X-Frame-Options", "X-Content-Type-Options", "Referrer-Policy", "Permissions-Policy", "Content-Security-Policy-Report-Only"]) {
    assert.ok(keys.includes(key), key);
  }
});
