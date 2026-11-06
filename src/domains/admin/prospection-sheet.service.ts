import { toParisDateTimeInput } from "@/lib/format/paris-datetime-input";
import {
  AT_LEAST,
  CONTACTED_STAGES,
  NO_REMINDER_STAGES,
  PROSPECT_STAGE_ALIASES,
  PROSPECT_STAGE_LABELS,
  PROSPECT_STAGES,
  type ProspectStage,
} from "@/domains/admin/prospect-stages";
import {
  GoogleSheetsError,
  readSpreadsheetTabs,
  type GoogleSheetsErrorCode,
  type ServiceAccount,
  type SheetsDeps,
  type SheetTab,
} from "@/services/google/sheets-reader";

/**
 * ADMIN-ESPACE, lot 5 : chiffres du fichier de prospection `Annona_Suivi_Prospection_2026` (Google Sheet),
 * lu en direct et en lecture seule par un compte de service. Les commerciaux continuent de travailler dans la Sheet.
 *
 * - Les colonnes sont repérées par le nom de leur en-tête (ligne 5 par défaut, réglable), sans tenir compte
 *   de la casse ni des accents, avec quelques synonymes : jamais par leur position.
 * - Tous les onglets qui portent au moins les en-têtes Entreprise et Statut sont lus (un onglet par ville possible).
 * - Seuls des agrégats et les rappels (entreprise, ville, commercial, date) partent vers le navigateur.
 * - Sans configuration : « À brancher ». Lecture impossible : « Indisponible » avec une cause générique,
 *   jamais de chiffre inventé, jamais la clé dans un message ou un journal.
 */

/* ---------- Configuration ---------- */

export const PROSPECTION_SHEET_ENV = {
  clientEmail: "GOOGLE_SHEETS_CLIENT_EMAIL",
  privateKey: "GOOGLE_SHEETS_PRIVATE_KEY",
  sheetId: "PROSPECTION_SHEET_ID",
  headerRow: "PROSPECTION_SHEET_HEADER_ROW",
} as const;

export const DEFAULT_HEADER_ROW = 5;
export const MAX_HEADER_ROW = 50;
/** Cache serveur : une lecture Google toutes les 5 minutes au plus ; échec retenu 1 minute. */
export const SHEET_CACHE_MS = 5 * 60_000;
export const SHEET_FAILURE_CACHE_MS = 60_000;
export const REMINDERS_SHOWN = 15;
export const BREAKDOWN_SHOWN = 12;

type Env = Record<string, string | undefined>;

export type SheetConfig = { account: ServiceAccount; sheetId: string; headerRow: number };

export type SheetConfigResult =
  | { status: "ready"; config: SheetConfig }
  | { status: "unconfigured"; missing: string[] }
  | { status: "invalid"; cause: string };

/** Identifiant seul, ou adresse complète `https://docs.google.com/spreadsheets/d/<id>/edit`. */
export function extractSheetId(raw: string): string | null {
  const value = raw.trim();
  const fromUrl = /\/spreadsheets\/d\/([A-Za-z0-9_-]+)/.exec(value)?.[1];
  const id = fromUrl ?? value;
  return /^[A-Za-z0-9_-]{20,100}$/.test(id) ? id : null;
}

export function readSheetConfig(env: Env = process.env): SheetConfigResult {
  const clientEmail = env[PROSPECTION_SHEET_ENV.clientEmail]?.trim() ?? "";
  const privateKey = env[PROSPECTION_SHEET_ENV.privateKey]?.trim() ?? "";
  const rawSheetId = env[PROSPECTION_SHEET_ENV.sheetId]?.trim() ?? "";
  const missing: string[] = [];
  if (!clientEmail) missing.push(PROSPECTION_SHEET_ENV.clientEmail);
  if (!privateKey) missing.push(PROSPECTION_SHEET_ENV.privateKey);
  if (!rawSheetId) missing.push(PROSPECTION_SHEET_ENV.sheetId);
  if (missing.length > 0) return { status: "unconfigured", missing };

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientEmail)) {
    return { status: "invalid", cause: `${PROSPECTION_SHEET_ENV.clientEmail} n'est pas une adresse e-mail.` };
  }
  const sheetId = extractSheetId(rawSheetId);
  if (!sheetId) return { status: "invalid", cause: `${PROSPECTION_SHEET_ENV.sheetId} n'est pas un identifiant de Sheet.` };
  const rawRow = env[PROSPECTION_SHEET_ENV.headerRow]?.trim() ?? "";
  const headerRow = rawRow === "" ? DEFAULT_HEADER_ROW : Number(rawRow);
  if (!Number.isInteger(headerRow) || headerRow < 1 || headerRow > MAX_HEADER_ROW) {
    return { status: "invalid", cause: `${PROSPECTION_SHEET_ENV.headerRow} doit être un nombre entre 1 et ${MAX_HEADER_ROW}.` };
  }
  return { status: "ready", config: { account: { clientEmail, privateKey }, sheetId, headerRow } };
}

/* ---------- Normalisation et en-têtes ---------- */

/** « Statut (étape) » → « statut » ; « Société » → « societe » ; « Nom de l'entreprise » → « nom de l entreprise ». */
export function normalizeLabel(value: unknown): string {
  if (typeof value !== "string" && typeof value !== "number") return "";
  return String(value)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export type SheetField = "company" | "stage" | "city" | "owner" | "reminder" | "lastContact";

export const SHEET_FIELD_LABELS: Record<SheetField, string> = {
  company: "Entreprise",
  stage: "Statut",
  city: "Ville",
  owner: "Commercial",
  reminder: "Date de rappel",
  lastContact: "Dernier contact",
};

export const HEADER_SYNONYMS: Record<SheetField, readonly string[]> = {
  company: ["entreprise", "societe", "raison sociale", "nom de l entreprise", "nom entreprise", "nom de la societe"],
  stage: ["statut", "etape", "statut du prospect", "etape du prospect"],
  city: ["ville", "commune", "localite"],
  owner: ["commercial", "commerciale", "commercial e", "responsable", "suivi par"],
  reminder: ["date de rappel", "rappel", "relance", "date de relance", "prochain rappel", "prochaine relance", "a rappeler le"],
  lastContact: ["dernier contact", "date du dernier contact", "date dernier contact"],
};

export const REQUIRED_FIELDS: readonly SheetField[] = ["company", "stage"];
export const OPTIONAL_FIELDS: readonly SheetField[] = ["city", "owner", "reminder", "lastContact"];

export type ColumnMap = Partial<Record<SheetField, number>>;

export function mapHeaderRow(row: readonly unknown[]): ColumnMap {
  const normalized = row.map(normalizeLabel);
  const map: ColumnMap = {};
  for (const field of Object.keys(HEADER_SYNONYMS) as SheetField[]) {
    const index = normalized.findIndex((label) => label !== "" && HEADER_SYNONYMS[field].includes(label));
    if (index >= 0) map[field] = index;
  }
  return map;
}

/* ---------- Étapes ---------- */

const STAGE_BY_ALIAS = new Map<string, ProspectStage>(
  PROSPECT_STAGES.flatMap((stage) => PROSPECT_STAGE_ALIASES[stage].map((alias) => [alias, stage] as const))
);

/** Étape connue, ou `null` (regroupée dans « Autre » avec son libellé). Préfixe numéroté accepté : « 2. Contacté ». */
export function matchStage(value: unknown): ProspectStage | null {
  const label = normalizeLabel(value).replace(/^\d+\s+/, "");
  return STAGE_BY_ALIAS.get(label) ?? null;
}

/* ---------- Dates ---------- */

const SERIAL_EPOCH = Date.UTC(1899, 11, 30);

function validKey(y: number, m: number, d: number): string | null {
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  if (y < 2000 || y > 2100) return null;
  return date.toISOString().slice(0, 10);
}

/**
 * Jour civil « AAAA-MM-JJ » d'une cellule : date Google (numéro de série), « jj/mm/aaaa » (ou « - », « . »,
 * année sur deux chiffres), ISO « aaaa-mm-jj » avec ou sans heure. `null` si vide ou illisible.
 */
export function parseSheetDate(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    if (value < 36_526 || value > 73_051) return null; // 2000-01-01 → 2100-01-01
    return new Date(SERIAL_EPOCH + Math.floor(value) * 86_400_000).toISOString().slice(0, 10);
  }
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (!text) return null;
  const iso = /^(\d{4})-(\d{2})-(\d{2})(?:[T\s].*)?$/.exec(text);
  if (iso) return validKey(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  const fr = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})(?:\s.*)?$/.exec(text);
  if (fr) {
    const year = fr[3]!.length === 2 ? 2000 + Number(fr[3]) : Number(fr[3]);
    return validKey(year, Number(fr[2]), Number(fr[1]));
  }
  return null;
}

/** Jour civil à Paris. */
export function parisToday(now: Date) {
  return toParisDateTimeInput(now).slice(0, 10);
}

/** Lundi de la semaine (jours civils). */
export function mondayOf(dayKey: string) {
  const [y, m, d] = dayKey.split("-").map(Number) as [number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d));
  const offset = (date.getUTCDay() + 6) % 7;
  return new Date(Date.UTC(y, m - 1, d - offset)).toISOString().slice(0, 10);
}

/* ---------- Agrégats ---------- */

export type Reminder = { company: string; city: string | null; owner: string | null; date: string; tab: string };

export type CountItem = { label: string; count: number };

export type Decision = {
  id: "refused" | "spam" | "conversations" | "off_target" | "objection" | "interviews";
  observation: string;
  decision: string;
  /** `act` : seuil atteint, décision à prendre ; `ok` : pas atteint ; `pending` : trop tôt ; `unknown` : pas dans la Sheet. */
  status: "act" | "ok" | "pending" | "unknown";
  detail: string;
};

export type FridayReview = {
  contacted: number;
  conversations: number;
  interviews: number;
  demos: number;
  interested: number;
  doNotContact: number;
  /** Dernier contact depuis lundi (Paris) ; `null` sans colonne « Dernier contact ». */
  contactedThisWeek: number | null;
};

export type SheetTabReport = { title: string; prospects: number; missingOptional: string[]; cityFromTab: boolean };
export type IgnoredTab = { title: string; missing: string[] };

export type ProspectionSummary = {
  headerRow: number;
  today: string;
  total: number;
  byStage: Array<{ stage: ProspectStage; label: string; count: number }>;
  otherStages: CountItem[];
  otherStagesTotal: number;
  byCity: CountItem[];
  byCityOthers: number;
  byOwner: CountItem[];
  byOwnerOthers: number;
  reminders: {
    today: Reminder[];
    overdue: Reminder[];
    todayTotal: number;
    overdueTotal: number;
    unreadableDates: number;
    /** `false` : aucun onglet n'a de colonne de rappel. */
    available: boolean;
  };
  review: FridayReview;
  decisions: Decision[];
  tabs: SheetTabReport[];
  ignoredTabs: IgnoredTab[];
};

export type ParseResult = { status: "ok"; summary: ProspectionSummary } | { status: "no_headers"; missing: string[]; ignoredTabs: IgnoredTab[] };

const text = (value: unknown) => (typeof value === "string" ? value.trim() : typeof value === "number" ? String(value) : "");

function topCounts(counts: Map<string, number>, shown: number): { items: CountItem[]; others: number } {
  const sorted = [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "fr"));
  return { items: sorted.slice(0, shown), others: sorted.slice(shown).reduce((sum, item) => sum + item.count, 0) };
}

function bump(map: Map<string, number>, key: string) {
  map.set(key, (map.get(key) ?? 0) + 1);
}

/** Regroupe « marseille » et « Marseille » sous le premier libellé rencontré. */
function bumpLabel(map: Map<string, number>, labels: Map<string, string>, raw: string) {
  const key = normalizeLabel(raw) || raw;
  if (!labels.has(key)) labels.set(key, raw);
  bump(map, labels.get(key)!);
}

const byDateThenCompany = (a: Reminder, b: Reminder) => a.date.localeCompare(b.date) || a.company.localeCompare(b.company, "fr");

/** Seuils de décision de la revue du vendredi (README de prospection, partie 9), quand la Sheet permet de les calculer. */
export function buildDecisions(review: FridayReview): Decision[] {
  const unknown = "Pas dans la Sheet : à compter dans la boîte mail.";
  const { contacted, conversations, interviews } = review;
  return [
    {
      id: "refused",
      observation: "Plus de 3 adresses refusées sur 20",
      decision: "Arrêter les envois et nettoyer la liste",
      status: "unknown",
      detail: unknown,
    },
    {
      id: "spam",
      observation: "Un message marqué comme indésirable ou une plainte",
      decision: "Arrêter, relire le mail et la source de l'adresse",
      status: "unknown",
      detail: unknown,
    },
    {
      id: "conversations",
      observation: "Moins de 2 conversations sur 30 entreprises",
      decision: "Changer l'objet et la question, ou appeler d'abord",
      status: contacted < 30 ? "pending" : conversations * 30 < 2 * contacted ? "act" : "ok",
      detail:
        contacted < 30
          ? `${contacted} entreprise${contacted > 1 ? "s" : ""} contactée${contacted > 1 ? "s" : ""} sur les 30 nécessaires.`
          : `${conversations} conversation${conversations > 1 ? "s" : ""} pour ${contacted} entreprises contactées.`,
    },
    {
      id: "off_target",
      observation: "Beaucoup de réponses à côté (pas des coursiers)",
      decision: "Revoir la liste, pas le message",
      status: "unknown",
      detail: unknown,
    },
    {
      id: "objection",
      observation: "La même objection trois fois",
      decision: "La remonter : elle compte plus qu'une idée isolée",
      status: "unknown",
      detail: "Pas dans la Sheet : à relever dans les notes d'entretien.",
    },
    {
      id: "interviews",
      observation: "10 entretiens faits",
      decision: "Écrire la synthèse pour PROD-02 et choisir le problème numéro un",
      status: interviews >= 10 ? "act" : "ok",
      detail: `${interviews} entretien${interviews > 1 ? "s" : ""} fait${interviews > 1 ? "s" : ""} sur 10.`,
    },
  ];
}

/** Lecture pure des onglets : colonnes par en-tête, étapes, villes, commerciaux, rappels et revue du vendredi. */
export function summarizeProspectionTabs(tabs: SheetTab[], options: { headerRow: number; today: string }): ParseResult {
  const { headerRow, today } = options;
  const monday = mondayOf(today);
  const ignoredTabs: IgnoredTab[] = [];
  const reports: SheetTabReport[] = [];
  const stageCounts = new Map<ProspectStage, number>();
  const otherCounts = new Map<string, number>();
  const otherLabels = new Map<string, string>();
  const cityCounts = new Map<string, number>();
  const cityLabels = new Map<string, string>();
  const ownerCounts = new Map<string, number>();
  const ownerLabels = new Map<string, string>();
  const todayList: Reminder[] = [];
  const overdueList: Reminder[] = [];
  let unreadableDates = 0;
  let total = 0;
  let reminderColumn = false;
  let lastContactColumn = false;
  let contactedThisWeek = 0;

  for (const tab of tabs) {
    const columns = mapHeaderRow(tab.values[headerRow - 1] ?? []);
    const missingRequired = REQUIRED_FIELDS.filter((field) => columns[field] === undefined);
    if (missingRequired.length > 0) {
      ignoredTabs.push({ title: tab.title, missing: missingRequired.map((field) => SHEET_FIELD_LABELS[field]) });
      continue;
    }
    const cityFromTab = columns.city === undefined;
    const missingOptional = OPTIONAL_FIELDS.filter((field) => columns[field] === undefined).map((field) => SHEET_FIELD_LABELS[field]);
    if (columns.reminder !== undefined) reminderColumn = true;
    if (columns.lastContact !== undefined) lastContactColumn = true;
    let prospects = 0;

    for (const row of tab.values.slice(headerRow)) {
      const company = text(row[columns.company!]);
      if (!company) continue;
      prospects += 1;
      total += 1;

      const rawStage = text(row[columns.stage!]);
      const stage = matchStage(rawStage);
      if (stage) stageCounts.set(stage, (stageCounts.get(stage) ?? 0) + 1);
      else bumpLabel(otherCounts, otherLabels, rawStage ? rawStage.slice(0, 60) : "Sans statut");

      const city = columns.city !== undefined ? text(row[columns.city]) : tab.title.trim();
      bumpLabel(cityCounts, cityLabels, city ? city.slice(0, 60) : "Sans ville");
      const owner = columns.owner !== undefined ? text(row[columns.owner]) : "";
      if (columns.owner !== undefined) bumpLabel(ownerCounts, ownerLabels, owner ? owner.slice(0, 60) : "Non attribué");

      if (columns.lastContact !== undefined) {
        const last = parseSheetDate(row[columns.lastContact]);
        if (last && last >= monday && last <= today) contactedThisWeek += 1;
      }

      if (columns.reminder !== undefined && !(stage && NO_REMINDER_STAGES.includes(stage))) {
        const raw = row[columns.reminder];
        const date = parseSheetDate(raw);
        if (!date) {
          if (text(raw)) unreadableDates += 1;
        } else if (date <= today) {
          const reminder: Reminder = {
            company: company.slice(0, 120),
            city: city ? city.slice(0, 60) : null,
            owner: owner ? owner.slice(0, 60) : null,
            date,
            tab: tab.title,
          };
          (date === today ? todayList : overdueList).push(reminder);
        }
      }
    }
    reports.push({ title: tab.title, prospects, missingOptional, cityFromTab });
  }

  if (reports.length === 0) {
    const missing = [...new Set(ignoredTabs.flatMap((tab) => tab.missing))];
    return { status: "no_headers", missing: missing.length > 0 ? missing : REQUIRED_FIELDS.map((f) => SHEET_FIELD_LABELS[f]), ignoredTabs };
  }

  const countOf = (stages: readonly ProspectStage[]) => stages.reduce((sum, stage) => sum + (stageCounts.get(stage) ?? 0), 0);
  const review: FridayReview = {
    contacted: countOf(CONTACTED_STAGES),
    conversations: countOf(AT_LEAST.conversations),
    interviews: countOf(AT_LEAST.interviews),
    demos: countOf(AT_LEAST.demos),
    interested: countOf(AT_LEAST.interested),
    doNotContact: countOf(["DO_NOT_CONTACT"]),
    contactedThisWeek: lastContactColumn ? contactedThisWeek : null,
  };
  const others = topCounts(otherCounts, BREAKDOWN_SHOWN);
  const cities = topCounts(cityCounts, BREAKDOWN_SHOWN);
  const owners = topCounts(ownerCounts, BREAKDOWN_SHOWN);
  todayList.sort(byDateThenCompany);
  overdueList.sort(byDateThenCompany);

  return {
    status: "ok",
    summary: {
      headerRow,
      today,
      total,
      byStage: PROSPECT_STAGES.map((stage) => ({ stage, label: PROSPECT_STAGE_LABELS[stage], count: stageCounts.get(stage) ?? 0 })),
      otherStages: others.items,
      otherStagesTotal: [...otherCounts.values()].reduce((sum, value) => sum + value, 0),
      byCity: cities.items,
      byCityOthers: cities.others,
      byOwner: owners.items,
      byOwnerOthers: owners.others,
      reminders: {
        today: todayList.slice(0, REMINDERS_SHOWN),
        overdue: overdueList.slice(0, REMINDERS_SHOWN),
        todayTotal: todayList.length,
        overdueTotal: overdueList.length,
        unreadableDates,
        available: reminderColumn,
      },
      review,
      decisions: buildDecisions(review),
      tabs: reports,
      ignoredTabs,
    },
  };
}

/* ---------- Lecture en direct, avec cache ---------- */

export type ProspectionSheetView =
  | { status: "unconfigured"; missing: string[]; headerRow: number }
  | { status: "unavailable"; cause: string; checkedAt: string; missingHeaders?: string[]; ignoredTabs?: IgnoredTab[] }
  | ({ status: "ready"; readAt: string; nextReadAt: string } & ProspectionSummary);

const CAUSES: Record<GoogleSheetsErrorCode, string> = {
  invalid_key: "Clé du compte de service illisible : recopiez la valeur « private_key » du fichier JSON.",
  token_refused: "Google refuse le compte de service : vérifiez son e-mail et sa clé.",
  access_denied:
    "Accès refusé : partagez la Sheet en lecture avec l'e-mail du compte de service et activez l'API Google Sheets.",
  not_found: "Sheet introuvable : vérifiez PROSPECTION_SHEET_ID.",
  rate_limited: "Quota Google dépassé : nouvel essai dans une minute.",
  timeout: "Google Sheets n'a pas répondu à temps.",
  google_unavailable: "Google Sheets ne répond pas pour le moment.",
  invalid_response: "Réponse inattendue de Google Sheets.",
};

/** Cause affichable d'une erreur : texte générique choisi ici, jamais le message d'origine. */
export function causeOf(error: unknown): { cause: string; code: string } {
  if (error instanceof GoogleSheetsError) return { cause: CAUSES[error.code], code: error.message };
  return { cause: "Lecture de la Sheet impossible.", code: "unexpected" };
}

type Logger = (message: string, code: string) => void;
type ReadDeps = SheetsDeps & {
  env?: Env;
  nowDate?: () => Date;
  log?: Logger;
  readTabs?: (sheetId: string, account: ServiceAccount, deps: SheetsDeps) => Promise<SheetTab[]>;
};

let cache: { key: string; expiresAt: number; view: ProspectionSheetView } | null = null;

export function clearProspectionSheetCache() {
  cache = null;
}

export async function readProspectionSheet(deps: ReadDeps = {}): Promise<ProspectionSheetView> {
  const now = (deps.nowDate ?? (() => new Date()))();
  const config = readSheetConfig(deps.env);
  if (config.status === "unconfigured") return { status: "unconfigured", missing: config.missing, headerRow: DEFAULT_HEADER_ROW };
  if (config.status === "invalid") return { status: "unavailable", cause: config.cause, checkedAt: now.toISOString() };

  const { account, sheetId, headerRow } = config.config;
  const key = `${sheetId}:${headerRow}:${account.clientEmail}`;
  if (cache && cache.key === key && cache.expiresAt > now.getTime()) return cache.view;

  let view: ProspectionSheetView;
  try {
    const tabs = await (deps.readTabs ?? readSpreadsheetTabs)(sheetId, account, deps);
    const parsed = summarizeProspectionTabs(tabs, { headerRow, today: parisToday(now) });
    if (parsed.status === "no_headers") {
      view = {
        status: "unavailable",
        cause: `En-têtes introuvables sur la ligne ${headerRow} : ${parsed.missing.join(", ")}. Aucun onglet ne les contient.`,
        checkedAt: now.toISOString(),
        missingHeaders: parsed.missing,
        ignoredTabs: parsed.ignoredTabs.slice(0, 30),
      };
    } else {
      view = {
        status: "ready",
        readAt: now.toISOString(),
        nextReadAt: new Date(now.getTime() + SHEET_CACHE_MS).toISOString(),
        ...parsed.summary,
      };
    }
  } catch (error) {
    const { cause, code } = causeOf(error);
    (deps.log ?? ((message, detail) => console.error(message, detail)))("[prospection-sheet] lecture impossible", code);
    view = { status: "unavailable", cause, checkedAt: now.toISOString() };
  }
  cache = { key, expiresAt: now.getTime() + (view.status === "ready" ? SHEET_CACHE_MS : SHEET_FAILURE_CACHE_MS), view };
  return view;
}
