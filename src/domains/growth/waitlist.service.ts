import { z } from "zod";
import { WAITLIST_MESSAGE } from "@/domains/growth/contact.service";
import { prisma } from "@/services/prisma/client";

/**
 * ADMIN-ESPACE, lot 2 : inscriptions à la liste d'attente (/tarifs), lues et suivies par le super-administrateur.
 * Elles restent des messages Contact (même table, même conservation), reconnues par leur message fixe.
 */

export const WAITLIST_PAGE_SIZES = [25, 50, 100] as const;
export const WAITLIST_CONTACTED_FILTERS = ["all", "yes", "no"] as const;
/** Export CSV : au-delà, l'export est tronqué (le volume attendu se compte en centaines). */
export const WAITLIST_EXPORT_MAX = 5_000;
const LIST_PARAMS = ["page", "pageSize", "q", "contacted"] as const;
const EXPORT_PARAMS = ["q", "contacted"] as const;

export type WaitlistContactedFilter = (typeof WAITLIST_CONTACTED_FILTERS)[number];
export type WaitlistFilters = { q: string; contacted: WaitlistContactedFilter };
export type WaitlistListQuery = WaitlistFilters & { page: number; pageSize: number };

export type WaitlistEntry = {
  id: string;
  name: string;
  company: string | null;
  email: string;
  phone: string | null;
  campaignCode: string | null;
  createdAt: string;
  contactedAt: string | null;
  contactedBy: string | null;
};

export type WaitlistPage = {
  items: WaitlistEntry[];
  total: number;
  page: number;
  pageSize: number;
  /** Compteurs sur toute la liste, sans filtre (pour les onglets « pas encore » / « contacté »). */
  summary: { total: number; contacted: number; notContacted: number };
};

function parseFilters(search: URLSearchParams): WaitlistFilters | { error: string } {
  const q = (search.get("q") ?? "").trim();
  if (q.length > 120) return { error: "Recherche trop longue" };
  const contacted = search.get("contacted") ?? "all";
  if (!WAITLIST_CONTACTED_FILTERS.includes(contacted as WaitlistContactedFilter)) return { error: "Filtre invalide" };
  return { q, contacted: contacted as WaitlistContactedFilter };
}

function rejectUnknown(search: URLSearchParams, allowed: readonly string[]) {
  for (const key of search.keys()) if (!allowed.includes(key)) return { error: "Paramètre inconnu" } as const;
  return null;
}

export function parseWaitlistListParams(search: URLSearchParams): { query: WaitlistListQuery } | { error: string } {
  const unknown = rejectUnknown(search, LIST_PARAMS);
  if (unknown) return unknown;
  const page = Number(search.get("page") ?? "1");
  const pageSize = Number(search.get("pageSize") ?? "25");
  if (!Number.isInteger(page) || page < 1 || page > 10_000) return { error: "Page invalide" };
  if (!WAITLIST_PAGE_SIZES.includes(pageSize as (typeof WAITLIST_PAGE_SIZES)[number])) return { error: "Taille de page invalide" };
  const filters = parseFilters(search);
  if ("error" in filters) return filters;
  return { query: { ...filters, page, pageSize } };
}

export function parseWaitlistExportParams(search: URLSearchParams): { query: WaitlistFilters } | { error: string } {
  const unknown = rejectUnknown(search, EXPORT_PARAMS);
  if (unknown) return unknown;
  const filters = parseFilters(search);
  return "error" in filters ? filters : { query: filters };
}

/** Filtre Prisma : liste d'attente seulement, recherche sans casse sur nom, entreprise, e-mail et téléphone. */
export function waitlistWhere(filters: WaitlistFilters) {
  return {
    message: WAITLIST_MESSAGE,
    ...(filters.contacted === "yes" ? { contactedAt: { not: null } } : {}),
    ...(filters.contacted === "no" ? { contactedAt: null } : {}),
    ...(filters.q
      ? {
          OR: (["name", "company", "email", "phone", "campaignCode"] as const).map((field) => ({
            [field]: { contains: filters.q, mode: "insensitive" as const },
          })),
        }
      : {}),
  };
}

const ENTRY_SELECT = {
  id: true,
  name: true,
  company: true,
  email: true,
  phone: true,
  campaignCode: true,
  createdAt: true,
  contactedAt: true,
  contactedBy: { select: { firstName: true, lastName: true } },
} as const;

type RawEntry = {
  id: string;
  name: string;
  company: string | null;
  email: string;
  phone: string | null;
  campaignCode: string | null;
  createdAt: Date;
  contactedAt: Date | null;
  contactedBy: { firstName: string; lastName: string } | null;
};

function toEntry(row: RawEntry): WaitlistEntry {
  return {
    id: row.id,
    name: row.name,
    company: row.company,
    email: row.email,
    phone: row.phone,
    campaignCode: row.campaignCode,
    createdAt: row.createdAt.toISOString(),
    contactedAt: row.contactedAt ? row.contactedAt.toISOString() : null,
    contactedBy: row.contactedBy ? `${row.contactedBy.firstName} ${row.contactedBy.lastName}`.trim() : null,
  };
}

export type WaitlistDatabase = {
  contactMessage: {
    count: (args: { where: Record<string, unknown> }) => Promise<number>;
    findMany: (args: Record<string, unknown>) => Promise<RawEntry[]>;
    findFirst: (args: Record<string, unknown>) => Promise<{ id: string; contactedAt: Date | null } | null>;
    update: (args: Record<string, unknown>) => Promise<unknown>;
  };
};

const defaultDb = () => prisma as unknown as WaitlistDatabase;
const ORDER = [{ createdAt: "desc" }, { id: "desc" }] as const;

export async function listWaitlistEntries(query: WaitlistListQuery, db: WaitlistDatabase = defaultDb()): Promise<WaitlistPage> {
  const where = waitlistWhere(query);
  const all = waitlistWhere({ q: "", contacted: "all" });
  const [total, items, summaryTotal, contacted] = await Promise.all([
    db.contactMessage.count({ where }),
    db.contactMessage.findMany({
      where,
      orderBy: ORDER,
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      // L'empreinte de source reste interne : elle n'est jamais renvoyée.
      select: ENTRY_SELECT,
    }),
    db.contactMessage.count({ where: all }),
    db.contactMessage.count({ where: waitlistWhere({ q: "", contacted: "yes" }) }),
  ]);
  return {
    items: items.map(toEntry),
    total,
    page: query.page,
    pageSize: query.pageSize,
    summary: { total: summaryTotal, contacted, notContacted: summaryTotal - contacted },
  };
}

export const waitlistContactedSchema = z.object({ contacted: z.boolean() }).strict();

export type WaitlistContactedResult = { status: "updated" | "unchanged"; entry: WaitlistEntry } | { status: "not_found" };

/**
 * Case « contacté » : cochée, garde la première date et le premier auteur ; décochée, efface les deux.
 * Seules les inscriptions à la liste d'attente sont modifiables (jamais un message Contact).
 */
export async function setWaitlistContacted(
  id: string,
  contacted: boolean,
  actorId: string,
  options: { now?: Date; db?: WaitlistDatabase } = {}
): Promise<WaitlistContactedResult> {
  const db = options.db ?? defaultDb();
  const where = { id, message: WAITLIST_MESSAGE };
  const current = await db.contactMessage.findFirst({ where, select: { id: true, contactedAt: true } });
  if (!current) return { status: "not_found" };
  const unchanged = contacted ? current.contactedAt !== null : current.contactedAt === null;
  if (!unchanged) {
    await db.contactMessage.update({
      where: { id },
      data: contacted
        ? { contactedAt: options.now ?? new Date(), contactedById: actorId }
        : { contactedAt: null, contactedById: null },
    });
  }
  const [row] = await db.contactMessage.findMany({ where, select: ENTRY_SELECT, take: 1 });
  if (!row) return { status: "not_found" };
  return { status: unchanged ? "unchanged" : "updated", entry: toEntry(row) };
}

/* ---------- Export CSV (Excel français) ---------- */

const CSV_SEPARATOR = ";";
const CSV_BOM = "\uFEFF";
const csvDate = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Paris" });

/**
 * Cellule CSV sûre : une valeur commençant par `= + - @` (ou tabulation, retour chariot) est préfixée
 * d'une apostrophe pour qu'Excel ne l'exécute jamais comme formule ; valeur entre guillemets (guillemets
 * internes doublés) si elle contient le séparateur, un guillemet, un saut de ligne ou des espaces aux bords.
 */
export function csvCell(value: string | null | undefined): string {
  let text = value ?? "";
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  if (/[";\r\n]/.test(text) || text !== text.trim()) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export const WAITLIST_CSV_HEADERS = [
  "Inscrit le",
  "Prénom et nom",
  "Entreprise",
  "E-mail",
  "Téléphone",
  "Campagne",
  "Contacté",
  "Contacté le",
  "Contacté par",
] as const;

export function buildWaitlistCsv(entries: WaitlistEntry[]): string {
  const lines = [WAITLIST_CSV_HEADERS.map(csvCell).join(CSV_SEPARATOR)];
  for (const entry of entries) {
    lines.push(
      [
        csvDate.format(new Date(entry.createdAt)),
        entry.name,
        entry.company,
        entry.email,
        entry.phone,
        entry.campaignCode ?? "inconnue",
        entry.contactedAt ? "oui" : "non",
        entry.contactedAt ? csvDate.format(new Date(entry.contactedAt)) : "",
        entry.contactedBy ?? "",
      ]
        .map(csvCell)
        .join(CSV_SEPARATOR)
    );
  }
  // BOM pour qu'Excel lise l'UTF-8 (accents), fins de ligne Windows.
  return `${CSV_BOM}${lines.join("\r\n")}\r\n`;
}

export async function exportWaitlistCsv(
  filters: WaitlistFilters,
  db: WaitlistDatabase = defaultDb()
): Promise<{ csv: string; count: number; truncated: boolean }> {
  const rows = await db.contactMessage.findMany({
    where: waitlistWhere(filters),
    orderBy: ORDER,
    take: WAITLIST_EXPORT_MAX + 1,
    select: ENTRY_SELECT,
  });
  const entries = rows.slice(0, WAITLIST_EXPORT_MAX).map(toEntry);
  return { csv: buildWaitlistCsv(entries), count: entries.length, truncated: rows.length > WAITLIST_EXPORT_MAX };
}

/** Nom du fichier exporté : « liste-attente-2026-11-05.csv » (jour de Paris). */
export function waitlistCsvFilename(now: Date = new Date()): string {
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  return `liste-attente-${day}.csv`;
}
