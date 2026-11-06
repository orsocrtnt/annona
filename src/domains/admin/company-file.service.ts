import type { InvoiceStatus, SystemRole, UserStatus } from "@prisma/client";
import { prisma } from "@/services/prisma/client";
import {
  buildDailySeries,
  DELIVERED_STATUS,
  OPEN_TICKET_STATUSES,
  parisDayKey,
  parisDayStart,
  shiftDayKey,
  ADMIN_HOME_DAYS,
  type AdminHomeDay,
} from "@/domains/admin/admin-home.service";
import { getPlatformCompany, type PlatformCompanyDetail } from "@/domains/admin/companies.service";

/**
 * ADMIN-ESPACE, lot 3 : fiche entreprise complète du super-administrateur.
 * Une lecture serveur : la fiche existante (identité, chiffre d'affaires), puis l'activité
 * de l'entreprise en requêtes groupées et parallèles (`groupBy`, `count`, `select` minimal, aucun N+1).
 * Chaque bloc vaut `null` si sa lecture échoue : l'écran affiche « Indisponible », jamais un chiffre inventé.
 * Mois et jours à l'heure de Paris.
 */

export const COMPANY_TEAM_LIMIT = 20;
export const COMPANY_TICKETS_LIMIT = 5;

/** Ordre d'affichage des rôles d'une entreprise (le super-administrateur n'appartient à aucune entreprise). */
export const COMPANY_ROLE_ORDER: SystemRole[] = ["ADMIN", "BAKER", "DRIVER", "MERCHANT", "SUPER_ADMIN"];
/** Comptes comptés comme occupés : actifs ou invités (en attente de validation). */
const SEATED_STATUSES: UserStatus[] = ["ACTIVE", "PENDING_VERIFICATION"];
const BILLED_INVOICE_STATUSES: InvoiceStatus[] = ["PENDING", "PAID", "OVERDUE"];
/** Commandes non encore livrées (de la saisie à la préparation). */
const IN_PROGRESS_ORDER = new Set(["DRAFT", "VALIDATED", "LOCKED", "PREPARED"]);
const DONE_ORDER = new Set(["DELIVERED"]);

export type CompanyRoleSummary = {
  role: SystemRole;
  total: number;
  /** Actifs ou en attente de validation : comptés dans les places de l'offre. */
  seated: number;
  /** Connexion la plus récente parmi les comptes de ce rôle ; `null` = aucune connexion enregistrée. */
  lastLoginAt: string | null;
};

export type CompanyTeamMember = {
  id: string;
  name: string;
  role: SystemRole;
  status: UserStatus;
  lastLoginAt: string | null;
};

export type CompanyActivity = {
  generatedAt: string;
  /** Mois civil en cours à Paris : [début, fin[. */
  month: { startsAt: string; endsAt: string };
  users: { byRole: CompanyRoleSummary[]; team: CompanyTeamMember[]; teamTruncated: boolean } | null;
  deliveries: {
    /** Commandes créées dans le mois, réparties par état actuel. */
    created: number;
    inProgress: number;
    done: number;
    failed: number;
    cancelled: number;
    /** Commandes livrées dans le mois (date de livraison effective), même règle que l'accueil. */
    delivered: number;
  } | null;
  series: AdminHomeDay[] | null;
  /** Factures émises dans le mois (brouillons et annulées exclus). */
  invoices: { count: number; paidCents: number; pendingCents: number; overdueCents: number } | null;
  support: {
    open: number;
    latest: Array<{ id: string; subject: string; status: string; priority: string; createdAt: string }>;
  } | null;
};

export type PlatformCompanyFile = PlatformCompanyDetail & { activity: CompanyActivity };

type Args = Record<string, unknown>;

export type CompanyFileDatabase = {
  user: {
    groupBy: (args: Args) => Promise<Array<{ roleId: string; status: UserStatus; _count: { _all: number }; _max: { lastLoginAt: Date | null } }>>;
    findMany: (args: Args) => Promise<Array<{ id: string; firstName: string; lastName: string; status: UserStatus; lastLoginAt: Date | null; role: { systemRole: SystemRole } }>>;
  };
  role: { findMany: (args: Args) => Promise<Array<{ id: string; systemRole: SystemRole }>> };
  order: {
    groupBy: (args: Args) => Promise<Array<{ status: string; _count: { _all: number } }>>;
    count: (args: Args) => Promise<number>;
    findMany: (args: Args) => Promise<Array<{ createdAt: Date; deliveredAt?: Date | null }>>;
  };
  invoice: {
    groupBy: (args: Args) => Promise<Array<{ status: InvoiceStatus; _count: { _all: number }; _sum: { totalCents: number | null } }>>;
  };
  supportTicket: {
    count: (args: Args) => Promise<number>;
    findMany: (args: Args) => Promise<Array<{ id: string; subject: string; status: string; priority: string; createdAt: Date }>>;
  };
};

/* ---------- Bornes ---------- */

/** Mois civil à Paris contenant `now` : minuit du 1er à minuit du 1er du mois suivant (instants UTC). */
export function parisMonthBounds(now: Date) {
  const [year, month] = parisDayKey(now).split("-").map(Number) as [number, number];
  const first = `${year}-${String(month).padStart(2, "0")}-01`;
  const next = new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10);
  return { startsAt: parisDayStart(first), endsAt: parisDayStart(next) };
}

/* ---------- Mise en forme (pures, testées) ---------- */

function cents(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
}

export function summarizeRoles(
  groups: Array<{ roleId: string; status: UserStatus; _count: { _all: number }; _max: { lastLoginAt: Date | null } }>,
  roles: Array<{ id: string; systemRole: SystemRole }>
): CompanyRoleSummary[] {
  const roleOf = new Map(roles.map((role) => [role.id, role.systemRole]));
  const byRole = new Map<SystemRole, { total: number; seated: number; last: Date | null }>();
  for (const group of groups) {
    const role = roleOf.get(group.roleId);
    if (!role) continue;
    const entry = byRole.get(role) ?? { total: 0, seated: 0, last: null };
    const count = Math.max(0, group._count._all);
    entry.total += count;
    if (SEATED_STATUSES.includes(group.status)) entry.seated += count;
    const last = group._max.lastLoginAt;
    if (last && (!entry.last || last > entry.last)) entry.last = last;
    byRole.set(role, entry);
  }
  return COMPANY_ROLE_ORDER.flatMap((role) => {
    const entry = byRole.get(role);
    return entry && entry.total > 0
      ? [{ role, total: entry.total, seated: entry.seated, lastLoginAt: entry.last?.toISOString() ?? null }]
      : [];
  });
}

export function summarizeDeliveries(groups: Array<{ status: string; _count: { _all: number } }>, delivered: number) {
  const summary = { created: 0, inProgress: 0, done: 0, failed: 0, cancelled: 0, delivered: Math.max(0, delivered) };
  for (const group of groups) {
    const count = Math.max(0, group._count._all);
    summary.created += count;
    if (IN_PROGRESS_ORDER.has(group.status)) summary.inProgress += count;
    else if (DONE_ORDER.has(group.status)) summary.done += count;
    else if (group.status === "FAILED") summary.failed += count;
    else if (group.status === "CANCELLED") summary.cancelled += count;
  }
  return summary;
}

export function summarizeInvoices(groups: Array<{ status: InvoiceStatus; _count: { _all: number }; _sum: { totalCents: number | null } }>) {
  const summary = { count: 0, paidCents: 0, pendingCents: 0, overdueCents: 0 };
  for (const group of groups) {
    if (!BILLED_INVOICE_STATUSES.includes(group.status)) continue;
    summary.count += Math.max(0, group._count._all);
    const amount = cents(group._sum.totalCents);
    if (group.status === "PAID") summary.paidCents += amount;
    if (group.status === "PENDING") summary.pendingCents += amount;
    if (group.status === "OVERDUE") summary.overdueCents += amount;
  }
  return summary;
}

/* ---------- Lecture ---------- */

/** Lecture d'un bloc : en cas d'échec, `null` (« Indisponible »), sans faire tomber la fiche entière. */
async function block<T>(read: () => Promise<T>): Promise<T | null> {
  try {
    return await read();
  } catch {
    return null;
  }
}

export async function readCompanyActivity(
  companyId: string,
  db: CompanyFileDatabase = prisma as unknown as CompanyFileDatabase,
  now = new Date()
): Promise<CompanyActivity> {
  const month = parisMonthBounds(now);
  const inMonth = { gte: month.startsAt, lt: month.endsAt };
  const seriesStart = parisDayStart(shiftDayKey(parisDayKey(now), -(ADMIN_HOME_DAYS - 1)));

  const [users, deliveries, series, invoices, support] = await Promise.all([
    block(async () => {
      const [groups, roles, team] = await Promise.all([
        db.user.groupBy({
          by: ["roleId", "status"],
          where: { companyId },
          _count: { _all: true },
          _max: { lastLoginAt: true },
        }),
        db.role.findMany({ where: { users: { some: { companyId } } }, select: { id: true, systemRole: true } }),
        db.user.findMany({
          where: { companyId, role: { systemRole: { not: "MERCHANT" } } },
          orderBy: [{ lastLoginAt: { sort: "desc", nulls: "last" } }, { id: "asc" }],
          take: COMPANY_TEAM_LIMIT + 1,
          select: { id: true, firstName: true, lastName: true, status: true, lastLoginAt: true, role: { select: { systemRole: true } } },
        }),
      ]);
      return {
        byRole: summarizeRoles(groups, roles),
        team: team.slice(0, COMPANY_TEAM_LIMIT).map((user) => ({
          id: user.id,
          name: `${user.firstName} ${user.lastName}`.trim(),
          role: user.role.systemRole,
          status: user.status,
          lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
        })),
        teamTruncated: team.length > COMPANY_TEAM_LIMIT,
      };
    }),
    block(async () => {
      const [groups, delivered] = await Promise.all([
        db.order.groupBy({ by: ["status"], where: { companyId, createdAt: inMonth }, _count: { _all: true } }),
        db.order.count({ where: { companyId, status: DELIVERED_STATUS, deliveredAt: inMonth } }),
      ]);
      return summarizeDeliveries(groups, delivered);
    }),
    block(async () => {
      const [orders, delivered] = await Promise.all([
        db.order.findMany({ where: { companyId, createdAt: { gte: seriesStart } }, select: { createdAt: true } }),
        db.order.findMany({
          where: { companyId, status: DELIVERED_STATUS, deliveredAt: { gte: seriesStart } },
          select: { createdAt: true, deliveredAt: true },
        }),
      ]);
      return buildDailySeries(
        orders.map((order) => order.createdAt),
        delivered.flatMap((row) => (row.deliveredAt ? [row.deliveredAt] : [])),
        now
      );
    }),
    block(async () =>
      summarizeInvoices(
        await db.invoice.groupBy({
          by: ["status"],
          where: { companyId, issuedAt: inMonth, status: { in: BILLED_INVOICE_STATUSES } },
          _count: { _all: true },
          _sum: { totalCents: true },
        })
      )
    ),
    block(async () => {
      const where = { companyId, status: { in: [...OPEN_TICKET_STATUSES] } };
      const [open, latest] = await Promise.all([
        db.supportTicket.count({ where }),
        db.supportTicket.findMany({
          where,
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: COMPANY_TICKETS_LIMIT,
          select: { id: true, subject: true, status: true, priority: true, createdAt: true },
        }),
      ]);
      return {
        open,
        latest: latest.map((ticket) => ({ ...ticket, createdAt: ticket.createdAt.toISOString() })),
      };
    }),
  ]);

  return {
    generatedAt: now.toISOString(),
    month: { startsAt: month.startsAt.toISOString(), endsAt: month.endsAt.toISOString() },
    users,
    deliveries,
    series,
    invoices,
    support,
  };
}

export type CompanyFileDependencies = {
  db?: CompanyFileDatabase;
  readDetail?: (id: string, now: Date) => Promise<PlatformCompanyDetail | null>;
  now?: Date;
};

/** Fiche complète : `null` si l'entreprise n'existe pas (aucune lecture d'activité dans ce cas). */
export async function getPlatformCompanyFile(
  id: string,
  deps: CompanyFileDependencies = {}
): Promise<PlatformCompanyFile | null> {
  const now = deps.now ?? new Date();
  const readDetail = deps.readDetail ?? ((companyId: string) => getPlatformCompany(companyId));
  const detail = await readDetail(id, now);
  if (!detail) return null;
  const activity = await readCompanyActivity(id, deps.db, now);
  return { ...detail, activity };
}
