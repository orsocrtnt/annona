import type { SystemRole } from "@prisma/client";
import { prisma } from "@/services/prisma/client";
import { FULFILLMENT_STATUS_LABELS } from "@/lib/constants/order-status";
import { ROLE_LABELS } from "@/lib/permissions/rbac";
import { createMemoryRateLimiter, type MemoryRateLimiter } from "@/lib/security/memory-rate-limit";

/**
 * ADMIN-ESPACE, lot 3 : recherche globale du super-administrateur (barre du haut, ⌘K / Ctrl+K).
 * Une requête HTTP, trois lectures parallèles bornées (5 résultats par type, +1 pour savoir s'il y en a plus),
 * `select` minimal : ni téléphone, ni message, ni identifiant de connexion, ni réglages.
 * Recherche insensible à la casse (ILIKE). Pas insensible aux accents : il faudrait l'extension `unaccent`
 * (migration) et du SQL brut, exclus de ce lot.
 */

export const ADMIN_SEARCH_MIN_LENGTH = 2;
export const ADMIN_SEARCH_MAX_LENGTH = 80;
export const ADMIN_SEARCH_PER_GROUP = 5;
const MAX_TOKENS = 5;
/** Débit : 60 recherches par minute et par compte, en mémoire de l'instance (la saisie est temporisée). */
export const ADMIN_SEARCH_RATE = { limit: 60, windowMs: 60_000 } as const;

export type AdminSearchType = "companies" | "users" | "orders";

export const ADMIN_SEARCH_GROUPS: ReadonlyArray<{ type: AdminSearchType; label: string }> = [
  { type: "companies", label: "Entreprises" },
  { type: "users", label: "Utilisateurs" },
  { type: "orders", label: "Commandes" },
];

export type AdminSearchItem = {
  id: string;
  type: AdminSearchType;
  title: string;
  /** Ligne secondaire : e-mail, entreprise, état. */
  detail: string;
  badge: string | null;
  href: string;
};

export type AdminSearchGroup = {
  type: AdminSearchType;
  label: string;
  /** `null` : lecture de ce groupe impossible (« Indisponible »). */
  items: AdminSearchItem[] | null;
  hasMore: boolean;
};

export type AdminSearchResult = { q: string; groups: AdminSearchGroup[] };

/* ---------- Paramètres ---------- */

export function parseAdminSearchParams(
  search: URLSearchParams
): { query: { q: string } } | { error: string } {
  for (const key of search.keys()) {
    if (key !== "q") return { error: "Paramètre inconnu" };
  }
  if (search.getAll("q").length > 1) return { error: "Paramètre en double" };
  // Caractères de contrôle retirés, espaces regroupés : « Ada   Lovelace » = « Ada Lovelace ».
  const q = (search.get("q") ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  if (q.length < ADMIN_SEARCH_MIN_LENGTH) return { error: "Recherche trop courte (2 caractères au moins)" };
  if (q.length > ADMIN_SEARCH_MAX_LENGTH) return { error: "Recherche trop longue (80 caractères au plus)" };
  return { query: { q } };
}

/** `%`, `_` et `\` sont des jokers de LIKE que Prisma 5 n'échappe pas dans `contains` : ils restent littéraux. */
export function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

/** Mots de la recherche, échappés ; tous doivent correspondre (« ada lovelace » trouve Ada Lovelace). */
export function searchTokens(q: string): string[] {
  return [...new Set(q.toLowerCase().split(" ").filter(Boolean))].slice(0, MAX_TOKENS).map(escapeLike);
}

const contains = (token: string) => ({ contains: token, mode: "insensitive" as const });

function everyToken(tokens: string[], fields: string[]) {
  return tokens.map((token) => ({ OR: fields.map((field) => ({ [field]: contains(token) })) }));
}

export function adminSearchQueries(q: string) {
  const tokens = searchTokens(q);
  const take = ADMIN_SEARCH_PER_GROUP + 1;
  return {
    companies: {
      where: { AND: everyToken(tokens, ["name"]) },
      orderBy: [{ updatedAt: "desc" as const }, { id: "asc" as const }],
      take,
      select: { id: true, name: true, status: true },
    },
    users: {
      where: { AND: everyToken(tokens, ["firstName", "lastName", "email"]) },
      orderBy: [{ createdAt: "desc" as const }, { id: "asc" as const }],
      take,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: { select: { systemRole: true } },
        company: { select: { id: true, name: true } },
      },
    },
    orders: {
      where: { AND: everyToken(tokens, ["reference"]) },
      orderBy: [{ createdAt: "desc" as const }, { id: "asc" as const }],
      take,
      select: { id: true, reference: true, status: true, company: { select: { id: true, name: true } } },
    },
  };
}

/* ---------- Résultats ---------- */

type CompanyRow = { id: string; name: string; status: string };
type UserRow = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: { systemRole: SystemRole };
  company: { id: string; name: string } | null;
};
type OrderRow = { id: string; reference: string; status: string; company: { id: string; name: string } };

const COMPANY_STATUS: Record<string, string> = { ACTIVE: "Active", INACTIVE: "Inactive", SUSPENDED: "Suspendue", TRIAL: "Essai" };

function join(...parts: Array<string | null | undefined>) {
  return parts.filter((part) => part && part.trim()).join(" · ");
}

export function toCompanyItem(row: CompanyRow): AdminSearchItem {
  return {
    id: row.id,
    type: "companies",
    title: row.name,
    detail: COMPANY_STATUS[row.status] ?? row.status,
    badge: null,
    href: `/companies/${encodeURIComponent(row.id)}`,
  };
}

/** Utilisateur : sa fiche entreprise (équipe et rôles) ; sans entreprise, la liste Utilisateurs filtrée. */
export function toUserItem(row: UserRow): AdminSearchItem {
  const name = `${row.firstName} ${row.lastName}`.trim() || row.email;
  return {
    id: row.id,
    type: "users",
    title: name,
    detail: join(row.email, row.company?.name),
    badge: ROLE_LABELS[row.role.systemRole] ?? null,
    href: row.company
      ? `/companies/${encodeURIComponent(row.company.id)}`
      : `/admin/users?q=${encodeURIComponent(row.lastName.trim() || row.firstName.trim())}`,
  };
}

/** Commande : aucune page plateforme ne montre une commande, on ouvre la fiche de son entreprise. */
export function toOrderItem(row: OrderRow): AdminSearchItem {
  return {
    id: row.id,
    type: "orders",
    title: row.reference,
    detail: row.company.name,
    badge: FULFILLMENT_STATUS_LABELS[row.status as keyof typeof FULFILLMENT_STATUS_LABELS] ?? null,
    href: `/companies/${encodeURIComponent(row.company.id)}`,
  };
}

type Args = Record<string, unknown>;

export type AdminSearchDatabase = {
  company: { findMany: (args: Args) => Promise<CompanyRow[]> };
  user: { findMany: (args: Args) => Promise<UserRow[]> };
  order: { findMany: (args: Args) => Promise<OrderRow[]> };
};

async function readGroup<T>(
  type: AdminSearchType,
  read: () => Promise<T[]>,
  map: (row: T) => AdminSearchItem
): Promise<AdminSearchGroup> {
  const label = ADMIN_SEARCH_GROUPS.find((group) => group.type === type)!.label;
  try {
    const rows = await read();
    return { type, label, items: rows.slice(0, ADMIN_SEARCH_PER_GROUP).map(map), hasMore: rows.length > ADMIN_SEARCH_PER_GROUP };
  } catch {
    return { type, label, items: null, hasMore: false };
  }
}

export async function searchPlatform(
  query: { q: string },
  db: AdminSearchDatabase = prisma as unknown as AdminSearchDatabase
): Promise<AdminSearchResult> {
  const queries = adminSearchQueries(query.q);
  const groups = await Promise.all([
    readGroup("companies", () => db.company.findMany(queries.companies), toCompanyItem),
    readGroup("users", () => db.user.findMany(queries.users), toUserItem),
    readGroup("orders", () => db.order.findMany(queries.orders), toOrderItem),
  ]);
  return { q: query.q, groups };
}

/* ---------- Débit ---------- */

const searchLimiter: MemoryRateLimiter = createMemoryRateLimiter({
  limit: ADMIN_SEARCH_RATE.limit,
  windowMs: ADMIN_SEARCH_RATE.windowMs,
  maxKeys: 500,
});

/** `false` : plus de 60 recherches dans la minute pour ce compte (réponse 429). */
export function allowAdminSearch(actorId: string, now = Date.now(), limiter: MemoryRateLimiter = searchLimiter) {
  return limiter.allow(`admin-search:${actorId}`, now);
}
