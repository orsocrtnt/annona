import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { NextResponse } from "next/server";
import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { prisma } from "../src/services/prisma/client";
import { getDriverStats } from "../src/domains/delivery/delivery.service";
import { getClientOrderStats, getCompanyOrderStats } from "../src/domains/order/order.service";
import { getUserByAuthId } from "../src/domains/user/user.service";
import { resolveDatabaseUrl } from "../src/lib/database/connection-url";
import { OPERATIONAL_QUERY_DEFAULTS, QUERY_STALE_MS } from "../src/lib/query/defaults";

function replace(t: TestContext, obj: object, key: string, fn: unknown) {
  const previous = Reflect.get(obj, key); Reflect.set(obj, key, fn);
  t.after(() => { Reflect.set(obj, key, previous); });
}
const databaseUrl = "postgresql://fixture:secret@example.pooler.supabase.com:6543/postgres?pgbouncer=true";
test("pool : cinq lectures simultanées en production, limite explicite conservée", () => {
  assert.equal(new URL(resolveDatabaseUrl({ DATABASE_URL: databaseUrl, NODE_ENV: "production" })!).searchParams.get("connection_limit"), "5");
  assert.equal(new URL(resolveDatabaseUrl({ DATABASE_URL: databaseUrl + "&connection_limit=1", NODE_ENV: "production" })!).searchParams.get("connection_limit"), "1");
  assert.equal(new URL(resolveDatabaseUrl({ DATABASE_URL: databaseUrl, DATABASE_CONNECTION_LIMIT: "2" })!).searchParams.get("connection_limit"), "2");
  for (const value of ["0", "11", "abc", "-1"]) {
    assert.throws(() => resolveDatabaseUrl({ DATABASE_URL: databaseUrl, DATABASE_CONNECTION_LIMIT: value }));
    assert.throws(() => resolveDatabaseUrl({ DATABASE_URL: databaseUrl + "&connection_limit=" + value }));
  }
});
test("pool : aucun changement de fournisseur/mode implicite, session seulement explicite", () => {
  const transaction = new URL(resolveDatabaseUrl({ DATABASE_URL: databaseUrl })!);
  assert.equal(transaction.port, "6543"); assert.equal(transaction.searchParams.get("pgbouncer"), "true");
  const session = new URL(resolveDatabaseUrl({ DATABASE_URL: databaseUrl, DATABASE_CONNECTION_MODE: "session" })!);
  assert.equal(session.port, "5432"); assert.equal(session.searchParams.has("pgbouncer"), false);
  assert.equal(session.username, transaction.username); assert.equal(session.password, transaction.password);
  assert.throws(() => resolveDatabaseUrl({ DATABASE_URL: "postgresql://fixture:secret@elsewhere.test:6543/db", DATABASE_CONNECTION_MODE: "session" }));
  assert.equal(resolveDatabaseUrl({}), undefined);
});
test("auth : une lecture relationnelle fraîche par appel, permissions et suspension sans cache", async (t) => {
  let version = 1; let reads = 0;
  replace(t, prisma.user, "findUnique", async (args: { relationLoadStrategy?: string; where: { authId: string } }) => {
    assert.equal(args.relationLoadStrategy, undefined); assert.equal(args.where.authId, "fixture"); reads++;
    return { id: "u", status: version === 1 ? "ACTIVE" : "SUSPENDED", settings: { version }, company: { status: "ACTIVE" }, role: { permissions: [{ permission: { slug: version === 1 ? "orders:read" : "users:read" } }] } };
  });
  const first = await getUserByAuthId("fixture"); version++;
  const second = await getUserByAuthId("fixture");
  assert.equal(first!.role.permissions[0]!.slug, "orders:read");
  assert.equal(second!.role.permissions[0]!.slug, "users:read");
  assert.equal(second!.status, "SUSPENDED"); assert.equal(reads, 2);
});
test("auth : compte inconnu et erreur base ne réutilisent aucune ancienne autorisation", async (t) => {
  let unavailable = false;
  replace(t, prisma.user, "findUnique", async () => { if (unavailable) throw new Error("DATABASE_UNAVAILABLE"); return null; });
  assert.equal(await getUserByAuthId("unknown"), null);
  unavailable = true;
  await assert.rejects(getUserByAuthId("fixture"), /DATABASE_UNAVAILABLE/);
});
function sessionRoute(auth: unknown) {
  let calls = 0; const module = { exports: {} as { GET: () => Promise<Response> } };
  const dependencies: Record<string, unknown> = {
    "next/server": { NextResponse, after: () => undefined },
    "@/lib/api/server-auth": { getServerAuth: async () => { calls++; return auth; } },
    "@/lib/demo/constants": { demoPersonaForRole: (role: string) => role === "DRIVER" ? "driver" : "admin", DEMO_LOGIN_EMAIL: "demo@fixture.invalid" },
    "@/domains/saas/saas-session": { getSessionSaasAccess: async () => null },
  };
  const source = ts.transpileModule(readFileSync("src/app/api/auth/session/route.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  runInNewContext(source, { exports: module.exports, module, require: (id: string) => { assert.ok(id in dependencies, `Lecture supplémentaire interdite : ${id}`); return dependencies[id]; } });
  return { route: module.exports, calls: () => calls };
}
test("session : aucune relecture du profil hors démo ou pour une persona démo", async () => {
  for (const isDemoSession of [false, true]) {
    const e = sessionRoute({ user: { id: "u", role: { systemRole: "DRIVER" } }, permissions: ["dashboard:driver"], isDemoSession });
    const res = await e.route.GET(); const json = await res.json();
    assert.equal(e.calls(), 1); assert.equal(res.status, 200);
    assert.equal(json.demo?.persona ?? null, isDemoSession ? "driver" : null);
    assert.deepEqual(json.permissions, ["dashboard:driver"]);
  }
  const e = sessionRoute(null); assert.equal((await (await e.route.GET()).json()).user, null);
});
test("cache : retour après péremption recharge, données fraîches dédupliquées", async () => {
  const client = new QueryClient({ defaultOptions: { queries: { ...OPERATIONAL_QUERY_DEFAULTS, retry: false } } });
  let reads = 0; const queryKey = ["fixture", "orders"];
  const options = { queryKey, queryFn: async () => ({ version: ++reads }) };
  await client.fetchQuery(options);
  const fresh = new QueryObserver(client, options); const unFresh = fresh.subscribe(() => {});
  await new Promise((resolve) => setImmediate(resolve)); assert.equal(reads, 1); unFresh();
  client.setQueryData(queryKey, { version: 1 }, { updatedAt: Date.now() - QUERY_STALE_MS - 1 });
  const stale = new QueryObserver(client, options); const unStale = stale.subscribe(() => {});
  await new Promise((resolve) => setImmediate(resolve)); assert.equal(reads, 2);
  assert.equal(client.getQueryData<{ version: number }>(queryKey)!.version, 2);
  unStale(); client.clear();
});
test("cache : mutation invalide aussi une page inactive ; retour et changement de compte sans ancien résultat", async () => {
  const client = new QueryClient({ defaultOptions: { queries: OPERATIONAL_QUERY_DEFAULTS } });
  let value = "avant"; const options = { queryKey: ["company", "orders"], queryFn: async () => value };
  await client.fetchQuery(options); value = "après";
  await client.invalidateQueries({ queryKey: ["company"] });
  const observer = new QueryObserver(client, options); const unsubscribe = observer.subscribe(() => {});
  await new Promise((resolve) => setImmediate(resolve)); assert.equal(client.getQueryData(options.queryKey), "après");
  unsubscribe(); client.clear(); assert.equal(client.getQueryData(options.queryKey), undefined);
});
test("connexion démo : préparer une session isolée puis résoudre son administrateur", async () => {
  const module = { exports: {} as { POST: (request: Request) => Promise<Response> } };
  const user = { id: "demo", companyId: "company", company: { isDemo: true }, role: { systemRole: "COMPANY_ADMIN" }, settings: {} };
  let cookieWrites = 0;
  let cookieClears = 0;
  let signOuts = 0;
  let sessionPreparations = 0;
  let poolUnavailable = false;
  let resolvedCompanyId: string | null = null;
  const sessionOptions: unknown[] = [];
  class DemoPoolUnavailableError extends Error {
    code = "DEMO_POOL_BUSY";
    retryAfterSeconds = 5;
  }
  const dependencies: Record<string, unknown> = {
    "next/server": { NextResponse, after: () => undefined },
    "@/lib/auth/account-access": { assertAccountActive: () => {}, AccountUnavailableError: class extends Error {} },
    "@/lib/validations/auth": { loginSchema: { safeParse: () => ({ success: true, data: { email: "demo@fixture.invalid", password: "fixture-password" } }) } },
    "@/lib/auth/normalize-email": { normalizeEmail: (value: string) => value },
    "@/services/supabase/server": { createClient: async () => ({ auth: {
      signInWithPassword: async () => ({ data: { user: { id: "auth", email: "demo@fixture.invalid", email_confirmed_at: "2026-10-15", user_metadata: {} } } }),
      signOut: async () => { signOuts++; },
    } }) },
    "@/domains/onboarding/onboarding.service": { resolveOnboardingLoginPath: async (_user: unknown, path: string) => path },
    "@/domains/auth/auth.service": { syncUserFromSupabase: async () => user, getDashboardPathForRole: () => "/dashboard", UserNotProvisionedError: class extends Error {} },
    "@/domains/user/user.service": {
      extractPermissionSlugs: () => ["orders:read"],
      getUserByAuthId: async () => user,
      updateLastLogin: async () => undefined,
    },
    "@/lib/demo/constants": { isDemoLoginEmail: () => true, DEMO_LOGIN_EMAIL: "demo@fixture.invalid" },
    "@/lib/demo/persona-cookie": {
      setDemoPersonaCookie: async () => { cookieWrites++; },
      clearDemoPersonaCookie: async () => { cookieClears++; },
      clearDemoSessionCookie: async () => { cookieClears++; },
    },
    "@/domains/demo/demo-auth.service": {
      resolveDemoActiveUser: async (_user: unknown, _persona: unknown, companyId: string) => {
        resolvedCompanyId = companyId;
        return user;
      },
    },
    "@/domains/demo/demo-session.service": {
      ensureDemoSessionForLogin: async (_base: string, _key: string | undefined, options: unknown) => {
        sessionOptions.push(options);
        sessionPreparations++;
        if (poolUnavailable) throw new DemoPoolUnavailableError();
        return "session-company";
      },
    },
    "@/domains/demo/demo-pool.service": {
      DemoPoolUnavailableError,
      maintainDemoPool: async () => [],
      requestDemoPoolRecycle: async () => true,
      recycleDemoPoolEnvironment: async () => ({ status: "recycled" }),
    },
    "@/domains/saas/saas-session": { getSessionSaasAccess: async () => null },
  };
  const source = ts.transpileModule(readFileSync("src/app/api/auth/login/route.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  runInNewContext(source, { exports: module.exports, module, console, require: (id: string) => { assert.ok(id in dependencies, `Aucune dépendance reset/seed autorisée au login : ${id}`); return dependencies[id]; } });
  const response = await module.exports.POST(new Request("https://fixture.invalid/api/auth/login", { method: "POST", body: "{}" }));
  assert.equal(response.status, 200); assert.equal(cookieWrites, 1);
  assert.equal(sessionPreparations, 1); assert.equal(resolvedCompanyId, "session-company");
  assert.equal((await response.json()).demo.persona, "admin");
  user.company.isDemo = false;
  const missing = await module.exports.POST(new Request("https://fixture.invalid/api/auth/login", { method: "POST", body: "{}" }));
  assert.equal(missing.status, 503); assert.equal(cookieWrites, 1); assert.equal(sessionPreparations, 2);
  assert.equal(signOuts, 1); assert.equal(cookieClears, 2);
  user.company.isDemo = true; poolUnavailable = true;
  const busy = await module.exports.POST(new Request("https://fixture.invalid/api/auth/login", { method: "POST", body: "{}" }));
  assert.equal(busy.status, 503); assert.equal(sessionPreparations, 3);
  assert.equal(signOuts, 2); assert.equal(cookieClears, 4);

  // Décision C10 : seule une recette qui l'annonce explicitement obtient une location d'une heure.
  poolUnavailable = false;
  for (const body of ['{"demoTestSession":true}', '{"demoTestSession":"true"}']) {
    const flagged = await module.exports.POST(new Request("https://fixture.invalid/api/auth/login", { method: "POST", body }));
    assert.equal(flagged.status, 200);
  }
  assert.deepEqual(JSON.parse(JSON.stringify(sessionOptions)), [
    { testSession: false },
    { testSession: false },
    { testSession: false },
    { testSession: true },
    { testSession: false },
  ]);
});

test("compteurs agrégés : états actifs, date logistique, client/entreprise restent isolés", async (t) => {
  const now = new Date(); const today = new Date(now); today.setHours(0, 0, 0, 0);
  const rows = [
    ...["PENDING", "ASSIGNED", "PURCHASING", "IN_DELIVERY", "FAILED", "CANCELLED"].map((status) => ({ status, completedAt: null, driverId: "driver", customerId: "client", companyId: "a" })),
    { status: "DELIVERED", completedAt: today, driverId: "driver", customerId: "client", companyId: "a" },
    { status: "DELIVERED", completedAt: new Date(2000, 0, 1), driverId: "driver", customerId: "client", companyId: "a" },
    { status: "ASSIGNED", completedAt: null, driverId: "other", customerId: "other", companyId: "b" },
  ];
  function matches(row: Record<string, unknown>, where: Record<string, unknown>): boolean {
    return Object.entries(where).every(([key, value]) => {
      if (key === "OR") return (value as Record<string, unknown>[]).some((part) => matches(row, part));
      if (value && typeof value === "object" && "in" in value) return (value.in as unknown[]).includes(row[key]);
      if (value && typeof value === "object" && "gte" in value) return row[key] != null && +(row[key] as Date) >= +(value.gte as Date);
      return row[key] === value;
    });
  }
  let deliveryReads = 0;
  replace(t, prisma.delivery, "groupBy", async ({ where }: { where: Record<string, unknown> }) => {
    deliveryReads++; const groups = new Map<string, number>();
    for (const row of rows.filter((r) => matches(r, where))) groups.set(row.status, (groups.get(row.status) ?? 0) + 1);
    return [...groups].map(([status, count]) => ({ status, _count: { _all: count } }));
  });
  replace(t, prisma.order, "groupBy", async ({ where }: { where: Record<string, unknown> }) => {
    assert.equal(where.customerId, "client"); assert.equal(where.companyId, "a");
    return [{ status: "PENDING", _count: { _all: 2 } }, { status: "CANCELLED", _count: { _all: 3 } }];
  });
  replace(t, prisma.order, "count", async ({ where }: { where: Record<string, unknown> }) => { assert.equal(where.companyId, "a"); return 2; });
  replace(t, prisma.delivery, "findFirst", async () => null);
  assert.deepEqual(await getDriverStats("driver"), { assigned: 1, inTransit: 2, deliveredToday: 1 });
  assert.deepEqual(await getCompanyOrderStats("a"), { pendingOrders: 2, activeDeliveries: 3, deliveredToday: 1, unassigned: 1 });
  assert.deepEqual(await getClientOrderStats("client", "a"), { activeOrders: 2, orderCount: 5, inDelivery: 3, deliveredThisMonth: 1, nextDeliveryEta: null });
  assert.equal(deliveryReads, 3);
});
test("réglages réutilisés du contexte : nouveaux droits et valeurs relus à chaque requête", async () => {
  let denied = false; let version = 1; let checks = 0;
  const requireRole = async () => { checks++; return denied ? { error: NextResponse.json({ error: "refus" }, { status: 403 }) } : { context: { user: { companyId: "a", company: { settings: { dispatchRules: { version }, locationTracking: { version } } } } } }; };
  for (const file of ["dispatch/overview", "driver/location/settings"]) {
    const module = { exports: {} as { GET: (request?: Request) => Promise<Response> } };
    const deps: Record<string, unknown> = {
      "next/server": { NextResponse },
      "@/lib/api/auth-guard": { requireStaffRole: requireRole, requireDriverRole: requireRole, requireRole: () => null, getCompanyId: () => "a" },
      "@/lib/api/route-handler": { withApiHandler: (fn: () => unknown) => fn() },
      "@/domains/delivery/delivery.service": { getCompanyDeliveries: async () => [], getDriverDispatchWorkload: async () => [] },
      "@/domains/order/order.service": { getCompanyOrderStats: async () => ({}) },
      "@/domains/company/dispatch-settings.service": { parseDispatchSettings: (raw: unknown) => raw },
      "@/domains/company/location-settings.service": { parseLocationSettings: (raw: unknown) => raw },
    };
    const source = ts.transpileModule(readFileSync(`src/app/api/${file}/route.ts`, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
    runInNewContext(source, { exports: module.exports, module, URL, require: (id: string) => { assert.ok(id in deps, `I/O inattendue : ${id}`); return deps[id]; } });
    denied = false; version = 1;
    const routeRequest = new Request(`http://local/api/${file}`);
    const data1 = (await (await module.exports.GET(routeRequest)).json()).data;
    version = 2;
    const data2 = (await (await module.exports.GET(routeRequest)).json()).data;
    assert.equal((file.startsWith("dispatch") ? data1.settings : data1).version, 1);
    assert.equal((file.startsWith("dispatch") ? data2.settings : data2).version, 2);
    denied = true; assert.equal((await module.exports.GET(routeRequest)).status, 403);
  }
  assert.equal(checks, 6);
});
test("photo différée : propriétaire/entreprise relus, URL privée seulement après autorisation", async () => {
  const module = { exports: {} as { GET: (request: Request, params: { params: Promise<{ id: string }> }) => Promise<Response> } };
  let denied = true; let owned = false; let reads = 0; let signs = 0;
  const deps: Record<string, unknown> = {
    "next/server": { NextResponse },
    "@/lib/api/auth-guard": { requireDriverRole: async () => denied ? { error: new Response(null, { status: 401 }) } : { context: { user: { id: "driver", companyId: "a" } } } },
    "@/services/prisma/client": { prisma: { delivery: { findFirst: async ({ where }: { where: Record<string, string> }) => { reads++; assert.equal(JSON.stringify(where), JSON.stringify({ id: "mission", driverId: "driver", companyId: "a" })); return owned ? { podPhotoPath: "private" } : null; } } } },
    "@/lib/storage/pod": { getPodPhotoSignedUrl: async () => { signs++; return "https://storage.fixture.invalid/signed"; } },
  };
  const source = ts.transpileModule(readFileSync("src/app/api/driver/missions/[id]/proof/route.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  runInNewContext(source, { exports: module.exports, module, encodeURIComponent, require: (id: string) => { assert.ok(id in deps); return deps[id]; } });
  const request = new Request("https://fixture.invalid"); const params = { params: Promise.resolve({ id: "mission" }) };
  assert.equal((await module.exports.GET(request, params)).status, 401); assert.equal(reads, 0);
  denied = false; assert.equal((await module.exports.GET(request, params)).status, 404); assert.equal(signs, 0);
  owned = true; const response = await module.exports.GET(request, params);
  assert.equal(response.status, 307); assert.equal(response.headers.get("cache-control"), "private, no-store"); assert.equal(signs, 1);
});
test("liste missions : aucune dépendance à la signature Storage lente", async () => {
  const module = { exports: {} as { GET: () => Promise<Response> } };
  const deps: Record<string, unknown> = {
    "next/server": { NextResponse },
    "@/lib/api/auth-guard": { requireDriverRole: async () => ({ context: { user: { id: "driver", companyId: "a", company: { settings: {} } } } }) },
    "@/domains/delivery/delivery.service": { getDriverMissions: async () => [{ id: "mission", podPhotoPath: "private" }], getAvailableDeliveriesForDriver: async () => [], getDriverStats: async () => ({}) },
    "@/domains/company/dispatch-settings.service": { parseDispatchSettings: () => ({}) },
    "@/lib/storage/pod": { isPodPhotoPathForDelivery: () => true, getPodPhotoSignedUrl: () => assert.fail("Storage ne doit pas être appelé pour lire la liste") },
  };
  const source = ts.transpileModule(readFileSync("src/app/api/driver/missions/route.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  runInNewContext(source, { exports: module.exports, module, encodeURIComponent, require: (id: string) => { assert.ok(id in deps); return deps[id]; } });
  const json = await (await module.exports.GET()).json();
  assert.equal(json.data.missions[0].podPhotoUrl, "/api/driver/missions/mission/proof");
  assert.equal("podPhotoPath" in json.data.missions[0], false);
});
