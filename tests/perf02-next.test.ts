import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import test from "node:test";
import { assertLocalPerf02Database } from "../scripts/perf02/local-database";
import { PERF02_NEXT_PAGES, measureHttpLevel, nextLocalEnv, runNextMeasure } from "../scripts/perf02/next-measure";

test("PERF-02 Next : l'environnement mesuré n'hérite d'aucun secret ni service réel", () => {
  const env = nextLocalEnv({
    PATH: "/usr/bin",
    HOME: "/home/test",
    DATABASE_URL: "postgresql://postgres:secret@aws-0-eu-west-3.pooler.supabase.com:6543/postgres",
    SUPABASE_SERVICE_ROLE_KEY: "real-service-role",
    STRIPE_SECRET_KEY: "sk_test_secret",
    NEXT_PUBLIC_SUPABASE_URL: "https://real.supabase.co",
  });
  assert.equal(assertLocalPerf02Database(env.DATABASE_URL).hostname, "127.0.0.1");
  assert.equal(env.DIRECT_URL, env.DATABASE_URL);
  assert.equal(new URL(env.NEXT_PUBLIC_SUPABASE_URL!).hostname.endsWith(".invalid"), true);
  assert.equal(new URL(env.NEXT_PUBLIC_APP_URL!).hostname, "127.0.0.1");
  assert.equal(env.PATH, "/usr/bin");
  assert.ok(!JSON.stringify(env).includes("secret") && !JSON.stringify(env).includes("real"));
  assert.ok(!("STRIPE_SECRET_KEY" in env));
});

test("PERF-02 Next : seules des routes publiques sont mesurées", () => {
  const protectedPrefixes = ["/admin", "/dashboard", "/onboarding", "/dispatch", "/driver", "/portal", "/settings", "/support", "/users", "/companies"];
  assert.ok(PERF02_NEXT_PAGES.length >= 6);
  for (const page of PERF02_NEXT_PAGES) {
    assert.ok(!protectedPrefixes.some((prefix) => page.path.startsWith(prefix)), page.path);
  }
});

test("PERF-02 Next : un niveau compte chaque statut, les échecs réseau et les percentiles", async () => {
  const server = createServer((request, response) => {
    response.statusCode = request.url === "/limited" ? 429 : 200;
    response.end("ok");
  });
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  try {
    const level = await measureHttpLevel(4, 10, (index) =>
      index === 9 ? Promise.reject(new Error("refused")) : fetch(`${base}/${index % 3 === 0 ? "limited" : "ok"}`)
    );
    assert.equal(level.requests, 10);
    assert.deepEqual(level.statuses, { "200": 6, "429": 3, network_error: 1 });
    assert.ok(level.p50Ms <= level.p95Ms && level.p95Ms <= level.maxMs);
    assert.ok(level.throughputPerSecond > 0);
  } finally {
    server.close();
  }
});

test("PERF-02 Next : une cible distante est refusée avant toute requête", async () => {
  await assert.rejects(runNextMeasure("https://preproduction.example.com"), /PERF02_REMOTE_TARGET_FORBIDDEN/);
});
