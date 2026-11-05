import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as zod from "zod";
import { NextResponse } from "next/server";
import {
  FUNNEL_BODY_MAX_BYTES,
  FUNNEL_SOURCE_LIMIT,
  FUNNEL_WINDOW_MS,
  createFunnelSourceLimiter,
  funnelBeaconSchema,
  funnelDayKey,
  funnelRate,
  incrementFunnelCounter,
  isLikelyBot,
  normalizeCampaignCode,
  parseFunnelParams,
  readWaitlistFunnel,
  recordFunnelBeacon,
  summarizeFunnel,
} from "../src/domains/growth/waitlist-funnel.service";
import {
  WAITLIST_CSV_HEADERS,
  buildWaitlistCsv,
  csvCell,
  exportWaitlistCsv,
  listWaitlistEntries,
  parseWaitlistExportParams,
  parseWaitlistListParams,
  setWaitlistContacted,
  waitlistCsvFilename,
  waitlistWhere,
  type WaitlistDatabase,
  type WaitlistEntry,
} from "../src/domains/growth/waitlist.service";
import { WAITLIST_MESSAGE } from "../src/domains/growth/contact.service";
import { contactWhere } from "../src/domains/admin/admin-home.service";
import { adminNavItems, companyNavItems, dispatcherNavItems, miniAdminNavItems } from "../src/features/navigation/nav-config";

const secret = "test-secret";
const browser = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

/* ---------- Entonnoir : validation, robots, plafond, jour, incrément ---------- */

test("entonnoir : corps strict, campagne invalide ramenée à « direct »", () => {
  assert.equal(funnelBeaconSchema.safeParse({ event: "visit" }).success, true);
  assert.equal(funnelBeaconSchema.safeParse({ event: "click", campaign: "essai-lot2" }).success, true);
  for (const body of [
    { event: "signup" },
    { event: "visit", visitorId: "abc" },
    { event: "visit", campaign: 3 },
    { event: "visit", campaign: "x".repeat(101) },
    {},
    null,
    "visit",
  ]) {
    assert.equal(funnelBeaconSchema.safeParse(body).success, false, JSON.stringify(body));
  }
  assert.equal(normalizeCampaignCode("essai-lot2"), "essai-lot2");
  assert.equal(normalizeCampaignCode("a".repeat(40)), "a".repeat(40));
  for (const raw of [undefined, null, "", "a".repeat(41), "Essai", "essai lot", "essai_lot", "é", "<x>", 42]) {
    assert.equal(normalizeCampaignCode(raw), "direct", String(raw));
  }
});

test("entonnoir : robots évidents reconnus, navigateurs comptés", () => {
  for (const agent of [
    null,
    "",
    "curl/8.4.0",
    "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/130.0 Safari/537.36",
    "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
    "python-requests/2.31.0",
    "Mozilla/5.0 Lighthouse",
  ]) {
    assert.equal(isLikelyBot(agent), true, String(agent));
  }
  assert.equal(isLikelyBot(browser), false);
  assert.equal(isLikelyBot("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1"), false);
});

test("entonnoir : plafond par empreinte, en mémoire, fenêtre glissante et taille bornée", () => {
  const limiter = createFunnelSourceLimiter({ limit: 3, windowMs: 1_000, maxKeys: 2 });
  assert.deepEqual([1, 2, 3, 4].map(() => limiter.allow("a", 0)), [true, true, true, false]);
  assert.equal(limiter.allow("b", 10), true, "autre source indépendante");
  assert.equal(limiter.allow("a", 1_000), true, "nouvelle fenêtre");
  assert.equal(limiter.allow("c", 1_001), true);
  assert.ok(limiter.size() <= 2, "jamais plus de maxKeys empreintes");
  assert.equal(FUNNEL_SOURCE_LIMIT, 30);
  assert.equal(FUNNEL_WINDOW_MS, 3_600_000);
});

test("entonnoir : jour civil de Paris, été comme hiver", () => {
  assert.equal(funnelDayKey(new Date("2026-11-05T22:59:00.000Z")), "2026-11-05");
  assert.equal(funnelDayKey(new Date("2026-11-05T23:00:00.000Z")), "2026-11-06");
  assert.equal(funnelDayKey(new Date("2026-07-14T21:59:00.000Z")), "2026-07-14");
  assert.equal(funnelDayKey(new Date("2026-07-14T22:00:00.000Z")), "2026-07-15");
});

test("entonnoir : incrément atomique en une seule requête INSERT … ON CONFLICT", async () => {
  const queries: Array<{ sql: string; values: unknown[] }> = [];
  const db = {
    $executeRaw: async (strings: TemplateStringsArray, ...values: unknown[]) => {
      queries.push({ sql: strings.join("?"), values });
      return 1;
    },
  } as never;
  await incrementFunnelCounter("VISIT", "pas valide !", new Date("2026-11-05T23:30:00.000Z"), db);
  assert.equal(queries.length, 1);
  const { sql, values } = queries[0]!;
  assert.deepEqual(values, ["2026-11-06", "direct", "VISIT"]);
  assert.match(sql, /INSERT INTO "waitlist_funnel_daily"/);
  assert.match(sql, /ON CONFLICT \("day", "campaign_code", "event"\)/);
  assert.match(sql, /DO UPDATE SET "count" = "waitlist_funnel_daily"\."count" \+ 1/);
  assert.doesNotMatch(sql, /SELECT/i, "aucune lecture avant écriture");
});

test("entonnoir : visite comptée ; robot, corps invalide et dépassement ignorés sans écriture ni identifiant", async () => {
  const written: unknown[][] = [];
  const db = { $executeRaw: async (_strings: TemplateStringsArray, ...values: unknown[]) => { written.push(values); return 1; } } as never;
  const now = new Date("2026-11-05T10:00:00.000Z");
  const limiter = createFunnelSourceLimiter({ limit: 2 });
  const request = { userAgent: browser, source: "203.0.113.7" };

  assert.equal(await recordFunnelBeacon({ event: "visit", campaign: "essai-lot2" }, request, { now, secret, limiter, db }), "recorded");
  assert.equal(await recordFunnelBeacon({ event: "click", campaign: "NON VALIDE" }, request, { now, secret, limiter, db }), "recorded");
  assert.equal(await recordFunnelBeacon({ event: "visit" }, request, { now, secret, limiter, db }), "limited");
  assert.equal(await recordFunnelBeacon({ event: "visit" }, { ...request, source: "198.51.100.1" }, { now, secret, limiter, db }), "recorded");
  assert.equal(await recordFunnelBeacon({ event: "visit" }, { userAgent: "curl/8.0", source: "192.0.2.1" }, { now, secret, limiter, db }), "ignored");
  assert.equal(await recordFunnelBeacon({ event: "visit", ip: "1.2.3.4" }, request, { now, secret, limiter, db }), "invalid");
  assert.deepEqual(written, [
    ["2026-11-05", "essai-lot2", "VISIT"],
    ["2026-11-05", "direct", "CLICK"],
    ["2026-11-05", "direct", "VISIT"],
  ]);
  const stored = JSON.stringify(written);
  for (const forbidden of ["203.0.113.7", "198.51.100.1", "Mozilla"]) assert.equal(stored.includes(forbidden), false, forbidden);
});

test("entonnoir : lecture 7 ou 30 jours, totaux, taux de passage et campagnes", async () => {
  assert.deepEqual(parseFunnelParams(new URLSearchParams()), { query: { days: 30 } });
  assert.deepEqual(parseFunnelParams(new URLSearchParams("days=7")), { query: { days: 7 } });
  assert.deepEqual(parseFunnelParams(new URLSearchParams("days=14")), { error: "Période invalide" });
  assert.deepEqual(parseFunnelParams(new URLSearchParams("days=7&campaign=x")), { error: "Paramètre inconnu" });
  assert.equal(funnelRate(1, 0), null);
  assert.equal(funnelRate(1, 3), 33.3);

  const now = new Date("2026-11-05T23:30:00.000Z"); // 6 novembre à Paris
  const day = (value: string) => new Date(`${value}T00:00:00.000Z`);
  let findArgs: Record<string, unknown> = {};
  const funnel = await readWaitlistFunnel({ days: 7 }, {
    now,
    db: {
      waitlistFunnelDaily: {
        findMany: async (args) => {
          findArgs = args;
          return [
            { day: day("2026-11-06"), campaignCode: "essai-lot2", event: "VISIT", count: 10 },
            { day: day("2026-11-06"), campaignCode: "essai-lot2", event: "CLICK", count: 4 },
            { day: day("2026-11-06"), campaignCode: "essai-lot2", event: "SIGNUP", count: 1 },
            { day: day("2026-10-31"), campaignCode: "direct", event: "VISIT", count: 10 },
            { day: day("2026-10-30"), campaignCode: "direct", event: "VISIT", count: 99 },
          ];
        },
      },
    },
  });
  // Lot 5 : les clics des mails de campagne (MAIL_JOIN, MAIL_SITE) restent hors de l'entonnoir de /tarifs.
  assert.deepEqual(findArgs.where, { day: { gte: day("2026-10-31") }, event: { in: ["VISIT", "CLICK", "SIGNUP"] } });
  assert.equal(funnel.from, "2026-10-31");
  assert.equal(funnel.to, "2026-11-06");
  assert.equal(funnel.series.length, 7);
  assert.deepEqual(funnel.series[6], { day: "2026-11-06", visits: 10, clicks: 4, signups: 1 });
  assert.deepEqual(funnel.series[0], { day: "2026-10-31", visits: 10, clicks: 0, signups: 0 });
  assert.deepEqual(funnel.totals, { visits: 20, clicks: 4, signups: 1 }, "la ligne hors période est ignorée");
  assert.deepEqual(funnel.rates, { visitToClick: 20, clickToSignup: 25, visitToSignup: 5 });
  assert.deepEqual(funnel.campaigns.map((campaign) => campaign.code), ["essai-lot2", "direct"]);
  const empty = summarizeFunnel([], 30, now);
  assert.equal(empty.series.length, 30);
  assert.deepEqual(empty.rates, { visitToClick: null, clickToSignup: null, visitToSignup: null });
});

/* ---------- Liste d'attente : filtre, pagination, recherche, case « contacté » ---------- */

test("liste d'attente : paramètres stricts", () => {
  assert.deepEqual(parseWaitlistListParams(new URLSearchParams()), { query: { q: "", contacted: "all", page: 1, pageSize: 25 } });
  assert.deepEqual(
    parseWaitlistListParams(new URLSearchParams("page=2&pageSize=50&q=%20Martin%20&contacted=no")),
    { query: { q: "Martin", contacted: "no", page: 2, pageSize: 50 } }
  );
  for (const raw of ["page=0", "pageSize=10", "contacted=peut-etre", "companyId=x", `q=${"a".repeat(121)}`]) {
    assert.ok("error" in parseWaitlistListParams(new URLSearchParams(raw)), raw);
  }
  assert.deepEqual(parseWaitlistExportParams(new URLSearchParams("contacted=yes")), { query: { q: "", contacted: "yes" } });
  assert.ok("error" in parseWaitlistExportParams(new URLSearchParams("page=1")));
});

test("liste d'attente : seules les inscriptions, filtre contacté et recherche sans casse", () => {
  assert.deepEqual(waitlistWhere({ q: "", contacted: "all" }), { message: WAITLIST_MESSAGE });
  assert.deepEqual(waitlistWhere({ q: "", contacted: "yes" }), { message: WAITLIST_MESSAGE, contactedAt: { not: null } });
  assert.deepEqual(waitlistWhere({ q: "", contacted: "no" }), { message: WAITLIST_MESSAGE, contactedAt: null });
  const search = waitlistWhere({ q: "martin", contacted: "no" }) as { OR: Array<Record<string, { contains: string; mode: string }>> };
  assert.deepEqual(search.OR.map((clause) => Object.keys(clause)[0]), ["name", "company", "email", "phone", "campaignCode"]);
  assert.ok(search.OR.every((clause) => Object.values(clause)[0]!.contains === "martin" && Object.values(clause)[0]!.mode === "insensitive"));
  // Séparation : Messages Contact exclut les inscriptions, la liste d'attente ne lit qu'elles.
  assert.deepEqual(contactWhere("contact", null), { NOT: { message: WAITLIST_MESSAGE } });
  assert.deepEqual(contactWhere("waitlist", null), { message: WAITLIST_MESSAGE });
});

type Row = {
  id: string;
  name: string;
  company: string | null;
  email: string;
  phone: string | null;
  campaignCode: string | null;
  message: string;
  sourceHash: string;
  createdAt: Date;
  contactedAt: Date | null;
  contactedById: string | null;
};

function memoryWaitlist(rows: Row[]) {
  const calls: Array<{ method: string; args: Record<string, unknown> }> = [];
  const users: Record<string, { firstName: string; lastName: string }> = { admin1: { firstName: "Orso", lastName: "Admin" } };
  const matches = (row: Row, where: Record<string, unknown>) =>
    (where.id === undefined || row.id === where.id) &&
    (where.message === undefined || row.message === where.message) &&
    (!("contactedAt" in where) || (where.contactedAt === null ? row.contactedAt === null : row.contactedAt !== null));
  const project = (row: Row) => ({
    id: row.id,
    name: row.name,
    company: row.company,
    email: row.email,
    phone: row.phone,
    campaignCode: row.campaignCode,
    createdAt: row.createdAt,
    contactedAt: row.contactedAt,
    contactedBy: row.contactedById ? users[row.contactedById] ?? null : null,
  });
  const db: WaitlistDatabase = {
    contactMessage: {
      count: async (args) => {
        calls.push({ method: "count", args });
        return rows.filter((row) => matches(row, args.where)).length;
      },
      findMany: async (args) => {
        calls.push({ method: "findMany", args });
        const found = rows.filter((row) => matches(row, args.where as Record<string, unknown>));
        const skip = (args.skip as number | undefined) ?? 0;
        return found.slice(skip, skip + ((args.take as number | undefined) ?? found.length)).map(project);
      },
      findFirst: async (args) => {
        calls.push({ method: "findFirst", args });
        const row = rows.find((entry) => matches(entry, args.where as Record<string, unknown>));
        return row ? { id: row.id, contactedAt: row.contactedAt } : null;
      },
      update: async (args) => {
        calls.push({ method: "update", args });
        const row = rows.find((entry) => entry.id === (args.where as { id: string }).id)!;
        Object.assign(row, args.data);
        return row;
      },
    },
  };
  return { db, calls, rows };
}

function row(id: string, overrides: Partial<Row> = {}): Row {
  return {
    id,
    name: `Prénom ${id}`,
    company: "Transports Exemple",
    email: `${id}@example.invalid`,
    phone: "06 00 00 00 00",
    campaignCode: "direct",
    message: WAITLIST_MESSAGE,
    sourceHash: "empreinte-secrete",
    createdAt: new Date("2026-11-05T10:00:00.000Z"),
    contactedAt: null,
    contactedById: null,
    ...overrides,
  };
}

test("liste d'attente : pagination, résumé et aucune empreinte renvoyée", async () => {
  const rows = [
    ...Array.from({ length: 30 }, (_, index) => row(`w${index}`)),
    row("c1", { contactedAt: new Date("2026-11-05T11:00:00.000Z"), contactedById: "admin1" }),
    row("m1", { message: "Bonjour, un message Contact ordinaire." }),
  ];
  const memory = memoryWaitlist(rows);
  const page = await listWaitlistEntries({ q: "", contacted: "no", page: 2, pageSize: 25 }, memory.db);
  assert.equal(page.total, 30);
  assert.equal(page.items.length, 5);
  assert.deepEqual(page.summary, { total: 31, contacted: 1, notContacted: 30 });
  const find = memory.calls.find((call) => call.method === "findMany")!;
  assert.equal(find.args.skip, 25);
  assert.equal(find.args.take, 25);
  assert.deepEqual(find.args.orderBy, [{ createdAt: "desc" }, { id: "desc" }]);
  assert.equal("sourceHash" in (find.args.select as Record<string, unknown>), false);
  assert.equal("message" in (find.args.select as Record<string, unknown>), false);
  assert.equal(JSON.stringify(page).includes("empreinte-secrete"), false);
  assert.equal(page.items.some((item) => item.id === "m1"), false, "jamais un message Contact");

  const contacted = await listWaitlistEntries({ q: "", contacted: "yes", page: 1, pageSize: 25 }, memory.db);
  assert.deepEqual(contacted.items.map((item) => [item.id, item.contactedBy, item.contactedAt]), [["c1", "Orso Admin", "2026-11-05T11:00:00.000Z"]]);
});

test("liste d'attente : case « contacté » avec date et auteur, idempotente, réservée aux inscriptions", async () => {
  const memory = memoryWaitlist([row("w1"), row("m1", { message: "Message Contact" })]);
  const at = new Date("2026-11-05T15:00:00.000Z");
  const checked = await setWaitlistContacted("w1", true, "admin1", { now: at, db: memory.db });
  if (checked.status === "not_found") throw new Error("inscription introuvable");
  assert.equal(checked.status, "updated");
  assert.equal(checked.entry.contactedAt, at.toISOString());
  assert.equal(checked.entry.contactedBy, "Orso Admin");
  assert.deepEqual(memory.calls.find((call) => call.method === "update")?.args, {
    where: { id: "w1" },
    data: { contactedAt: at, contactedById: "admin1" },
  });

  const again = await setWaitlistContacted("w1", true, "autre", { now: new Date("2026-11-06T09:00:00.000Z"), db: memory.db });
  assert.equal(again.status, "unchanged");
  assert.equal(memory.rows[0]!.contactedAt, at, "la première date est gardée");
  assert.equal(memory.rows[0]!.contactedById, "admin1");

  const unchecked = await setWaitlistContacted("w1", false, "admin1", { db: memory.db });
  assert.equal(unchecked.status, "updated");
  assert.equal(memory.rows[0]!.contactedAt, null);
  assert.equal(memory.rows[0]!.contactedById, null);

  assert.deepEqual(await setWaitlistContacted("m1", true, "admin1", { db: memory.db }), { status: "not_found" });
  assert.deepEqual(await setWaitlistContacted("absent", true, "admin1", { db: memory.db }), { status: "not_found" });
  assert.equal(memory.rows[1]!.contactedAt, null, "un message Contact n'est jamais modifié");
  for (const call of memory.calls.filter((entry) => entry.method === "findFirst")) {
    assert.equal((call.args.where as { message: string }).message, WAITLIST_MESSAGE);
  }
});

/* ---------- Export CSV ---------- */

test("CSV : cellule échappée, injection de formule neutralisée", () => {
  assert.equal(csvCell("Martin"), "Martin");
  assert.equal(csvCell(null), "");
  assert.equal(csvCell("Dupont; fils"), '"Dupont; fils"');
  assert.equal(csvCell('Le "Rapide"'), '"Le ""Rapide"""');
  assert.equal(csvCell("ligne 1\nligne 2"), '"ligne 1\nligne 2"');
  assert.equal(csvCell(" espace"), '" espace"');
  assert.equal(csvCell("=HYPERLINK(\"http://x\")"), "\"'=HYPERLINK(\"\"http://x\"\")\"");
  assert.equal(csvCell("+33 6 00 00 00 00"), "'+33 6 00 00 00 00");
  assert.equal(csvCell("-2+3"), "'-2+3");
  assert.equal(csvCell("@SUM(A1)"), "'@SUM(A1)");
  assert.equal(csvCell("\t=1"), "'\t=1");
  assert.equal(csvCell("=1;2"), "\"'=1;2\"");
});

test("CSV : BOM UTF-8, séparateur « ; », en-têtes français et lignes Windows", () => {
  const entry: WaitlistEntry = {
    id: "w1",
    name: "Élodie Durand",
    company: "=cmd|' /C calc'!A0",
    email: "elodie@example.invalid",
    phone: "+33 6 12 34 56 78",
    campaignCode: "essai-lot2",
    createdAt: "2026-11-05T13:05:00.000Z",
    contactedAt: "2026-11-05T15:00:00.000Z",
    contactedBy: "Orso Admin",
  };
  const csv = buildWaitlistCsv([entry, { ...entry, id: "w2", campaignCode: null, contactedAt: null, contactedBy: null, phone: null, company: "Dupont; fils" }]);
  assert.equal(csv.charCodeAt(0), 0xfeff, "BOM");
  const lines = csv.slice(1).split("\r\n");
  assert.equal(lines.at(-1), "", "fin de ligne finale");
  assert.equal(lines[0], WAITLIST_CSV_HEADERS.join(";"));
  assert.equal(lines[1], "05/11/2026 14:05;Élodie Durand;'=cmd|' /C calc'!A0;elodie@example.invalid;'+33 6 12 34 56 78;essai-lot2;oui;05/11/2026 16:00;Orso Admin");
  assert.equal(lines[2], "05/11/2026 14:05;Élodie Durand;\"Dupont; fils\";elodie@example.invalid;;inconnue;non;;");
  assert.match(waitlistCsvFilename(new Date("2026-11-05T23:30:00.000Z")), /^liste-attente-2026-11-06\.csv$/);
});

test("CSV : export filtré, borné, sans empreinte", async () => {
  const memory = memoryWaitlist([row("w1"), row("w2", { contactedAt: new Date(), contactedById: "admin1" }), row("m1", { message: "Contact" })]);
  const result = await exportWaitlistCsv({ q: "", contacted: "no" }, memory.db);
  assert.equal(result.count, 1);
  assert.equal(result.truncated, false);
  assert.equal(result.csv.includes("w1@example.invalid"), true);
  assert.equal(result.csv.includes("w2@example.invalid"), false);
  assert.equal(result.csv.includes("m1@example.invalid"), false);
  assert.equal(result.csv.includes("empreinte-secrete"), false);
  assert.equal(memory.calls.find((call) => call.method === "findMany")?.args.take, 5_001);
});

/* ---------- Routes ---------- */

type RouteModule = {
  GET?: (request: Request) => Promise<Response>;
  POST?: (request: Request) => Promise<Response>;
  PATCH?: (request: Request, context: { params: Promise<{ id: string }> }) => Promise<Response>;
};

function loadRoute(file: string, mocks: Record<string, unknown>, role: string, calls: string[]): RouteModule {
  const module = { exports: {} as RouteModule };
  const source = ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  runInNewContext(source, {
    Error, URL, Number, JSON, console, exports: module.exports, module,
    require: (id: string) => {
      if (id === "next/server") return { NextResponse };
      if (id === "zod") return zod;
      if (id === "@/lib/api/auth-guard") return {
        requireStaffRole: async (permission: string) => {
          calls.push(`staff:${permission}`);
          if (role === "ANONYMOUS") return { error: NextResponse.json({ error: "Non authentifié" }, { status: 401 }) };
          return { context: { user: { id: "admin1", role: { systemRole: role } } } };
        },
        requireRole: (context: { user: { role: { systemRole: string } } }, roles: string[]) => {
          assert.equal([...roles].join(","), "SUPER_ADMIN");
          return roles.includes(context.user.role.systemRole) ? null : NextResponse.json({ error: "Accès refusé" }, { status: 403 });
        },
      };
      if (id === "@/lib/api/platform-access") {
        const gate = (method: string) => async (_context: unknown, denied: Response | null, resource: string, write?: string) => {
          calls.push(`journal:${resource}:${write ?? method}:${denied ? "DENIED" : "ALLOWED"}`);
          return denied;
        };
        return { gatePlatformRead: gate("GET"), gatePlatformWrite: gate("WRITE") };
      }
      if (id in mocks) return mocks[id];
      throw new Error(`Dépendance inattendue ${id}`);
    },
  });
  return module.exports;
}

const waitlistService = (calls: string[]) => ({
  parseWaitlistListParams: (search: URLSearchParams) => parseWaitlistListParams(search),
  parseWaitlistExportParams: (search: URLSearchParams) => parseWaitlistExportParams(search),
  listWaitlistEntries: async () => { calls.push("service"); return { items: [] }; },
  exportWaitlistCsv: async () => { calls.push("service"); return { csv: "\uFEFFa;b\r\n", count: 0, truncated: false }; },
  waitlistCsvFilename: () => "liste-attente-2026-11-05.csv",
  waitlistContactedSchema: zod.z.object({ contacted: zod.z.boolean() }).strict(),
  setWaitlistContacted: async (id: string, contacted: boolean, actor: string) => {
    calls.push(`service:${id}:${contacted}:${actor}`);
    return id === "absent" ? { status: "not_found" } : { status: "updated", entry: { id, contactedAt: contacted ? "x" : null } };
  },
});
const funnelService = (calls: string[]) => ({
  parseFunnelParams,
  readWaitlistFunnel: async () => { calls.push("service"); return { totals: {} }; },
});

const ADMIN_GETS = [
  ["src/app/api/admin/waitlist/route.ts", "@/domains/growth/waitlist.service", waitlistService, "http://local/api/admin/waitlist?contacted=no"],
  ["src/app/api/admin/waitlist/export/route.ts", "@/domains/growth/waitlist.service", waitlistService, "http://local/api/admin/waitlist/export?q=martin"],
  ["src/app/api/admin/waitlist/funnel/route.ts", "@/domains/growth/waitlist-funnel.service", funnelService, "http://local/api/admin/waitlist/funnel?days=7"],
] as const;

test("routes liste d'attente : 401 sans session, 403 journalisé pour tout autre rôle, sans lecture", async () => {
  for (const [file, id, service, url] of ADMIN_GETS) {
    const anonymousCalls: string[] = [];
    const anonymous = await loadRoute(file, { [id]: service(anonymousCalls) }, "ANONYMOUS", anonymousCalls).GET!(new Request(url));
    assert.equal(anonymous.status, 401, file);
    assert.deepEqual(anonymousCalls, ["staff:dashboard:admin"], file);
    for (const role of ["COMPANY_ADMIN", "MINI_ADMIN", "DISPATCHER"]) {
      const calls: string[] = [];
      const denied = await loadRoute(file, { [id]: service(calls) }, role, calls).GET!(new Request(url));
      assert.equal(denied.status, 403, `${file} ${role}`);
      assert.deepEqual(calls, ["staff:dashboard:admin", "journal:CONTACT_MESSAGES:GET:DENIED"], `${file} ${role}`);
    }
  }
  const patchCalls: string[] = [];
  const patch = loadRoute("src/app/api/admin/waitlist/[id]/route.ts", { "@/domains/growth/waitlist.service": waitlistService(patchCalls) }, "COMPANY_ADMIN", patchCalls);
  const denied = await patch.PATCH!(new Request("http://local/api/admin/waitlist/w1", { method: "PATCH", body: '{"contacted":true}' }), { params: Promise.resolve({ id: "w1" }) });
  assert.equal(denied.status, 403);
  assert.deepEqual(patchCalls, ["staff:dashboard:admin", "journal:CONTACT_MESSAGES:PATCH:DENIED"]);
  const anonymousCalls: string[] = [];
  const anonymous = await loadRoute("src/app/api/admin/waitlist/[id]/route.ts", { "@/domains/growth/waitlist.service": waitlistService(anonymousCalls) }, "ANONYMOUS", anonymousCalls)
    .PATCH!(new Request("http://local/api/admin/waitlist/w1", { method: "PATCH", body: '{"contacted":true}' }), { params: Promise.resolve({ id: "w1" }) });
  assert.equal(anonymous.status, 401);
});

test("routes liste d'attente : le super-administrateur lit, exporte et coche, sans cache ; paramètres stricts", async () => {
  for (const [file, id, service, url] of ADMIN_GETS) {
    const calls: string[] = [];
    const response = await loadRoute(file, { [id]: service(calls) }, "SUPER_ADMIN", calls).GET!(new Request(url));
    assert.equal(response.status, 200, file);
    assert.equal(response.headers.get("Cache-Control"), "no-store", file);
    assert.deepEqual(calls, ["staff:dashboard:admin", "journal:CONTACT_MESSAGES:GET:ALLOWED", "service"], file);
    const badCalls: string[] = [];
    const bad = await loadRoute(file, { [id]: service(badCalls) }, "SUPER_ADMIN", badCalls).GET!(new Request(`${url}&companyId=x`));
    assert.equal(bad.status, 400, file);
    assert.equal(badCalls.includes("service"), false, file);
  }
  const exportCalls: string[] = [];
  const exported = await loadRoute(ADMIN_GETS[1][0], { [ADMIN_GETS[1][1]]: waitlistService(exportCalls) }, "SUPER_ADMIN", exportCalls).GET!(new Request(ADMIN_GETS[1][3]));
  assert.equal(exported.headers.get("Content-Type"), "text/csv; charset=utf-8");
  assert.equal(exported.headers.get("Content-Disposition"), 'attachment; filename="liste-attente-2026-11-05.csv"');
  // Response.text() retire le BOM au décodage : on lit les octets envoyés.
  const bytes = new Uint8Array(await exported.arrayBuffer());
  assert.deepEqual([...bytes.slice(0, 3)], [0xef, 0xbb, 0xbf], "BOM UTF-8 envoyé");
  assert.equal(Buffer.from(bytes.slice(3)).toString("utf8"), "a;b\r\n");

  const file = "src/app/api/admin/waitlist/[id]/route.ts";
  const patch = (body: string, id = "w1") => {
    const calls: string[] = [];
    const route = loadRoute(file, { "@/domains/growth/waitlist.service": waitlistService(calls) }, "SUPER_ADMIN", calls);
    return route.PATCH!(new Request(`http://local/api/admin/waitlist/${id}`, { method: "PATCH", body }), { params: Promise.resolve({ id }) })
      .then((response) => ({ response, calls }));
  };
  const ok = await patch('{"contacted":true}');
  assert.equal(ok.response.status, 200);
  assert.equal(ok.response.headers.get("Cache-Control"), "no-store");
  assert.deepEqual(ok.calls, ["staff:dashboard:admin", "journal:CONTACT_MESSAGES:PATCH:ALLOWED", "service:w1:true:admin1"]);
  for (const body of ['{"contacted":"oui"}', '{"contacted":true,"contactedById":"x"}', "pas du json", "{}"]) {
    const invalid = await patch(body);
    assert.equal(invalid.response.status, 400, body);
    assert.equal(invalid.calls.some((call) => call.startsWith("service")), false, body);
  }
  assert.equal((await patch('{"contacted":false}', "absent")).response.status, 404);
});

test("route publique de l'entonnoir : 204, 400, 413, 429 ou 503, sans détail interne", async () => {
  const file = "src/app/api/waitlist/funnel/route.ts";
  const run = async (body: string, result: string | Error, headers: Record<string, string> = {}) => {
    const seen: Array<{ raw: unknown; request: unknown }> = [];
    const route = loadRoute(file, {
      "@/domains/growth/contact.service": { contactSourceFromHeaders: () => "203.0.113.7" },
      "@/domains/growth/waitlist-funnel.service": {
        FUNNEL_BODY_MAX_BYTES,
        recordFunnelBeacon: async (raw: unknown, request: unknown) => {
          seen.push({ raw, request });
          if (result instanceof Error) throw result;
          return result;
        },
      },
    }, "ANONYMOUS", []);
    const response = await route.POST!(new Request("http://local/api/waitlist/funnel", {
      method: "POST",
      body,
      headers: { "user-agent": browser, ...headers },
    }));
    return { response, seen };
  };
  const recorded = await run('{"event":"visit","campaign":"essai-lot2"}', "recorded");
  assert.equal(recorded.response.status, 204);
  assert.equal(recorded.response.headers.get("Cache-Control"), "no-store");
  assert.equal(recorded.response.headers.get("Set-Cookie"), null, "aucun cookie");
  assert.deepEqual(JSON.parse(JSON.stringify(recorded.seen)), [{ raw: { event: "visit", campaign: "essai-lot2" }, request: { userAgent: browser, source: "203.0.113.7" } }]);
  assert.equal((await run('{"event":"visit"}', "ignored")).response.status, 204, "robot : même réponse");
  assert.equal((await run("pas du json", "invalid")).response.status, 400);
  assert.equal((await run('{"event":"visit"}', "limited")).response.status, 429);
  const big = await run(JSON.stringify({ event: "visit", campaign: "x".repeat(FUNNEL_BODY_MAX_BYTES) }), "recorded");
  assert.equal(big.response.status, 413);
  assert.deepEqual(big.seen, []);
  const logs: unknown[][] = [];
  const original = console.error;
  console.error = (...args: unknown[]) => { logs.push(args); };
  try {
    const failed = await run('{"event":"visit"}', new Error("DATABASE_DOWN postgres://secret"));
    assert.equal(failed.response.status, 503);
    assert.equal(JSON.stringify(await failed.response.json()).includes("postgres"), false);
  } finally {
    console.error = original;
  }
  assert.equal(logs.length, 1);
});

/* ---------- Menu, accueil, page publique et confidentialité ---------- */

test("liste d'attente : entrée du groupe Commercial, super-administrateur seulement, liens de l'accueil", () => {
  const entry = adminNavItems.find((item) => item.href === "/admin/waitlist");
  assert.equal(entry?.title, "Liste d'attente");
  assert.equal(entry?.group, "Commercial");
  for (const items of [companyNavItems, dispatcherNavItems, miniAdminNavItems]) {
    assert.equal(items.some((item) => item.href.startsWith("/admin")), false);
  }
  assert.ok(existsSync("src/app/(back-office)/admin/waitlist/page.tsx"));
  const todo = readFileSync("src/features/admin/home/admin-todo-list.tsx", "utf8");
  assert.match(todo, /key: "waitlist",[\s\S]*?href: "\/admin\/waitlist"/);
  assert.match(todo, /sinceText\(todo\.waitlistSince\)/);
  const kpi = readFileSync("src/features/admin/home/admin-kpi-grid.tsx", "utf8");
  assert.match(kpi, /label="Inscrits à la liste d'attente"[^>]*href="\/admin\/waitlist"/);
  const list = readFileSync("src/features/admin/waitlist/waitlist-list.tsx", "utf8");
  assert.match(list, /markWaitlistVisited\(\)/);
  assert.equal(list.includes("dangerouslySetInnerHTML"), false);
  const visits = readFileSync("src/features/admin/contact-last-visit.ts", "utf8");
  assert.match(visits, /WAITLIST_LAST_VISIT_KEY = "tutelliv:admin:waitlist-last-visit"/);
});

test("page Tarifs : visite et clic envoyés sans cookie ni stockage, campagne transmise avec l'inscription", () => {
  const form = readFileSync("src/features/landing/waitlist-form.tsx", "utf8");
  assert.match(form, /fetch\(FUNNEL_URL, \{[\s\S]*?credentials: "omit",[\s\S]*?keepalive: true/);
  assert.match(form, /sendFunnelEvent\("visit", campaign\.current\)/);
  assert.match(form, /onClick=\{\(\) => sendFunnelEvent\("click", campaign\.current\)\}/);
  assert.match(form, /campaign: campaign\.current/);
  for (const forbidden of ["document.cookie", "localStorage", "sessionStorage", "visitorId", "fingerprint"]) {
    assert.equal(form.includes(forbidden), false, forbidden);
  }
  const privacy = readFileSync("src/app/confidentialite/page.tsx", "utf8");
  assert.match(privacy, /Page Tarifs : les visites sont comptées de façon anonyme/);
  assert.match(privacy, /sans cookie ni adresse IP/);
});
