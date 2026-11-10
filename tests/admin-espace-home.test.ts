import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { NextResponse } from "next/server";
import {
  buildDailySeries,
  buildHealthSignal,
  getAdminHome,
  parisDayKey,
  parseAdminHomeParams,
  sameDayLastWeekWindows,
  type AdminHome,
  type AdminHomeBadges,
  type AdminHomeDatabase,
} from "../src/domains/admin/admin-home.service";
import {
  ADMIN_NAV_GROUPS,
  adminNavItems,
  bakerNavItems,
  companyNavItems,
  driverNavItems,
} from "../src/features/navigation/nav-config";
import { applyAdminNavBadges } from "../src/features/navigation/admin-nav-badges";
import { groupNavItems } from "../src/lib/navigation/group-nav-items";

/* ---------- Paramètres ---------- */

test("ADMIN-ESPACE accueil : paramètres stricts", () => {
  assert.deepEqual(parseAdminHomeParams(new URLSearchParams()), { query: { view: "full" } });
  assert.deepEqual(parseAdminHomeParams(new URLSearchParams({ view: "badges" })), { query: { view: "badges" } });
  assert.deepEqual(parseAdminHomeParams(new URLSearchParams({ companyId: "x" })), { error: "Paramètre inconnu" });
  assert.deepEqual(parseAdminHomeParams(new URLSearchParams({ view: "tout" })), { error: "Vue invalide" });
});

/* ---------- Jours à l'heure de Paris ---------- */

test("ADMIN-ESPACE accueil : regroupement par jour à l'heure de Paris, 30 jours, jours vides à zéro", () => {
  const now = new Date("2026-11-05T10:00:00.000Z");
  const series = buildDailySeries(
    [
      new Date("2026-11-04T23:30:00.000Z"), // 00 h 30 à Paris le 5 novembre
      new Date("2026-11-04T22:59:00.000Z"), // 23 h 59 à Paris le 4 novembre
      new Date("2026-10-06T22:00:00.000Z"), // minuit à Paris (heure d'été) le 7 octobre : premier jour de la fenêtre
      new Date("2026-10-06T21:59:00.000Z"), // 23 h 59 à Paris le 6 octobre : hors fenêtre
    ],
    [new Date("2026-11-05T09:00:00.000Z"), new Date("2026-10-25T00:30:00.000Z")],
    now
  );
  assert.equal(series.length, 30);
  assert.equal(series[0]?.day, "2026-10-07");
  assert.equal(series[29]?.day, "2026-11-05");
  assert.deepEqual(series[29], { day: "2026-11-05", orders: 1, delivered: 1 });
  assert.deepEqual(series[28], { day: "2026-11-04", orders: 1, delivered: 0 });
  assert.deepEqual(series[0], { day: "2026-10-07", orders: 1, delivered: 0 });
  // 25 octobre, jour du passage à l'heure d'hiver : 00 h 30 UTC = 2 h 30 à Paris, même jour.
  assert.equal(series.find((day) => day.day === "2026-10-25")?.delivered, 1);
  assert.equal(series.reduce((sum, day) => sum + day.orders, 0), 3);
  assert.equal(parisDayKey(new Date("2026-07-01T22:30:00.000Z")), "2026-07-02", "heure d'été : UTC+2");
});

test("ADMIN-ESPACE accueil : même jour la semaine dernière, à la même heure, malgré le changement d'heure", () => {
  const plain = sameDayLastWeekWindows(new Date("2026-11-05T10:00:00.000Z"));
  assert.equal(plain.today.gte.toISOString(), "2026-11-04T23:00:00.000Z");
  assert.equal(plain.today.lt.toISOString(), "2026-11-05T10:00:00.000Z");
  assert.equal(plain.lastWeek.gte.toISOString(), "2026-10-28T23:00:00.000Z");
  assert.equal(plain.lastWeek.lt.toISOString(), "2026-10-29T10:00:00.000Z");

  // Lundi 26 octobre 2026 à 11 h (Paris, heure d'hiver) contre lundi 19 octobre à 11 h (heure d'été).
  const dst = sameDayLastWeekWindows(new Date("2026-10-26T10:00:00.000Z"));
  assert.equal(dst.today.gte.toISOString(), "2026-10-25T23:00:00.000Z");
  assert.equal(dst.lastWeek.gte.toISOString(), "2026-10-18T22:00:00.000Z");
  assert.equal(dst.lastWeek.lt.toISOString(), "2026-10-19T09:00:00.000Z");
});

test("ADMIN-ESPACE accueil : voyant vert, orange ou rouge avec une phrase", () => {
  const base = {
    status: "ok" as const,
    checkedAt: "2026-11-05T10:00:00.000Z",
    database: { status: "ok" as const, durationMs: 3 },
    storage: { status: "ok" as const, durationMs: 5 },
    queue: { status: "ok" as const, failed: 0, stale: 0 },
  };
  assert.equal(buildHealthSignal(base).level, "green");
  const degraded = buildHealthSignal({ ...base, status: "degraded", queue: { status: "degraded", failed: 2, stale: 1 } });
  assert.equal(degraded.level, "orange");
  assert.match(degraded.sentence, /2 tâches de fond en échec, 1 tâche de fond bloquée/);
  const down = buildHealthSignal({ ...base, status: "down", database: { status: "down", durationMs: 5000 } });
  assert.equal(down.level, "red");
  assert.match(down.sentence, /base de données ne répond pas/);
  assert.equal(buildHealthSignal(null).level, "red");
});

/* ---------- Lecture complète ---------- */

type Call = { model: string; method: string; args: Record<string, unknown> };

function fakeDb(calls: Call[]): AdminHomeDatabase {
  const record = (model: string, method: string, args: Record<string, unknown>) => calls.push({ model, method, args });
  return {
    supportTicket: {
      count: async (args) => {
        record("supportTicket", "count", args);
        return 5;
      },
    },
    company: {
      count: async (args) => {
        record("company", "count", args);
        return (args.where as { createdAt?: unknown }).createdAt ? 1 : 7;
      },
    },
    order: {
      count: async (args) => {
        record("order", "count", args);
        const range = (args.where as { deliveredAt: { gte: Date } }).deliveredAt;
        return range.gte.toISOString() === "2026-11-04T23:00:00.000Z" ? 6 : 4;
      },
      findMany: async (args) => {
        record("order", "findMany", args);
        if ((args.where as { deliveredAt?: unknown }).deliveredAt) {
          return [{ createdAt: new Date("2026-11-04T08:00:00.000Z"), deliveredAt: new Date("2026-11-05T09:00:00.000Z") }];
        }
        return [{ createdAt: new Date("2026-11-05T08:00:00.000Z") }, { createdAt: new Date("2026-11-03T08:00:00.000Z") }];
      },
    },
  };
}

test("ADMIN-ESPACE accueil : chiffres clés, comparaisons et tickets ouverts", async () => {
  const calls: Call[] = [];
  const now = new Date("2026-11-05T10:00:00.000Z");
  const home = (await getAdminHome(
    { view: "full" },
    {
      db: fakeDb(calls),
      now,
      readServiceHealth: async () => ({
        status: "ok",
        checkedAt: now.toISOString(),
        database: { status: "ok", durationMs: 1 },
        storage: { status: "ok", durationMs: 1 },
        queue: { status: "ok", failed: 0, stale: 0 },
      }),
    }
  )) as AdminHome;

  assert.deepEqual(home.todo, { openSupportTickets: 5 });
  assert.deepEqual(home.kpis.activeCompanies, { current: 7, newLast30Days: 1 });
  assert.deepEqual(home.kpis.deliveredToday, { current: 6, previous: 4 });
  assert.equal(home.health.level, "green");
  assert.equal(home.series.length, 30);
  assert.deepEqual(home.series[29], { day: "2026-11-05", orders: 1, delivered: 1 });

  // Livraisons : seules les commandes « DELIVERED » sont comptées comme livrées.
  for (const call of calls.filter((entry) => entry.model === "order" && (entry.args.where as { deliveredAt?: unknown }).deliveredAt)) {
    assert.equal((call.args.where as { status: string }).status, "DELIVERED");
  }
  // Tickets ouverts = OPEN et IN_PROGRESS.
  const tickets = calls.find((entry) => entry.model === "supportTicket");
  assert.deepEqual((tickets?.args.where as { status: { in: string[] } }).status.in, ["OPEN", "IN_PROGRESS"]);
});

test("ADMIN-ESPACE accueil : les pastilles restent légères", async () => {
  const calls: Call[] = [];
  const badges = (await getAdminHome({ view: "badges" }, { db: fakeDb(calls) })) as AdminHomeBadges;
  assert.deepEqual(badges.todo, { openSupportTickets: 5 });
  assert.equal(Object.hasOwn(badges, "kpis"), false);
  assert.equal(calls.some((entry) => ["company", "order"].includes(entry.model)), false, "aucun calcul lourd");
});

test("ADMIN-ESPACE menu : deux groupes pour le super-administrateur, rien ne change pour les autres rôles", () => {
  const sections = groupNavItems(adminNavItems).map((section) => [section.title, section.items.map((item) => `${item.title} ${item.href}`)]);
  assert.deepEqual(sections, [
    [null, ["Tableau de bord /admin"]],
    [ADMIN_NAV_GROUPS.clients, ["Entreprises /companies", "Utilisateurs /admin/users"]],
    [ADMIN_NAV_GROUPS.technique, ["Exploitation /admin/operations", "Support plateforme /admin/support"]],
  ]);
  assert.deepEqual(Object.values(ADMIN_NAV_GROUPS), ["Clients", "Technique"]);
  for (const items of [companyNavItems, bakerNavItems, driverNavItems]) {
    const grouped = groupNavItems(items);
    assert.equal(grouped.length, 1);
    assert.equal(grouped[0]?.title, null);
    assert.deepEqual(grouped[0]?.items, items);
  }
});

test("ADMIN-ESPACE menu : pastille des tickets, aucune à zéro", () => {
  const none = applyAdminNavBadges(adminNavItems, { openSupportTickets: 0 });
  assert.equal(none.some((item) => item.badge !== undefined), false);
  const items = applyAdminNavBadges(adminNavItems, { openSupportTickets: 140 });
  const byHref = Object.fromEntries(items.filter((item) => item.badge !== undefined).map((item) => [item.href, [item.badge, item.badgeLabel]]));
  assert.deepEqual(byHref, { "/admin/support": ["99+", "140 tickets ouverts"] });
  assert.equal(items.find((item) => item.href === "/admin/support")?.group, "Technique", "le groupe est conservé");
  assert.equal(applyAdminNavBadges(adminNavItems, undefined), adminNavItems);
});

test("ADMIN-ESPACE menu : barre latérale et menu mobile rendent les groupes et les pastilles", () => {
  for (const file of ["src/components/layouts/sidebar.tsx", "src/components/layouts/mobile-nav.tsx"]) {
    const source = readFileSync(file, "utf8");
    assert.match(source, /groupNavItems\(items\)/, file);
    assert.match(source, /<NavSectionTitle /, file);
    assert.match(source, /<NavBadge /, file);
  }
  const layout = readFileSync("src/app/(back-office)/layout.tsx", "utf8");
  assert.match(layout, /useAdminNavBadges\(isSuperAdmin\)/);
  assert.match(layout, /isSuperAdmin(?: \?|\)) (?:return )?applyAdminNavBadges/);
});

/* ---------- Route ---------- */

function loadRoute(role: string, calls: string[]) {
  const module = { exports: {} as { GET?: (request: Request) => Promise<Response> } };
  const source = ts.transpileModule(readFileSync("src/app/api/admin/home/route.ts", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  runInNewContext(source, {
    Error, URL, exports: module.exports, module,
    require: (id: string) => {
      if (id === "next/server") return { NextResponse };
      if (id === "@/lib/api/auth-guard") return {
        requireStaffRole: async (permission: string) => {
          calls.push(`staff:${permission}`);
          return { context: { user: { id: "u1", role: { systemRole: role } } } };
        },
        requireRole: (context: { user: { role: { systemRole: string } } }, roles: string[]) =>
          roles.includes(context.user.role.systemRole) ? null : NextResponse.json({ error: "Accès refusé" }, { status: 403 }),
      };
      if (id === "@/domains/admin/admin-home.service") return {
        parseAdminHomeParams,
        getAdminHome: async () => { calls.push("service"); return { todo: {} }; },
      };
      throw new Error(`Dépendance inattendue ${id}`);
    },
  });
  return module.exports;
}

test("ADMIN-ESPACE /api/admin/home : refusé à tout autre rôle, sans lecture", async () => {
  for (const role of ["ADMIN", "MINI_ADMIN", "DISPATCHER", "DRIVER", "MERCHANT"]) {
    const calls: string[] = [];
    const response = await loadRoute(role, calls).GET!(new Request("http://local/api/admin/home"));
    assert.equal(response.status, 403, role);
    assert.deepEqual(calls, ["staff:dashboard:admin"], role);
  }
});

test("ADMIN-ESPACE /api/admin/home : le super-administrateur lit, sans cache ; paramètre invalide refusé", async () => {
  const calls: string[] = [];
  const ok = await loadRoute("SUPER_ADMIN", calls).GET!(new Request("http://local/api/admin/home?view=badges"));
  assert.equal(ok.status, 200);
  assert.equal(ok.headers.get("Cache-Control"), "no-store");
  assert.deepEqual(calls, ["staff:dashboard:admin", "service"]);

  const badCalls: string[] = [];
  const bad = await loadRoute("SUPER_ADMIN", badCalls).GET!(new Request("http://local/api/admin/home?companyId=x"));
  assert.equal(bad.status, 400);
  assert.equal(bad.headers.get("Cache-Control"), "no-store");
  assert.equal(badCalls.includes("service"), false);
});
