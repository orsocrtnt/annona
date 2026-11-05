import assert from "node:assert/strict";
import { generateKeyPairSync, verify } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { NextResponse } from "next/server";
import {
  clearProspectionSheetCache,
  extractSheetId,
  mapHeaderRow,
  matchStage,
  parseSheetDate,
  parisToday,
  readProspectionSheet,
  readSheetConfig,
  summarizeProspectionTabs,
  type ProspectionSummary,
} from "../src/domains/admin/prospection-sheet.service";
import {
  clearSheetsTokenCache,
  GoogleSheetsError,
  normalizePrivateKey,
  readSpreadsheetTabs,
  signServiceAccountAssertion,
  tabRange,
} from "../src/services/google/sheets-reader";
import { lateLabel } from "../src/features/admin/prospection/prospection-format";

test("ADMIN-ESPACE prospection : retard affiché en jours civils", () => {
  assert.equal(lateLabel("2026-11-03", "2026-11-06"), "3 jours de retard");
  assert.equal(lateLabel("2026-11-05", "2026-11-06"), "1 jour de retard");
  assert.equal(lateLabel("2026-11-06", "2026-11-06"), "aujourd'hui");
});

/* ====================== Sheet : en-têtes, étapes, dates ====================== */

test("ADMIN-ESPACE prospection : en-têtes repérés par leur nom (casse, accents, synonymes), jamais par position", () => {
  assert.deepEqual(mapHeaderRow(["N°", "SOCIÉTÉ", "Étape", "Commercial(e)", "Relance", "Ville ", "Date du dernier contact"]), {
    company: 1,
    stage: 2,
    owner: 3,
    reminder: 4,
    city: 5,
    lastContact: 6,
  });
  assert.deepEqual(mapHeaderRow(["Date de rappel", "Statut (étape)", "Entreprise", "Notes"]), { reminder: 0, stage: 1, company: 2 });
  assert.deepEqual(mapHeaderRow(["Nom de l'entreprise", "statut"]), { company: 0, stage: 1 });
  assert.deepEqual(mapHeaderRow(["Date", "Mode d'emploi"]), {});

  assert.equal(matchStage("À QUALIFIER"), "TO_QUALIFY");
  assert.equal(matchStage("contactée"), "CONTACTED");
  assert.equal(matchStage("Démo faite"), "DEMO_DONE");
  assert.equal(matchStage("2. Entretien fait"), "INTERVIEWED");
  assert.equal(matchStage("Ne plus contacter"), "DO_NOT_CONTACT");
  assert.equal(matchStage("Rappeler en janvier"), null);
  assert.equal(matchStage(""), null);
});

test("ADMIN-ESPACE prospection : dates françaises jj/mm/aaaa, ISO et dates Google ; jour de Paris", () => {
  assert.equal(parseSheetDate("06/11/2026"), "2026-11-06");
  assert.equal(parseSheetDate("6/11/2026"), "2026-11-06");
  assert.equal(parseSheetDate("06-11-26"), "2026-11-06");
  assert.equal(parseSheetDate("06.11.2026 14:00"), "2026-11-06");
  assert.equal(parseSheetDate("2026-11-06"), "2026-11-06");
  assert.equal(parseSheetDate("2026-11-06T09:30:00Z"), "2026-11-06");
  assert.equal(parseSheetDate(46_332), "2026-11-06"); // numéro de série Google Sheets
  assert.equal(parseSheetDate(46_332.75), "2026-11-06");
  assert.equal(parseSheetDate("31/02/2026"), null);
  assert.equal(parseSheetDate("demain"), null);
  assert.equal(parseSheetDate(""), null);
  assert.equal(parseSheetDate(12), null);
  // 23 h 30 UTC le 6 novembre = 0 h 30 le 7 à Paris.
  assert.equal(parisToday(new Date("2026-11-06T23:30:00Z")), "2026-11-07");
  assert.equal(parisToday(new Date("2026-11-06T22:59:00Z")), "2026-11-06");
});

/** Ligne d'en-têtes en ligne 5 (4 lignes de titre au-dessus), comme la Sheet du propriétaire. */
function tabWithTitleRows(title: string, header: unknown[], rows: unknown[][], titleRows = 4) {
  return { title, values: [...Array.from({ length: titleRows }, (_, i) => (i === 0 ? [`Suivi ${title}`] : [])), header, ...rows] };
}

function ready(summary: ReturnType<typeof summarizeProspectionTabs>): ProspectionSummary {
  assert.equal(summary.status, "ok");
  return (summary as { summary: ProspectionSummary }).summary;
}

test("ADMIN-ESPACE prospection : onglets lus par en-têtes (déplacés, plusieurs onglets, onglets sans en-têtes ignorés)", () => {
  const today = "2026-11-07";
  const tabs = [
    { title: "Mode d'emploi", values: [["Comment remplir le fichier"], [], [], [], ["Colonne", "Signification"], ["Statut", "…"]] },
    tabWithTitleRows("MARSEILLE", ["Entreprise", "Statut", "Commercial", "Date de rappel", "Dernier contact"], [
      ["Coursiers Sud", "Contacté", "Léo", "07/11/2026", "03/11/2026"],
      ["Vélo Express", "En discussion", "Léo", "05/11/2026", "02/11/2026"],
      ["Rapide 13", "Ne plus contacter", "Sam", "01/11/2026", ""],
      ["Plis Pressés", "Perdu", "", "02/11/2026", ""],
      ["Course Futur", "Contacté", "Sam", "20/11/2026", ""],
      ["", "Contacté", "Léo", "", ""],
      ["Livraisons Ouest", "Rappeler en janvier", "", "le 10", ""],
    ]),
    // Colonnes déplacées, synonymes, ville dans une colonne : un autre onglet.
    tabWithTitleRows("Paris", ["Relance", "Ville", "Étape", "Responsable", "Société"], [
      [46_333, "Paris", "Démo faite", "Ana", "Coursier Lumière"],
      ["2026-11-04", "Montreuil", "Entretien fait", "Ana", "Pédale & Co"],
      ["", "paris", "Intéressé", "", "Bleu Express"],
      ["", "Paris", "", "Ana", "Sans Étape SARL"],
    ]),
    // Onglet avec Entreprise mais sans Statut : ignoré et signalé.
    tabWithTitleRows("Brouillon", ["Entreprise", "Ville"], [["Oubli", "Lyon"]]),
  ];
  const summary = ready(summarizeProspectionTabs(tabs, { headerRow: 5, today }));
  assert.equal(summary.total, 10);
  assert.deepEqual(summary.tabs.map((tab) => [tab.title, tab.prospects, tab.cityFromTab]), [["MARSEILLE", 6, true], ["Paris", 4, false]]);
  assert.deepEqual(summary.tabs[0]!.missingOptional, ["Ville"]);
  assert.deepEqual(summary.tabs[1]!.missingOptional, ["Dernier contact"]);
  assert.deepEqual(summary.ignoredTabs, [
    { title: "Mode d'emploi", missing: ["Entreprise", "Statut"] },
    { title: "Brouillon", missing: ["Statut"] },
  ]);

  const stage = Object.fromEntries(summary.byStage.map((entry) => [entry.stage, entry.count]));
  assert.deepEqual(stage, {
    TO_QUALIFY: 0, CONTACTED: 2, DISCUSSING: 1, INTERVIEWED: 1, DEMO_DONE: 1, INTERESTED: 1, PILOT_SIGNED: 0, LOST: 1, DO_NOT_CONTACT: 1,
  });
  assert.deepEqual(summary.otherStages, [{ label: "Rappeler en janvier", count: 1 }, { label: "Sans statut", count: 1 }]);
  assert.equal(summary.otherStagesTotal, 2);
  // Ville : nom de l'onglet si la colonne manque ; « paris » et « Paris » regroupés.
  assert.deepEqual(summary.byCity, [{ label: "MARSEILLE", count: 6 }, { label: "Paris", count: 3 }, { label: "Montreuil", count: 1 }]);
  assert.deepEqual(summary.byOwner, [
    { label: "Ana", count: 3 },
    { label: "Non attribué", count: 3 },
    { label: "Léo", count: 2 },
    { label: "Sam", count: 2 },
  ]);

  // Rappels : aujourd'hui (Paris) et en retard ; Perdu et Ne plus contacter exclus ; futur exclu ; date illisible comptée.
  assert.deepEqual(summary.reminders.today.map((r) => [r.company, r.city, r.owner, r.date]), [
    ["Coursier Lumière", "Paris", "Ana", "2026-11-07"],
    ["Coursiers Sud", "MARSEILLE", "Léo", "2026-11-07"],
  ]);
  assert.deepEqual(summary.reminders.overdue.map((r) => [r.company, r.date]), [["Pédale & Co", "2026-11-04"], ["Vélo Express", "2026-11-05"]]);
  assert.equal(summary.reminders.todayTotal, 2);
  assert.equal(summary.reminders.overdueTotal, 2);
  assert.equal(summary.reminders.unreadableDates, 1);
  assert.equal(summary.reminders.available, true);

  // Revue du vendredi : cumul le long des étapes.
  assert.deepEqual(summary.review, {
    contacted: 8, conversations: 4, interviews: 3, demos: 2, interested: 1, doNotContact: 1, contactedThisWeek: 2,
  });
  const decisions = Object.fromEntries(summary.decisions.map((decision) => [decision.id, decision.status]));
  assert.deepEqual(decisions, { refused: "unknown", spam: "unknown", conversations: "pending", off_target: "unknown", objection: "unknown", interviews: "ok" });
  // Aucune ligne brute ne part au navigateur : seulement des agrégats et des rappels.
  assert.equal(JSON.stringify(summary).includes("Rappeler en janvier"), true);
  assert.equal(JSON.stringify(summary).includes("Course Futur"), false);
});

test("ADMIN-ESPACE prospection : ligne d'en-têtes réglable, seuils de décision calculés", () => {
  const header = ["Entreprise", "Statut"];
  const rows: unknown[][] = [
    ...Array.from({ length: 29 }, (_, i) => [`Contactée ${i}`, "Contacté"]),
    ["Entretien A", "Entretien fait"],
  ];
  const onRow2 = { title: "Liste", values: [["Titre"], header, ...rows] };
  assert.equal(summarizeProspectionTabs([onRow2], { headerRow: 5, today: "2026-11-06" }).status, "no_headers");
  const result = summarizeProspectionTabs([onRow2], { headerRow: 2, today: "2026-11-06" });
  const summary = ready(result);
  assert.equal(summary.total, 30);
  assert.equal(summary.review.contacted, 30);
  assert.equal(summary.review.conversations, 1);
  assert.equal(summary.review.contactedThisWeek, null);
  assert.equal(summary.reminders.available, false);
  const conversations = summary.decisions.find((decision) => decision.id === "conversations")!;
  assert.equal(conversations.status, "act");
  assert.equal(conversations.decision, "Changer l'objet et la question, ou appeler d'abord");

  const interviews = Array.from({ length: 10 }, (_, i) => [`E${i}`, "Démo faite"]);
  const many = ready(summarizeProspectionTabs([{ title: "T", values: [header, ...interviews] }], { headerRow: 1, today: "2026-11-06" }));
  assert.equal(many.decisions.find((decision) => decision.id === "interviews")!.status, "act");

  const none = summarizeProspectionTabs([{ title: "Mode d'emploi", values: [["Texte"]] }], { headerRow: 5, today: "2026-11-06" });
  assert.deepEqual(none, { status: "no_headers", missing: ["Entreprise", "Statut"], ignoredTabs: [{ title: "Mode d'emploi", missing: ["Entreprise", "Statut"] }] });
});

/* ====================== Sheet : configuration, erreurs, secret ====================== */

const { privateKey: TEST_KEY, publicKey: TEST_PUBLIC } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const TEST_PEM = TEST_KEY.export({ type: "pkcs8", format: "pem" }).toString();
/** Clé telle qu'on la colle dans Vercel : sur une ligne, « \n » littéraux. */
const TEST_PEM_ONE_LINE = TEST_PEM.trim().replace(/\n/g, "\\n");
const SHEET_ID = "1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789";
const ENV = {
  GOOGLE_SHEETS_CLIENT_EMAIL: "lecteur@tutelliv-prospection.iam.gserviceaccount.com",
  GOOGLE_SHEETS_PRIVATE_KEY: TEST_PEM_ONE_LINE,
  PROSPECTION_SHEET_ID: SHEET_ID,
};

test("ADMIN-ESPACE prospection : « À brancher » sans variables, configuration invalide signalée", async () => {
  clearProspectionSheetCache();
  assert.deepEqual(readSheetConfig({}), {
    status: "unconfigured",
    missing: ["GOOGLE_SHEETS_CLIENT_EMAIL", "GOOGLE_SHEETS_PRIVATE_KEY", "PROSPECTION_SHEET_ID"],
  });
  let read = 0;
  const view = await readProspectionSheet({ env: { PROSPECTION_SHEET_ID: " " }, readTabs: async () => { read += 1; return []; } });
  assert.deepEqual(view, {
    status: "unconfigured",
    missing: ["GOOGLE_SHEETS_CLIENT_EMAIL", "GOOGLE_SHEETS_PRIVATE_KEY", "PROSPECTION_SHEET_ID"],
    headerRow: 5,
  });
  assert.equal(read, 0, "aucun appel à Google sans configuration");

  const config = readSheetConfig({ ...ENV, PROSPECTION_SHEET_ID: `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit#gid=0` });
  assert.equal(config.status, "ready");
  assert.equal(config.status === "ready" && config.config.sheetId, SHEET_ID);
  assert.equal(config.status === "ready" && config.config.headerRow, 5);
  assert.equal(extractSheetId("pas un id"), null);
  assert.deepEqual(readSheetConfig({ ...ENV, PROSPECTION_SHEET_HEADER_ROW: "0" }), {
    status: "invalid",
    cause: "PROSPECTION_SHEET_HEADER_ROW doit être un nombre entre 1 et 50.",
  });
  const invalid = await readProspectionSheet({ env: { ...ENV, PROSPECTION_SHEET_HEADER_ROW: "abc" }, readTabs: async () => [] });
  assert.equal(invalid.status, "unavailable");
});

test("ADMIN-ESPACE prospection : erreur Google → « Indisponible », cause générique, aucun secret ni chiffre inventé", async () => {
  const logs: string[] = [];
  const log = (message: string, code: string) => logs.push(`${message} ${code}`);
  const cases: Array<[unknown, string]> = [
    [new GoogleSheetsError("access_denied", 403), "Accès refusé : partagez la Sheet en lecture avec l'e-mail du compte de service et activez l'API Google Sheets."],
    [new GoogleSheetsError("not_found", 404), "Sheet introuvable : vérifiez PROSPECTION_SHEET_ID."],
    [new GoogleSheetsError("timeout"), "Google Sheets n'a pas répondu à temps."],
    // Une erreur imprévue qui contiendrait la clé : rien n'en sort.
    [new Error(`boom ${TEST_PEM_ONE_LINE}`), "Lecture de la Sheet impossible."],
  ];
  for (const [error, cause] of cases) {
    clearProspectionSheetCache();
    const view = await readProspectionSheet({
      env: ENV,
      log,
      nowDate: () => new Date("2026-11-06T09:00:00Z"),
      readTabs: async () => { throw error; },
    });
    assert.equal(view.status, "unavailable");
    assert.equal(view.status === "unavailable" && view.cause, cause);
    const serialized = JSON.stringify(view);
    assert.equal(serialized.includes("PRIVATE KEY"), false);
    assert.equal(serialized.includes(TEST_PEM_ONE_LINE.slice(40, 80)), false);
    assert.equal("total" in view, false, "aucun chiffre en cas d'échec");
  }
  assert.equal(logs.length, 4);
  for (const line of logs) {
    assert.equal(line.includes("PRIVATE KEY"), false);
    assert.equal(line.includes(TEST_PEM_ONE_LINE.slice(40, 80)), false);
  }
  assert.deepEqual(logs.slice(0, 3), [
    "[prospection-sheet] lecture impossible google_sheets_access_denied_403",
    "[prospection-sheet] lecture impossible google_sheets_not_found_404",
    "[prospection-sheet] lecture impossible google_sheets_timeout",
  ]);

  // En-têtes manquants : on dit lesquels.
  clearProspectionSheetCache();
  const headers = await readProspectionSheet({ env: ENV, log, readTabs: async () => [{ title: "Feuille 1", values: [["Nom", "Ville"]] }] });
  assert.equal(headers.status, "unavailable");
  assert.equal(
    headers.status === "unavailable" && headers.cause,
    "En-têtes introuvables sur la ligne 5 : Entreprise, Statut. Aucun onglet ne les contient."
  );
});

test("ADMIN-ESPACE prospection : cache serveur de 5 minutes, échec retenu 1 minute", async () => {
  clearProspectionSheetCache();
  let reads = 0;
  let now = new Date("2026-11-06T09:00:00Z");
  const deps = {
    env: ENV,
    log: () => undefined,
    nowDate: () => now,
    readTabs: async () => {
      reads += 1;
      return [{ title: "T", values: [["Entreprise", "Statut"], ["A", "Contacté"]] }];
    },
  };
  const first = await readProspectionSheet({ ...deps, env: { ...ENV, PROSPECTION_SHEET_HEADER_ROW: "1" } });
  assert.equal(first.status, "ready");
  assert.equal(first.status === "ready" && first.total, 1);
  now = new Date("2026-11-06T09:04:00Z");
  await readProspectionSheet({ ...deps, env: { ...ENV, PROSPECTION_SHEET_HEADER_ROW: "1" } });
  assert.equal(reads, 1);
  now = new Date("2026-11-06T09:05:01Z");
  await readProspectionSheet({ ...deps, env: { ...ENV, PROSPECTION_SHEET_HEADER_ROW: "1" } });
  assert.equal(reads, 2);
  clearProspectionSheetCache();
});

/* ====================== Google : JWT signé, lecture, erreurs ====================== */

test("ADMIN-ESPACE prospection : assertion JWT RS256 signée par node:crypto, portée lecture seule", () => {
  assert.equal(normalizePrivateKey(`"${TEST_PEM_ONE_LINE}"`), TEST_PEM.trim());
  const now = Date.parse("2026-11-06T09:00:00Z");
  const jwt = signServiceAccountAssertion({ clientEmail: ENV.GOOGLE_SHEETS_CLIENT_EMAIL, privateKey: TEST_PEM_ONE_LINE }, now);
  const [header, claims, signature] = jwt.split(".");
  assert.deepEqual(JSON.parse(Buffer.from(header!, "base64url").toString()), { alg: "RS256", typ: "JWT" });
  assert.deepEqual(JSON.parse(Buffer.from(claims!, "base64url").toString()), {
    iss: ENV.GOOGLE_SHEETS_CLIENT_EMAIL,
    scope: "https://www.googleapis.com/auth/spreadsheets.readonly",
    aud: "https://oauth2.googleapis.com/token",
    iat: now / 1000,
    exp: now / 1000 + 3600,
  });
  assert.equal(verify("RSA-SHA256", Buffer.from(`${header}.${claims}`), TEST_PUBLIC, Buffer.from(signature!, "base64url")), true);

  assert.throws(
    () => signServiceAccountAssertion({ clientEmail: "a@b.fr", privateKey: ["-----BEGIN ", "PRIVATE KEY-----\\nabc\\n-----END ", "PRIVATE KEY-----"].join("") }, now),
    (error: unknown) => error instanceof GoogleSheetsError && error.code === "invalid_key" && !error.message.includes("abc")
  );
  assert.equal(tabRange("Mode d'emploi"), "'Mode d''emploi'!A1:AZ5000");
});

test("ADMIN-ESPACE prospection : lecture Google Sheets v4 (jeton, onglets, valeurs brutes) et erreurs HTTP", async () => {
  clearSheetsTokenCache();
  const account = { clientEmail: ENV.GOOGLE_SHEETS_CLIENT_EMAIL, privateKey: TEST_PEM_ONE_LINE };
  const seen: Array<{ url: string; auth: string | null; body: string | null }> = [];
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
  const fakeFetch = async (url: string, init?: RequestInit) => {
    seen.push({ url, auth: new Headers(init?.headers).get("Authorization"), body: typeof init?.body === "string" ? init.body : null });
    assert.ok(init?.signal, "délai d'attente posé");
    if (url.startsWith("https://oauth2.googleapis.com/token")) return json({ access_token: "jeton-test", expires_in: 3600 });
    if (url.includes("values:batchGet")) {
      return json({ valueRanges: [{ values: [["Entreprise", "Statut"], ["A", "Contacté"]] }, {}] });
    }
    return json({ sheets: [{ properties: { title: "MARSEILLE", sheetType: "GRID" } }, { properties: { title: "Mode d'emploi" } }, { properties: { title: "Graphique", sheetType: "OBJECT" } }] });
  };
  const tabs = await readSpreadsheetTabs(SHEET_ID, account, { fetch: fakeFetch, now: () => Date.parse("2026-11-06T09:00:00Z") });
  assert.deepEqual(tabs, [
    { title: "MARSEILLE", values: [["Entreprise", "Statut"], ["A", "Contacté"]] },
    { title: "Mode d'emploi", values: [] },
  ]);
  assert.match(seen[0]!.body!, /grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=/);
  assert.equal(seen[1]!.auth, "Bearer jeton-test");
  const batch = new URL(seen[2]!.url);
  assert.deepEqual(batch.searchParams.getAll("ranges"), ["'MARSEILLE'!A1:AZ5000", "'Mode d''emploi'!A1:AZ5000"]);
  assert.equal(batch.searchParams.get("valueRenderOption"), "UNFORMATTED_VALUE");
  assert.equal(batch.searchParams.get("dateTimeRenderOption"), "SERIAL_NUMBER");

  // Jeton gardé en mémoire : pas de nouvelle demande à la lecture suivante.
  await readSpreadsheetTabs(SHEET_ID, account, { fetch: fakeFetch, now: () => Date.parse("2026-11-06T09:10:00Z") });
  assert.equal(seen.filter((entry) => entry.url.includes("oauth2")).length, 1);

  const failing = (status: number, where: "token" | "sheets") => async (url: string) =>
    (where === "token" ? url.includes("oauth2") : !url.includes("oauth2"))
      ? new Response(`{"error":"secret detail ${TEST_PEM_ONE_LINE.slice(40, 80)}"}`, { status })
      : json({ access_token: "jeton-test" });
  const expectations: Array<[number, "token" | "sheets", string]> = [
    [400, "token", "token_refused"],
    [403, "sheets", "access_denied"],
    [404, "sheets", "not_found"],
    [429, "sheets", "rate_limited"],
    [503, "sheets", "google_unavailable"],
  ];
  for (const [status, where, code] of expectations) {
    clearSheetsTokenCache();
    await assert.rejects(
      readSpreadsheetTabs(SHEET_ID, account, { fetch: failing(status, where) }),
      (error: unknown) => error instanceof GoogleSheetsError && error.code === code && !error.message.includes("secret"),
      `${where} ${status}`
    );
  }
  clearSheetsTokenCache();
  await assert.rejects(
    readSpreadsheetTabs(SHEET_ID, account, { fetch: async () => { throw Object.assign(new Error("t"), { name: "TimeoutError" }); } }),
    (error: unknown) => error instanceof GoogleSheetsError && error.code === "timeout"
  );
  clearSheetsTokenCache();
});

/* ====================== Routes ====================== */

type Handler = (request?: Request, context?: { params: Promise<{ id: string }> }) => Promise<Response>;
type Method = "GET" | "POST" | "PATCH" | "DELETE";

function loadRoute(file: string, role: string, calls: string[], services: Record<string, Record<string, unknown>>) {
  const module = { exports: {} as Partial<Record<Method, Handler>> };
  const source = ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  runInNewContext(source, {
    Error, URL, exports: module.exports, module,
    require: (id: string) => {
      if (id === "next/server") return { NextResponse };
      if (id === "@/lib/api/auth-guard") return {
        requireStaffRole: async (permission: string) => {
          calls.push(`staff:${permission}`);
          if (role === "ANONYMOUS") return { error: NextResponse.json({ error: "Non authentifié" }, { status: 401 }) };
          return { context: { user: { id: "actor-1", role: { systemRole: role } } } };
        },
        requireRole: (_context: unknown, roles: string[]) =>
          roles.length === 1 && roles[0] === "SUPER_ADMIN" && role === "SUPER_ADMIN"
            ? null
            : NextResponse.json({ error: "Accès refusé" }, { status: 403 }),
      };
      if (id === "@/lib/api/platform-access") return {
        gatePlatformRead: async (_context: unknown, denied: Response | null, resource: string) => {
          calls.push(`audit:GET:${resource}:${denied ? "DENIED" : "ALLOWED"}`);
          return denied;
        },
        gatePlatformWrite: async (_context: unknown, denied: Response | null, resource: string, method: string) => {
          calls.push(`audit:${method}:${resource}:${denied ? "DENIED" : "ALLOWED"}`);
          return denied;
        },
      };
      if (services[id]) return services[id];
      throw new Error(`Unexpected dependency ${id}`);
    },
  });
  return module.exports;
}

function services(calls: string[]) {
  return {
    "@/domains/admin/prospection-sheet.service": {
      readProspectionSheet: async () => { calls.push("service"); return { status: "unconfigured", missing: [], headerRow: 5 }; },
    },
  };
}

const SHEET = "src/app/api/admin/prospection/sheet/route.ts";

test("ADMIN-ESPACE prospection : route refusée sans session (401) et aux autres rôles (403), refus journalisé", async () => {
  const anonymous: string[] = [];
  const unauth = await loadRoute(SHEET, "ANONYMOUS", anonymous, services(anonymous)).GET!();
  assert.equal(unauth.status, 401);
  assert.deepEqual(anonymous, ["staff:dashboard:admin"]);
  for (const role of ["COMPANY_ADMIN", "MINI_ADMIN", "DISPATCHER", "DRIVER", "CLIENT"]) {
    const calls: string[] = [];
    const denied = await loadRoute(SHEET, role, calls, services(calls)).GET!();
    assert.equal(denied.status, 403, role);
    assert.deepEqual(calls, ["staff:dashboard:admin", "audit:GET:CONTACT_MESSAGES:DENIED"], role);
  }
});

test("ADMIN-ESPACE prospection : le super-administrateur lit les agrégats, sans cache", async () => {
  const calls: string[] = [];
  const response = await loadRoute(SHEET, "SUPER_ADMIN", calls, services(calls)).GET!();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.deepEqual((await response.json()).data, { status: "unconfigured", missing: [], headerRow: 5 });
  assert.deepEqual(calls, ["staff:dashboard:admin", "audit:GET:CONTACT_MESSAGES:ALLOWED", "service"]);
});
