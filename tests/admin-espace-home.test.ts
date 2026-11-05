import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { NextResponse } from "next/server";
import {
  buildDailySeries,
  buildHealthSignal,
  countOpenIncidents,
  getAdminHome,
  parisDayKey,
  parseAdminHomeParams,
  previousUtcMonthAnchor,
  sameDayLastWeekWindows,
  type AdminHome,
  type AdminHomeBadges,
  type AdminHomeDatabase,
} from "../src/domains/admin/admin-home.service";
import { WAITLIST_MESSAGE } from "../src/domains/growth/contact.service";
import { alertActionKey } from "../src/domains/operational-alerts/operational-alerts.policy";
import {
  ADMIN_NAV_GROUPS,
  adminNavItems,
  companyNavItems,
  dispatcherNavItems,
  driverNavItems,
  miniAdminNavItems,
} from "../src/features/navigation/nav-config";
import { applyAdminNavBadges } from "../src/features/navigation/admin-nav-badges";
import { groupNavItems } from "../src/lib/navigation/group-nav-items";

/* ---------- Paramètres ---------- */

test("ADMIN-ESPACE accueil : paramètres stricts", () => {
  assert.deepEqual(parseAdminHomeParams(new URLSearchParams()), { query: { view: "full", contactSince: null, waitlistSince: null } });
  const since = parseAdminHomeParams(new URLSearchParams({ view: "badges", contactSince: "2026-11-01T08:00:00.000Z" }));
  assert.ok("query" in since);
  assert.equal(since.query.view, "badges");
  assert.equal(since.query.contactSince?.toISOString(), "2026-11-01T08:00:00.000Z");
  assert.equal(since.query.waitlistSince, null);
  const waitlist = parseAdminHomeParams(new URLSearchParams({ waitlistSince: "2026-11-02T08:00:00.000Z" }));
  assert.ok("query" in waitlist);
  assert.equal(waitlist.query.waitlistSince?.toISOString(), "2026-11-02T08:00:00.000Z");
  assert.deepEqual(parseAdminHomeParams(new URLSearchParams({ waitlistSince: "hier" })), { error: "Date invalide" });
  assert.deepEqual(parseAdminHomeParams(new URLSearchParams({ companyId: "x" })), { error: "Paramètre inconnu" });
  assert.deepEqual(parseAdminHomeParams(new URLSearchParams({ view: "tout" })), { error: "Vue invalide" });
  assert.deepEqual(parseAdminHomeParams(new URLSearchParams({ contactSince: "hier" })), { error: "Date invalide" });
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

test("ADMIN-ESPACE accueil : le mois précédent tombe dans le mois UTC d'avant, même en janvier", () => {
  assert.equal(previousUtcMonthAnchor(new Date("2026-11-05T10:00:00.000Z")).toISOString().slice(0, 7), "2026-10");
  assert.equal(previousUtcMonthAnchor(new Date("2027-01-01T00:30:00.000Z")).toISOString().slice(0, 7), "2026-12");
});

/* ---------- Incidents et santé ---------- */

test("ADMIN-ESPACE accueil : seuls les incidents à l'état « Ouvert » comptent", () => {
  const open = { status: "PENDING", deliveries: [{ status: "ASSIGNED", completedAt: null }] };
  const incidents = [
    { id: "i1", order: open },
    { id: "i2", order: open },
    { id: "i3", order: open },
    { id: "i4", order: { status: "CANCELLED", deliveries: [] } },
  ];
  const keys = new Set([alertActionKey("incident:i2", "ack"), alertActionKey("incident:i3", "resolve")]);
  assert.equal(countOpenIncidents(incidents, keys), 1);
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
    contactMessage: {
      count: async (args) => {
        record("contactMessage", "count", args);
        const where = args.where as { message?: string; NOT?: unknown; createdAt?: { gt?: Date; gte?: Date } };
        if (where.NOT) return where.createdAt?.gt ? 4 : 11;
        if (where.message === WAITLIST_MESSAGE) {
          // Liste d'attente : comptée depuis sa propre dernière visite (lot 2), jamais depuis celle de Contact.
          if (where.createdAt?.gt) {
            assert.equal(where.createdAt.gt.toISOString(), "2026-11-02T00:00:00.000Z");
            return 2;
          }
          return where.createdAt?.gte ? 3 : 10;
        }
        throw new Error("filtre Contact inattendu");
      },
    },
    supportTicket: {
      count: async (args) => {
        record("supportTicket", "count", args);
        return 5;
      },
    },
    orderMessage: {
      findMany: async (args) => {
        record("orderMessage", "findMany", args);
        const where = args.where as { requestKey?: { in?: string[] } };
        if (where.requestKey?.in) return [{ orderId: "o1", requestKey: alertActionKey("incident:i2", "resolve") }];
        const order = { status: "PENDING", deliveries: [{ status: "ASSIGNED", completedAt: null }] };
        return [{ id: "i1", order }, { id: "i2", order }];
      },
    },
    company: {
      count: async (args) => {
        record("company", "count", args);
        return (args.where as { createdAt?: unknown }).createdAt ? 1 : 7;
      },
    },
    order: {
      findMany: async (args) => {
        record("order", "findMany", args);
        return [{ createdAt: new Date("2026-11-05T08:00:00.000Z") }, { createdAt: new Date("2026-11-03T08:00:00.000Z") }];
      },
    },
    delivery: {
      count: async (args) => {
        record("delivery", "count", args);
        const range = (args.where as { completedAt: { gte: Date } }).completedAt;
        return range.gte.toISOString() === "2026-11-04T23:00:00.000Z" ? 6 : 4;
      },
      findMany: async (args) => {
        record("delivery", "findMany", args);
        return [{ completedAt: new Date("2026-11-05T09:00:00.000Z") }, { completedAt: null }];
      },
    },
  };
}

test("ADMIN-ESPACE accueil : chiffres clés hors démo, comparaisons et liste d'attente séparée des messages", async () => {
  const calls: Call[] = [];
  const revenueAnchors: string[] = [];
  const now = new Date("2026-11-05T10:00:00.000Z");
  const home = (await getAdminHome(
    { view: "full", contactSince: new Date("2026-11-01T00:00:00.000Z"), waitlistSince: new Date("2026-11-02T00:00:00.000Z") },
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
      readSubscriptionRevenueCents: async (at) => {
        revenueAnchors.push(at.toISOString().slice(0, 7));
        return at.getUTCMonth() === 10 ? 25_800 : 12_900;
      },
    }
  )) as AdminHome;

  assert.deepEqual(home.todo, {
    contactNew: 4,
    waitlistNew: 2,
    openIncidents: 1,
    openSupportTickets: 5,
    contactSince: "2026-11-01T00:00:00.000Z",
    waitlistSince: "2026-11-02T00:00:00.000Z",
  });
  assert.deepEqual(home.kpis.activeCompanies, { current: 7, newLast30Days: 1 });
  assert.deepEqual(home.kpis.deliveredToday, { current: 6, previous: 4 });
  assert.deepEqual(home.kpis.waitlist, { total: 10, last7Days: 3 });
  assert.deepEqual(home.kpis.subscriptionRevenue, {
    currentCents: 25_800,
    previousCents: 12_900,
    monthStartsAt: "2026-11-01T00:00:00.000Z",
  });
  assert.deepEqual(revenueAnchors.sort(), ["2026-10", "2026-11"]);
  assert.equal(home.health.level, "green");
  assert.equal(home.series.length, 30);
  assert.deepEqual(home.series[29], { day: "2026-11-05", orders: 1, delivered: 1 });

  // Exclusion des entreprises de démonstration partout où l'on compte l'activité.
  for (const call of calls.filter((entry) => ["company", "order", "delivery"].includes(entry.model))) {
    const where = call.args.where as { isDemo?: boolean; company?: { isDemo?: boolean } };
    assert.equal(where.isDemo ?? where.company?.isDemo, false, `${call.model}.${call.method}`);
  }
  // Livraisons : seules les livraisons terminées « DELIVERED » sont comptées.
  for (const call of calls.filter((entry) => entry.model === "delivery")) {
    assert.equal((call.args.where as { status: string }).status, "DELIVERED");
  }
  // Tickets ouverts = OPEN et IN_PROGRESS.
  const tickets = calls.find((entry) => entry.model === "supportTicket");
  assert.deepEqual((tickets?.args.where as { status: { in: string[] } }).status.in, ["OPEN", "IN_PROGRESS"]);
});

test("ADMIN-ESPACE accueil : sans visite enregistrée, tous les messages sont nouveaux ; les pastilles restent légères", async () => {
  const calls: Call[] = [];
  const badges = (await getAdminHome({ view: "badges", contactSince: null, waitlistSince: null }, { db: fakeDb(calls) })) as AdminHomeBadges;
  assert.deepEqual(badges.todo, { contactNew: 11, waitlistNew: 10, openIncidents: 1, openSupportTickets: 5, contactSince: null, waitlistSince: null });
  assert.equal(Object.hasOwn(badges, "kpis"), false);
  assert.equal(calls.some((entry) => ["company", "order", "delivery"].includes(entry.model)), false, "aucun calcul lourd");
});

test("ADMIN-ESPACE accueil : un chiffre illisible n'est jamais inventé", async () => {
  const home = (await getAdminHome(
    { view: "full", contactSince: null, waitlistSince: null },
    {
      db: fakeDb([]),
      now: new Date("2026-11-05T10:00:00.000Z"),
      readServiceHealth: async () => { throw new Error("hors ligne"); },
      readSubscriptionRevenueCents: async () => { throw new Error("journal illisible"); },
    }
  )) as AdminHome;
  assert.equal(home.kpis.subscriptionRevenue, null);
  assert.equal(home.health.level, "red");
});

/* ---------- Menu ---------- */

test("ADMIN-ESPACE menu : trois groupes pour le super-administrateur, rien ne change pour les autres rôles", () => {
  const sections = groupNavItems(adminNavItems).map((section) => [section.title, section.items.map((item) => `${item.title} ${item.href}`)]);
  assert.deepEqual(sections, [
    [null, ["Tableau de bord /admin"]],
    [ADMIN_NAV_GROUPS.clients, ["Entreprises /companies", "Pilotes /admin/pilots", "Utilisateurs /admin/users", "Souscriptions /admin/subscriptions"]],
    [ADMIN_NAV_GROUPS.commercial, ["Messages Contact /admin/contact", "Liste d'attente /admin/waitlist", "Campagnes /admin/campaigns", "Codes commerciaux /admin/sales"]],
    [
      ADMIN_NAV_GROUPS.technique,
      ["Exploitation /admin/operations", "Incidents /admin/incidents", "Support plateforme /admin/support", "Journal d'accès /admin/access-events"],
    ],
  ]);
  assert.deepEqual(Object.values(ADMIN_NAV_GROUPS), ["Clients", "Commercial", "Technique"]);
  for (const items of [companyNavItems, dispatcherNavItems, miniAdminNavItems, driverNavItems]) {
    const grouped = groupNavItems(items);
    assert.equal(grouped.length, 1);
    assert.equal(grouped[0]?.title, null);
    assert.deepEqual(grouped[0]?.items, items);
  }
});

test("ADMIN-ESPACE menu : pastilles de nouveautés, aucune à zéro", () => {
  const none = applyAdminNavBadges(adminNavItems, { contactNew: 0, waitlistNew: 0, openIncidents: 0, openSupportTickets: 0 });
  assert.equal(none.some((item) => item.badge !== undefined), false);
  const items = applyAdminNavBadges(adminNavItems, { contactNew: 2, waitlistNew: 1, openIncidents: 140, openSupportTickets: 1 });
  const byHref = Object.fromEntries(items.filter((item) => item.badge !== undefined).map((item) => [item.href, [item.badge, item.badgeLabel]]));
  assert.deepEqual(byHref, {
    "/admin/contact": [2, "2 nouveaux messages"],
    "/admin/waitlist": [1, "1 nouvelle inscription"],
    "/admin/incidents": ["99+", "140 incidents ouverts"],
    "/admin/support": [1, "1 ticket ouvert"],
  });
  assert.equal(items.find((item) => item.href === "/admin/contact")?.group, "Commercial", "le groupe est conservé");
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
  assert.match(layout, /useAdminNavBadges\(adminLastVisits, isSuperAdmin\)/);
  assert.match(layout, /isSuperAdmin \? applyAdminNavBadges/);
  const contact = readFileSync("src/app/(back-office)/admin/contact/page.tsx", "utf8");
  assert.match(contact, /markContactVisited\(\)/);
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
      if (id === "@/lib/api/platform-access") return {
        gatePlatformRead: async (_context: unknown, denied: Response | null, resource: string) => {
          calls.push(`journal:${resource}:${denied ? "DENIED" : "ALLOWED"}`);
          return denied;
        },
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

test("ADMIN-ESPACE /api/admin/home : refusé à tout autre rôle, journalisé, sans lecture", async () => {
  for (const role of ["COMPANY_ADMIN", "MINI_ADMIN", "DISPATCHER", "DRIVER", "CLIENT"]) {
    const calls: string[] = [];
    const response = await loadRoute(role, calls).GET!(new Request("http://local/api/admin/home"));
    assert.equal(response.status, 403, role);
    assert.deepEqual(calls, ["staff:dashboard:admin", "journal:OVERVIEW:DENIED"], role);
  }
});

test("ADMIN-ESPACE /api/admin/home : le super-administrateur lit, sans cache ; paramètre invalide refusé", async () => {
  const calls: string[] = [];
  const ok = await loadRoute("SUPER_ADMIN", calls).GET!(new Request("http://local/api/admin/home?view=badges"));
  assert.equal(ok.status, 200);
  assert.equal(ok.headers.get("Cache-Control"), "no-store");
  assert.deepEqual(calls, ["staff:dashboard:admin", "journal:OVERVIEW:ALLOWED", "service"]);

  const badCalls: string[] = [];
  const bad = await loadRoute("SUPER_ADMIN", badCalls).GET!(new Request("http://local/api/admin/home?companyId=x"));
  assert.equal(bad.status, 400);
  assert.equal(bad.headers.get("Cache-Control"), "no-store");
  assert.equal(badCalls.includes("service"), false);
});
