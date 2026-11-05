import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { NextResponse } from "next/server";
import {
  COMPANY_TEAM_LIMIT,
  getPlatformCompanyFile,
  parisMonthBounds,
  readCompanyActivity,
  summarizeDeliveries,
  summarizeInvoices,
  summarizeRoles,
  type CompanyFileDatabase,
} from "../src/domains/admin/company-file.service";
import {
  ADMIN_SEARCH_PER_GROUP,
  adminSearchQueries,
  allowAdminSearch,
  escapeLike,
  parseAdminSearchParams,
  searchPlatform,
  searchTokens,
  type AdminSearchDatabase,
} from "../src/domains/admin/search.service";
import { createFunnelSourceLimiter } from "../src/domains/growth/waitlist-funnel.service";
import { WAITLIST_MESSAGE } from "../src/domains/growth/contact.service";
import type { PlatformCompanyDetail } from "../src/domains/admin/companies.service";

/* ====================== Fiche entreprise ====================== */

const NOW = new Date("2026-11-05T12:00:00.000Z");

test("ADMIN-ESPACE fiche : mois civil de Paris, changement d'heure et passage de minuit compris", () => {
  const november = parisMonthBounds(NOW);
  assert.equal(november.startsAt.toISOString(), "2026-10-31T23:00:00.000Z");
  assert.equal(november.endsAt.toISOString(), "2026-11-30T23:00:00.000Z");
  // 1er novembre 00:30 à Paris = 31 octobre 23:30 UTC : déjà novembre.
  assert.equal(parisMonthBounds(new Date("2026-10-31T23:30:00.000Z")).startsAt.toISOString(), "2026-10-31T23:00:00.000Z");
  // Octobre commence à l'heure d'été (UTC+2) et finit à l'heure d'hiver.
  const october = parisMonthBounds(new Date("2026-10-15T12:00:00.000Z"));
  assert.equal(october.startsAt.toISOString(), "2026-09-30T22:00:00.000Z");
  assert.equal(october.endsAt.toISOString(), "2026-10-31T23:00:00.000Z");
  const december = parisMonthBounds(new Date("2026-12-31T22:59:00.000Z"));
  assert.equal(december.endsAt.toISOString(), "2026-12-31T23:00:00.000Z");
});

test("ADMIN-ESPACE fiche : rôles, livraisons et factures agrégés sans chiffre inventé", () => {
  const roles = summarizeRoles(
    [
      { roleId: "r-driver", status: "ACTIVE", _count: { _all: 3 }, _max: { lastLoginAt: new Date("2026-11-04T08:00:00.000Z") } },
      { roleId: "r-driver", status: "PENDING_VERIFICATION", _count: { _all: 1 }, _max: { lastLoginAt: null } },
      { roleId: "r-driver", status: "SUSPENDED", _count: { _all: 2 }, _max: { lastLoginAt: new Date("2026-11-05T08:00:00.000Z") } },
      { roleId: "r-admin", status: "ACTIVE", _count: { _all: 1 }, _max: { lastLoginAt: null } },
      { roleId: "r-unknown", status: "ACTIVE", _count: { _all: 9 }, _max: { lastLoginAt: null } },
    ],
    [{ id: "r-driver", systemRole: "DRIVER" }, { id: "r-admin", systemRole: "COMPANY_ADMIN" }]
  );
  assert.deepEqual(roles, [
    { role: "COMPANY_ADMIN", total: 1, seated: 1, lastLoginAt: null },
    { role: "DRIVER", total: 6, seated: 4, lastLoginAt: "2026-11-05T08:00:00.000Z" },
  ]);

  assert.deepEqual(
    summarizeDeliveries(
      [
        { status: "PENDING", _count: { _all: 2 } },
        { status: "IN_DELIVERY", _count: { _all: 1 } },
        { status: "DELIVERED", _count: { _all: 4 } },
        { status: "PAID", _count: { _all: 1 } },
        { status: "FAILED", _count: { _all: 1 } },
        { status: "CANCELLED", _count: { _all: 2 } },
      ],
      3
    ),
    { created: 11, inProgress: 3, done: 5, failed: 1, cancelled: 2, delivered: 3 }
  );

  assert.deepEqual(
    summarizeInvoices([
      { status: "PAID", _count: { _all: 2 }, _sum: { amount: "120.50" } },
      { status: "PENDING", _count: { _all: 1 }, _sum: { amount: 30 } },
      { status: "OVERDUE", _count: { _all: 1 }, _sum: { amount: null } },
      // Exclues même si la base les renvoyait : brouillon et annulée ne sont pas des factures émises.
      { status: "DRAFT", _count: { _all: 5 }, _sum: { amount: "999" } },
      { status: "CANCELLED", _count: { _all: 5 }, _sum: { amount: "999" } },
    ]),
    { count: 4, paidCents: 12050, pendingCents: 3000, overdueCents: 0 }
  );
});

type Call = { model: string; method: string; args: Record<string, unknown> };

function fakeCompanyDb(calls: Call[], failing: string[] = []): CompanyFileDatabase {
  const track = <T>(model: string, method: string, result: T) => async (args: Record<string, unknown>) => {
    calls.push({ model, method, args });
    if (failing.includes(`${model}.${method}`)) throw new Error("boom");
    return result;
  };
  return {
    user: {
      groupBy: track("user", "groupBy", [
        { roleId: "r-driver", status: "ACTIVE" as const, _count: { _all: 2 }, _max: { lastLoginAt: new Date("2026-11-04T08:00:00.000Z") } },
      ]),
      findMany: track("user", "findMany", Array.from({ length: COMPANY_TEAM_LIMIT + 1 }, (_, index) => ({
        id: `u${index}`, firstName: "Ada", lastName: `L${index}`, status: "ACTIVE" as const, lastLoginAt: null, role: { systemRole: "DRIVER" as const },
      }))),
    },
    role: { findMany: track("role", "findMany", [{ id: "r-driver", systemRole: "DRIVER" as const }]) },
    delivery: {
      groupBy: track("delivery", "groupBy", [{ status: "DELIVERED", _count: { _all: 2 } }]),
      count: track("delivery", "count", 2),
      findMany: track("delivery", "findMany", [{ completedAt: new Date("2026-11-05T09:00:00.000Z") }, { completedAt: null }]),
    },
    order: {
      findMany: track("order", "findMany", [
        { createdAt: new Date("2026-11-04T23:30:00.000Z") }, // 5 novembre à Paris
        { createdAt: new Date("2026-10-01T10:00:00.000Z") }, // hors des 30 jours : ignorée
      ]),
    },
    invoice: { groupBy: track("invoice", "groupBy", [{ status: "PAID" as const, _count: { _all: 1 }, _sum: { amount: "10" } }]) },
    supportTicket: {
      count: track("supportTicket", "count", 1),
      findMany: track("supportTicket", "findMany", [
        { id: "t1", subject: "Colis abîmé", status: "OPEN", priority: "HIGH", createdAt: new Date("2026-11-03T10:00:00.000Z") },
      ]),
    },
    orderMessage: { findMany: track("orderMessage", "findMany", []) },
  };
}

test("ADMIN-ESPACE fiche : lecture bornée à l'entreprise et au mois, select minimal", async () => {
  const calls: Call[] = [];
  const activity = await readCompanyActivity("company-1", fakeCompanyDb(calls), NOW);
  const month = parisMonthBounds(NOW);

  // Requêtes groupées : 12 lectures au plus, quel que soit le nombre de lignes (aucun N+1).
  assert.ok(calls.length <= 12, `${calls.length} lectures`);
  for (const call of calls) {
    const where = JSON.stringify(call.args.where);
    assert.ok(where.includes("company-1"), `${call.model}.${call.method} borné à l'entreprise`);
  }
  const byKey = (key: string) => calls.filter((call) => `${call.model}.${call.method}` === key).map((call) => call.args);
  const [deliveryGroup] = byKey("delivery.groupBy");
  assert.deepEqual((deliveryGroup!.where as { createdAt: unknown }).createdAt, { gte: month.startsAt, lt: month.endsAt });
  const [deliveredCount] = byKey("delivery.count");
  assert.deepEqual(deliveredCount!.where, { companyId: "company-1", status: "DELIVERED", completedAt: { gte: month.startsAt, lt: month.endsAt } });
  const [invoices] = byKey("invoice.groupBy");
  assert.deepEqual(invoices!.where, { companyId: "company-1", createdAt: { gte: month.startsAt, lt: month.endsAt }, status: { in: ["PENDING", "PAID", "OVERDUE"] } });
  const [team] = byKey("user.findMany");
  assert.equal(team!.take, COMPANY_TEAM_LIMIT + 1);
  assert.deepEqual(team!.where, { companyId: "company-1", role: { systemRole: { not: "CLIENT" } } });
  const [tickets] = byKey("supportTicket.findMany");
  assert.equal(tickets!.take, 5);
  assert.deepEqual((tickets!.where as { status: unknown }).status, { in: ["OPEN", "IN_PROGRESS"] });
  const [incidents] = byKey("orderMessage.findMany");
  assert.deepEqual((incidents!.where as { order: unknown }).order, { companyId: "company-1" });

  // Aucun champ sensible lu : ni e-mail, ni téléphone, ni identifiant de connexion, ni corps de message.
  const selects = JSON.stringify(calls.map((call) => call.args.select ?? null));
  for (const forbidden of ["email", "phone", "authId", "settings", "\"message\"", "body", "avatarUrl"]) {
    assert.equal(selects.includes(forbidden), false, forbidden);
  }

  assert.deepEqual(activity.month, { startsAt: month.startsAt.toISOString(), endsAt: month.endsAt.toISOString() });
  assert.equal(activity.users?.team.length, COMPANY_TEAM_LIMIT);
  assert.equal(activity.users?.teamTruncated, true);
  assert.deepEqual(Object.keys(activity.users!.team[0]!).sort(), ["id", "lastLoginAt", "name", "role", "status"]);
  assert.deepEqual(activity.users?.byRole, [{ role: "DRIVER", total: 2, seated: 2, lastLoginAt: "2026-11-04T08:00:00.000Z" }]);
  assert.equal(activity.deliveries?.delivered, 2);
  assert.equal(activity.invoices?.paidCents, 1000);
  assert.deepEqual(activity.support, {
    open: 1,
    latest: [{ id: "t1", subject: "Colis abîmé", status: "OPEN", priority: "HIGH", createdAt: "2026-11-03T10:00:00.000Z" }],
  });
  assert.deepEqual(activity.incidents, { open: 0 });
  assert.equal(activity.series?.length, 30);
  assert.deepEqual(activity.series?.at(-1), { day: "2026-11-05", orders: 1, delivered: 1 });
  assert.equal(activity.series?.reduce((sum, day) => sum + day.orders, 0), 1);
});

test("ADMIN-ESPACE fiche : un bloc illisible devient « indisponible » sans faire tomber les autres", async () => {
  const activity = await readCompanyActivity("company-1", fakeCompanyDb([], ["invoice.groupBy", "role.findMany", "orderMessage.findMany"]), NOW);
  assert.equal(activity.invoices, null);
  assert.equal(activity.users, null);
  assert.equal(activity.incidents, null);
  assert.notEqual(activity.deliveries, null);
  assert.notEqual(activity.support, null);
  assert.notEqual(activity.series, null);
});

test("ADMIN-ESPACE fiche : entreprise absente = aucune lecture d'activité", async () => {
  const calls: Call[] = [];
  assert.equal(await getPlatformCompanyFile("missing", { db: fakeCompanyDb(calls), readDetail: async () => null, now: NOW }), null);
  assert.deepEqual(calls, []);
  const detail = { id: "company-1", name: "Acme" } as PlatformCompanyDetail;
  const file = await getPlatformCompanyFile("company-1", { db: fakeCompanyDb(calls), readDetail: async () => detail, now: NOW });
  assert.equal(file?.name, "Acme");
  assert.equal(file?.activity.generatedAt, NOW.toISOString());
});

/* ====================== Recherche globale ====================== */

test("ADMIN-ESPACE recherche : q de 2 à 80 caractères, paramètres stricts", () => {
  const error = (search: URLSearchParams) => "error" in parseAdminSearchParams(search);
  assert.equal(error(new URLSearchParams()), true);
  assert.equal(error(new URLSearchParams({ q: "a" })), true);
  assert.equal(error(new URLSearchParams({ q: "   a   " })), true);
  assert.equal(error(new URLSearchParams({ q: "x".repeat(81) })), true);
  assert.equal(error(new URLSearchParams({ q: "ab", page: "1" })), true);
  assert.equal(error(new URLSearchParams([["q", "ab"], ["q", "cd"]])), true);
  assert.deepEqual(parseAdminSearchParams(new URLSearchParams({ q: "x".repeat(80) })), { query: { q: "x".repeat(80) } });
  assert.deepEqual(parseAdminSearchParams(new URLSearchParams({ q: "  Ada \t\n Lovelace " })), { query: { q: "Ada Lovelace" } });
  assert.deepEqual(parseAdminSearchParams(new URLSearchParams({ q: "a\u0000b" })), { query: { q: "a b" } });
});

test("ADMIN-ESPACE recherche : jokers LIKE échappés, mots en minuscules, 5 au plus", () => {
  assert.equal(escapeLike("50%_a\\b"), "50\\%\\_a\\\\b");
  assert.deepEqual(searchTokens("Ada ADA lovelace"), ["ada", "lovelace"]);
  assert.deepEqual(searchTokens("a b c d e f g"), ["a", "b", "c", "d", "e"]);
  assert.deepEqual(searchTokens("100%"), ["100\\%"]);
});

test("ADMIN-ESPACE recherche : requêtes bornées à 6 lignes, sans champ sensible", () => {
  const queries = adminSearchQueries("Ada%");
  for (const [type, query] of Object.entries(queries)) {
    assert.equal(query.take, ADMIN_SEARCH_PER_GROUP + 1, type);
    const select = JSON.stringify(query.select);
    for (const forbidden of ["phone", "message", "authId", "settings", "sourceHash", "siren", "siret", "totalAmount", "address", "notes"]) {
      assert.equal(select.includes(forbidden), false, `${type} ${forbidden}`);
    }
  }
  // Comptes et entreprises de démonstration exclus de la recherche (ménage du 5 novembre 2026).
  assert.deepEqual(queries.companies.where.isDemo, false);
  assert.deepEqual(queries.users.where, {
    NOT: { company: { is: { isDemo: true } } },
    AND: [{ OR: [
      { firstName: { contains: "ada\\%", mode: "insensitive" } },
      { lastName: { contains: "ada\\%", mode: "insensitive" } },
      { email: { contains: "ada\\%", mode: "insensitive" } },
    ] }],
  });
  assert.equal(queries.waitlist.where.message, WAITLIST_MESSAGE);
  assert.deepEqual(queries.contact.where.NOT, { message: WAITLIST_MESSAGE });
  assert.deepEqual(Object.keys(queries.users.select).sort(), ["company", "email", "firstName", "id", "lastName", "role"]);
  assert.deepEqual(Object.keys(queries.companies.select).sort(), ["id", "isDemo", "name", "status"]);
  assert.deepEqual(Object.keys(queries.orders.select).sort(), ["company", "id", "reference", "status"]);
  assert.deepEqual(Object.keys(queries.waitlist.select).sort(), ["company", "email", "id", "name"]);
});

test("ADMIN-ESPACE recherche : groupes de 5, « plus de résultats », liens et groupe illisible", async () => {
  const seen: Array<Record<string, unknown>> = [];
  const db: AdminSearchDatabase = {
    company: {
      findMany: async (args) => {
        seen.push(args);
        return Array.from({ length: 6 }, (_, index) => ({ id: `c${index}`, name: `Acme ${index}`, status: "ACTIVE", isDemo: index === 0 }));
      },
    },
    user: {
      findMany: async () => [
        { id: "u1", firstName: "Ada", lastName: "Lovelace", email: "ada@acme.fr", role: { systemRole: "DRIVER" as const }, company: { id: "c1", name: "Acme" } },
        { id: "u2", firstName: "Root", lastName: "Dupré Ä", email: "root@tutelliv.fr", role: { systemRole: "SUPER_ADMIN" as const }, company: null },
      ],
    },
    order: { findMany: async () => { throw new Error("down"); } },
    contactMessage: {
      findMany: async (args) => (args.where as { message?: string }).message === WAITLIST_MESSAGE
        ? [{ id: "w1", name: "Léa", company: "Transports L", email: "lea+test@exemple.fr" }]
        : [{ id: "m1", name: "Marc", company: null, email: "marc@exemple.fr" }],
    },
  };
  const result = await searchPlatform({ q: "acme" }, db);
  assert.equal(result.q, "acme");
  assert.deepEqual(result.groups.map((group) => group.type), ["companies", "pilots", "users", "orders", "waitlist", "contact"]);
  const [companies, pilots, users, orders, waitlist, contact] = result.groups;
  // ADMIN-ESPACE lot 4 : base sans table des pilotes (ancienne copie) → groupe « Indisponible », pas d'erreur.
  assert.deepEqual(pilots, { type: "pilots", label: "Pilotes", items: null, hasMore: false });
  assert.equal(companies!.items?.length, 5);
  assert.equal(companies!.hasMore, true);
  assert.equal(companies!.items?.[0]?.badge, "Démo");
  assert.equal(companies!.items?.[0]?.href, "/companies/c0");
  assert.equal(seen.length, 1);
  assert.equal(users!.hasMore, false);
  assert.equal(users!.items?.[0]?.href, "/companies/c1");
  assert.equal(users!.items?.[0]?.detail, "ada@acme.fr · Acme");
  assert.equal(users!.items?.[1]?.href, "/admin/users?q=Dupr%C3%A9%20%C3%84");
  assert.deepEqual(orders, { type: "orders", label: "Commandes", items: null, hasMore: false });
  assert.equal(waitlist!.items?.[0]?.href, "/admin/waitlist?q=lea%2Btest%40exemple.fr");
  assert.equal(contact!.items?.[0]?.href, "/admin/contact");
  assert.equal(contact!.items?.[0]?.detail, "marc@exemple.fr");
  for (const group of result.groups) {
    for (const item of group.items ?? []) {
      assert.deepEqual(Object.keys(item).sort(), ["badge", "detail", "href", "id", "title", "type"]);
    }
  }
});

test("ADMIN-ESPACE recherche : 60 recherches par minute et par compte", () => {
  const limiter = createFunnelSourceLimiter({ limit: 60, windowMs: 60_000 });
  for (let index = 0; index < 60; index += 1) assert.equal(allowAdminSearch("actor-1", 1_000, limiter), true);
  assert.equal(allowAdminSearch("actor-1", 1_000, limiter), false);
  assert.equal(allowAdminSearch("actor-2", 1_000, limiter), true);
  assert.equal(allowAdminSearch("actor-1", 61_001, limiter), true);
});

/* ====================== Routes ====================== */

type RouteModule = { GET?: (request?: Request, context?: { params: Promise<{ id: string }> }) => Promise<Response> };

function loadRoute(
  file: string,
  service: string,
  role: string,
  calls: string[],
  serviceExports: Record<string, unknown>
): RouteModule {
  const module = { exports: {} as RouteModule };
  const source = ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  runInNewContext(source, {
    Error, URL, exports: module.exports, module,
    require: (id: string) => {
      if (id === "next/server") return { NextResponse };
      if (id === "@/lib/api/auth-guard") return {
        requireStaffRole: async () => {
          calls.push("staff");
          if (role === "ANONYMOUS") return { error: NextResponse.json({ error: "Non authentifié" }, { status: 401 }) };
          return { context: { user: { id: "actor-1", role: { systemRole: role } } } };
        },
        requireRole: (_context: unknown, roles: string[]) =>
          roles.includes(role) ? null : NextResponse.json({ error: "Accès refusé" }, { status: 403 }),
      };
      if (id === "@/lib/api/platform-access") return {
        gatePlatformRead: async (_context: unknown, denied: Response | null, resource: string) => {
          calls.push(`audit:${resource}:${denied ? "DENIED" : "ALLOWED"}`);
          return denied;
        },
      };
      if (id === service) return serviceExports;
      throw new Error(`Unexpected dependency ${id}`);
    },
  });
  return module.exports;
}

function watchedRequest(url: string, calls: string[]) {
  const request = new Request(url);
  return new Proxy(request, {
    get(target, prop, receiver) {
      if (prop === "url") calls.push("url");
      return Reflect.get(target, prop, receiver);
    },
  });
}

test("ADMIN-ESPACE routes : recherche refusée sans session (401) et aux autres rôles (403)", async () => {
  const searchService = (calls: string[], allow = true) => ({
    parseAdminSearchParams,
    allowAdminSearch: () => { calls.push("limit"); return allow; },
    searchPlatform: async (query: { q: string }) => { calls.push("service"); return { q: query.q, groups: [] }; },
  });
  const file = "src/app/api/admin/search/route.ts";
  const service = "@/domains/admin/search.service";

  const anonymous: string[] = [];
  const unauth = await loadRoute(file, service, "ANONYMOUS", anonymous, searchService(anonymous)).GET!(watchedRequest("http://local/api/admin/search?q=acme", anonymous));
  assert.equal(unauth.status, 401);
  assert.deepEqual(anonymous, ["staff"]);

  for (const role of ["COMPANY_ADMIN", "MINI_ADMIN", "DISPATCHER", "DRIVER", "CLIENT"]) {
    const calls: string[] = [];
    const denied = await loadRoute(file, service, role, calls, searchService(calls)).GET!(watchedRequest("http://local/api/admin/search?q=acme", calls));
    assert.equal(denied.status, 403, role);
    assert.deepEqual(calls, ["staff", "audit:OVERVIEW:DENIED"], role);
  }

  const allowed: string[] = [];
  const ok = await loadRoute(file, service, "SUPER_ADMIN", allowed, searchService(allowed)).GET!(watchedRequest("http://local/api/admin/search?q=acme", allowed));
  assert.equal(ok.status, 200);
  assert.equal(ok.headers.get("Cache-Control"), "no-store");
  assert.deepEqual(allowed, ["staff", "audit:OVERVIEW:ALLOWED", "url", "limit", "service"]);
  assert.deepEqual((await ok.json()).data, { q: "acme", groups: [] });

  const invalid: string[] = [];
  const bad = await loadRoute(file, service, "SUPER_ADMIN", invalid, searchService(invalid)).GET!(watchedRequest("http://local/api/admin/search?q=a", invalid));
  assert.equal(bad.status, 400);
  assert.equal(bad.headers.get("Cache-Control"), "no-store");
  assert.equal(invalid.includes("service"), false);

  const limited: string[] = [];
  const tooMany = await loadRoute(file, service, "SUPER_ADMIN", limited, searchService(limited, false)).GET!(watchedRequest("http://local/api/admin/search?q=acme", limited));
  assert.equal(tooMany.status, 429);
  assert.equal(tooMany.headers.get("Retry-After"), "60");
  assert.equal(limited.includes("service"), false);
});

test("ADMIN-ESPACE routes : fiche entreprise refusée (401, 403), 500 sans détail si la lecture échoue", async () => {
  const file = "src/app/api/admin/companies/[id]/route.ts";
  const service = "@/domains/admin/company-file.service";
  const params = () => Promise.resolve({ id: "company-1" });
  const fileService = (calls: string[], fail = false) => ({
    getPlatformCompanyFile: async () => {
      calls.push("service");
      if (fail) throw new Error("database password=secret");
      return { id: "company-1", activity: {} };
    },
  });

  const anonymous: string[] = [];
  const unauth = await loadRoute(file, service, "ANONYMOUS", anonymous, fileService(anonymous)).GET!(new Request("http://local"), { params: params() });
  assert.equal(unauth.status, 401);
  assert.deepEqual(anonymous, ["staff"]);

  const denied: string[] = [];
  const forbidden = await loadRoute(file, service, "MINI_ADMIN", denied, fileService(denied)).GET!(new Request("http://local"), { params: params() });
  assert.equal(forbidden.status, 403);
  assert.deepEqual(denied, ["staff", "audit:COMPANY_DETAIL:DENIED"]);

  const failing: string[] = [];
  const failed = await loadRoute(file, service, "SUPER_ADMIN", failing, fileService(failing, true)).GET!(new Request("http://local"), { params: params() });
  assert.equal(failed.status, 500);
  assert.equal(failed.headers.get("Cache-Control"), "no-store");
  const body = await failed.text();
  assert.equal(body.includes("secret"), false);
});

/* ====================== Écrans ====================== */

test("ADMIN-ESPACE écrans : recherche réservée au super-administrateur, clavier et liens filtrés", () => {
  const layout = readFileSync("src/app/(back-office)/layout.tsx", "utf8");
  assert.equal(layout.includes("headerActions={isSuperAdmin ? <AdminGlobalSearch /> : undefined}"), true);
  const search = readFileSync("src/features/admin/search/admin-global-search.tsx", "utf8");
  for (const present of ["event.metaKey || event.ctrlKey", "\"ArrowDown\"", "\"ArrowUp\"", "\"Enter\"", "role=\"combobox\"", "role=\"listbox\"", "aria-activedescendant", "DialogTitle"]) {
    assert.equal(search.includes(present), true, present);
  }
  const api = readFileSync("src/features/admin/api.ts", "utf8");
  assert.equal(api.includes("fetch(`/api/admin/search?q=${encodeURIComponent(q)}`, { cache: \"no-store\", signal })"), true);
  // Les pages ouvertes depuis la recherche ou la fiche reprennent `?q=` (sous Suspense pour useSearchParams).
  for (const file of [
    "src/app/(back-office)/admin/support/page.tsx",
    "src/app/(back-office)/admin/incidents/page.tsx",
    "src/app/(back-office)/admin/users/page.tsx",
  ]) {
    const source = readFileSync(file, "utf8");
    assert.equal(source.includes("useUrlSearchQuery("), true, file);
    assert.equal(source.includes("<Suspense fallback={<PageSkeleton />}>"), true, file);
  }
  assert.equal(readFileSync("src/features/admin/waitlist/waitlist-list.tsx", "utf8").includes("useUrlSearchQuery("), true);
  assert.equal(readFileSync("src/app/(back-office)/admin/waitlist/page.tsx", "utf8").includes("<Suspense"), true);
});
