import { prisma } from "@/services/prisma/client";
import { WAITLIST_MESSAGE } from "@/domains/growth/contact.service";
import {
  deriveIncidentState,
  platformIncidentActionSelect,
  platformIncidentSelect,
  platformIncidentWhere,
} from "@/domains/admin/incidents.service";
import { getSaasHealthIndicators } from "@/domains/admin/saas-health.service";
import { readPlatformServiceHealth, type PlatformServiceHealth } from "@/domains/admin/service-health.service";
import { alertActionKey } from "@/domains/operational-alerts/operational-alerts.policy";
import { fromParisDateTimeInput, toParisDateTimeInput } from "@/lib/format/paris-datetime-input";

/**
 * ADMIN-ESPACE, lot 1 : accueil du super-administrateur.
 * Une seule lecture pour « À traiter », les chiffres clés, la courbe 30 jours et le voyant de santé.
 * Les entreprises de démonstration (`isDemo`) sont exclues des chiffres clés et de la courbe.
 */

export const ADMIN_HOME_DAYS = 30;
const WAITLIST_RECENT_DAYS = 7;
const NEW_COMPANIES_DAYS = 30;
const PARAMS = ["view", "contactSince"] as const;
/** Livraison terminée avec succès : même règle que le tableau de bord entreprise. */
const DELIVERED_STATUS = "DELIVERED";
const OPEN_TICKET_STATUSES = ["OPEN", "IN_PROGRESS"] as const;

export type AdminHomeView = "full" | "badges";

export type AdminHomeParams = {
  view: AdminHomeView;
  /** Dernière visite de la page Messages Contact (navigateur) ; absente = jamais visitée. */
  contactSince: Date | null;
};

export type AdminHomeTodo = {
  /** Messages Contact (hors liste d'attente) arrivés depuis `contactSince`. */
  contactNew: number;
  /** Inscriptions à la liste d'attente arrivées depuis `contactSince`. */
  waitlistNew: number;
  /** Incidents à l'état « Ouvert », comme sur la page Incidents. */
  openIncidents: number;
  /** Tickets support ouverts ou en cours. */
  openSupportTickets: number;
  contactSince: string | null;
};

export type AdminHomeComparison = { current: number; previous: number | null };

export type AdminHomeDay = { day: string; orders: number; delivered: number };

export type AdminHomeHealthLevel = "green" | "orange" | "red";

export type AdminHomeHealth = {
  level: AdminHomeHealthLevel;
  sentence: string;
  checkedAt: string | null;
};

export type AdminHomeKpis = {
  activeCompanies: { current: number; newLast30Days: number };
  deliveredToday: AdminHomeComparison;
  waitlist: { total: number; last7Days: number };
  /** Abonnements encaissés HT du mois (centimes), mois civil UTC comme la santé SaaS. */
  subscriptionRevenue: { currentCents: number; previousCents: number | null; monthStartsAt: string } | null;
};

export type AdminHome = {
  generatedAt: string;
  todo: AdminHomeTodo;
  kpis: AdminHomeKpis;
  series: AdminHomeDay[];
  health: AdminHomeHealth;
};

export type AdminHomeBadges = { generatedAt: string; todo: AdminHomeTodo };

export function parseAdminHomeParams(
  search: URLSearchParams
): { query: AdminHomeParams } | { error: string } {
  for (const key of search.keys()) {
    if (!PARAMS.includes(key as (typeof PARAMS)[number])) return { error: "Paramètre inconnu" };
  }
  const viewRaw = search.get("view") ?? "full";
  if (viewRaw !== "full" && viewRaw !== "badges") return { error: "Vue invalide" };
  const sinceRaw = search.get("contactSince");
  let contactSince: Date | null = null;
  if (sinceRaw !== null && sinceRaw !== "") {
    if (sinceRaw.length > 40) return { error: "Date invalide" };
    const parsed = new Date(sinceRaw);
    if (Number.isNaN(parsed.getTime())) return { error: "Date invalide" };
    contactSince = parsed;
  }
  return { query: { view: viewRaw, contactSince } };
}

/* ---------- Jours à l'heure de Paris ---------- */

/** « 2026-11-05 » : jour civil à Paris de l'instant donné. */
export function parisDayKey(at: Date): string {
  return toParisDateTimeInput(at).slice(0, 10);
}

/** Minuit à Paris du jour donné, en instant UTC. */
export function parisDayStart(day: string): Date {
  const iso = fromParisDateTimeInput(`${day}T00:00`);
  if (!iso) throw new Error("ADMIN_HOME_DAY_INVALID");
  return new Date(iso);
}

/** Jour civil décalé de `days` jours (calendrier, indépendant du changement d'heure). */
export function shiftDayKey(day: string, days: number): string {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** 30 jours glissants, aujourd'hui compris, du plus ancien au plus récent ; jours vides à zéro. */
export function buildDailySeries(
  orderCreatedAt: Date[],
  deliveredAt: Date[],
  now: Date,
  days: number = ADMIN_HOME_DAYS
): AdminHomeDay[] {
  const today = parisDayKey(now);
  const series = Array.from({ length: days }, (_, index) => ({
    day: shiftDayKey(today, index - (days - 1)),
    orders: 0,
    delivered: 0,
  }));
  const byDay = new Map(series.map((entry) => [entry.day, entry]));
  for (const at of orderCreatedAt) {
    const entry = byDay.get(parisDayKey(at));
    if (entry) entry.orders += 1;
  }
  for (const at of deliveredAt) {
    const entry = byDay.get(parisDayKey(at));
    if (entry) entry.delivered += 1;
  }
  return series;
}

/** Fenêtres « aujourd'hui jusqu'à maintenant » et « même jour la semaine dernière, à la même heure ». */
export function sameDayLastWeekWindows(now: Date) {
  const today = parisDayKey(now);
  const todayStart = parisDayStart(today);
  const lastWeekStart = parisDayStart(shiftDayKey(today, -7));
  const elapsed = now.getTime() - todayStart.getTime();
  return {
    today: { gte: todayStart, lt: now },
    lastWeek: { gte: lastWeekStart, lt: new Date(lastWeekStart.getTime() + elapsed) },
  };
}

/** Mois UTC précédent : un instant au milieu du mois, pour `getSaasHealthIndicators`. */
export function previousUtcMonthAnchor(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 15, 12));
}

/* ---------- À traiter ---------- */

type RawIncident = {
  id: string;
  order: { status: string; deliveries: Array<{ status: string; completedAt: Date | null }> };
};

/** Nombre d'incidents à l'état « Ouvert » (ni pris en compte, ni résolu, ni commande close). */
export function countOpenIncidents(incidents: RawIncident[], actionKeys: ReadonlySet<string>): number {
  return incidents.filter((incident) => deriveIncidentState(incident.id, incident.order, actionKeys) === "OPEN").length;
}

/* ---------- Voyant de santé ---------- */

const CHECK_NAMES = { database: "base de données", storage: "stockage des preuves" } as const;

function plural(count: number, singular: string, pluralForm: string) {
  return `${count} ${count > 1 ? pluralForm : singular}`;
}

export function buildHealthSignal(health: PlatformServiceHealth | null): AdminHomeHealth {
  if (!health) {
    return {
      level: "red",
      sentence: "État des services illisible : ouvrez Exploitation pour vérifier.",
      checkedAt: null,
    };
  }
  const down: string[] = [];
  const slow: string[] = [];
  for (const key of ["database", "storage"] as const) {
    if (health[key].status === "down") down.push(CHECK_NAMES[key]);
    else if (health[key].status === "degraded") slow.push(CHECK_NAMES[key]);
  }
  if (health.queue.status === "down") down.push("file des tâches de fond");
  const jobs: string[] = [];
  if (health.queue.failed) jobs.push(plural(health.queue.failed, "tâche de fond en échec", "tâches de fond en échec"));
  if (health.queue.stale) jobs.push(plural(health.queue.stale, "tâche de fond bloquée", "tâches de fond bloquées"));

  if (health.status === "down" || down.length > 0) {
    const what = down.length > 0 ? down.join(", ") : "un service";
    return { level: "red", sentence: `Panne : ${what} ne répond pas.`, checkedAt: health.checkedAt };
  }
  if (health.status === "degraded" || slow.length > 0 || jobs.length > 0) {
    const parts = [...jobs, ...slow.map((name) => `${name} ralenti`)];
    return {
      level: "orange",
      sentence: `À surveiller : ${parts.length > 0 ? parts.join(", ") : "un service répond mal"}.`,
      checkedAt: health.checkedAt,
    };
  }
  return {
    level: "green",
    sentence: "Tout fonctionne : base de données, stockage et tâches de fond répondent.",
    checkedAt: health.checkedAt,
  };
}

/* ---------- Lecture ---------- */

type CountArgs = { where: Record<string, unknown> };
type FindArgs = Record<string, unknown>;

export type AdminHomeDatabase = {
  contactMessage: { count: (args: CountArgs) => Promise<number> };
  supportTicket: { count: (args: CountArgs) => Promise<number> };
  orderMessage: { findMany: (args: FindArgs) => Promise<unknown[]> };
  company: { count: (args: CountArgs) => Promise<number> };
  order: { findMany: (args: FindArgs) => Promise<Array<{ createdAt: Date }>> };
  delivery: {
    count: (args: CountArgs) => Promise<number>;
    findMany: (args: FindArgs) => Promise<Array<{ completedAt: Date | null }>>;
  };
};

export type AdminHomeDependencies = {
  db?: AdminHomeDatabase;
  readServiceHealth?: () => Promise<PlatformServiceHealth>;
  readSubscriptionRevenueCents?: (at: Date) => Promise<number>;
  now?: Date;
};

async function defaultSubscriptionRevenueCents(at: Date) {
  return (await getSaasHealthIndicators(at)).revenue.subscriptionPaidHtCents;
}

/** Messages Contact et liste d'attente partagent la table ; la liste d'attente porte un message fixe. */
export function contactWhere(kind: "contact" | "waitlist", since: Date | null) {
  return {
    ...(kind === "waitlist" ? { message: WAITLIST_MESSAGE } : { NOT: { message: WAITLIST_MESSAGE } }),
    ...(since ? { createdAt: { gt: since } } : {}),
  };
}

const NOT_DEMO = { isDemo: false };

export async function readAdminHomeTodo(
  params: Pick<AdminHomeParams, "contactSince">,
  db: AdminHomeDatabase = prisma as unknown as AdminHomeDatabase
): Promise<AdminHomeTodo> {
  const incidentWhere = platformIncidentWhere({ page: 1, pageSize: 25 });
  const [contactNew, waitlistNew, openSupportTickets, incidents] = await Promise.all([
    db.contactMessage.count({ where: contactWhere("contact", params.contactSince) }),
    db.contactMessage.count({ where: contactWhere("waitlist", params.contactSince) }),
    db.supportTicket.count({ where: { status: { in: [...OPEN_TICKET_STATUSES] } } }),
    db.orderMessage.findMany({
      where: incidentWhere,
      select: { id: true, order: platformIncidentSelect().order },
    }) as Promise<RawIncident[]>,
  ]);
  const keys = incidents.flatMap((incident) => [
    alertActionKey(`incident:${incident.id}`, "resolve"),
    alertActionKey(`incident:${incident.id}`, "ack"),
  ]);
  const actions = keys.length === 0
    ? []
    : ((await db.orderMessage.findMany({
        where: { requestKey: { in: keys } },
        select: platformIncidentActionSelect(),
      })) as Array<{ requestKey: string }>);
  return {
    contactNew,
    waitlistNew,
    openIncidents: countOpenIncidents(incidents, new Set(actions.map((action) => action.requestKey))),
    openSupportTickets,
    contactSince: params.contactSince ? params.contactSince.toISOString() : null,
  };
}

export async function getAdminHomeBadges(
  params: Pick<AdminHomeParams, "contactSince">,
  deps: AdminHomeDependencies = {}
): Promise<AdminHomeBadges> {
  const now = deps.now ?? new Date();
  return { generatedAt: now.toISOString(), todo: await readAdminHomeTodo(params, deps.db) };
}

export async function getAdminHome(
  params: AdminHomeParams,
  deps: AdminHomeDependencies = {}
): Promise<AdminHome | AdminHomeBadges> {
  if (params.view === "badges") return getAdminHomeBadges(params, deps);

  const db = deps.db ?? (prisma as unknown as AdminHomeDatabase);
  const now = deps.now ?? new Date();
  const readHealth = deps.readServiceHealth ?? (() => readPlatformServiceHealth());
  const readRevenue = deps.readSubscriptionRevenueCents ?? defaultSubscriptionRevenueCents;

  const today = parisDayKey(now);
  const seriesStart = parisDayStart(shiftDayKey(today, -(ADMIN_HOME_DAYS - 1)));
  const windows = sameDayLastWeekWindows(now);
  const waitlistSince = new Date(now.getTime() - WAITLIST_RECENT_DAYS * 86_400_000);
  const companiesSince = new Date(now.getTime() - NEW_COMPANIES_DAYS * 86_400_000);
  const deliveredWhere = (range: { gte: Date; lt: Date }) => ({
    status: DELIVERED_STATUS,
    completedAt: range,
    company: NOT_DEMO,
  });

  const [
    todo,
    activeCompanies,
    newCompanies,
    deliveredToday,
    deliveredLastWeek,
    waitlistTotal,
    waitlistRecent,
    orders,
    delivered,
    health,
    revenueCurrent,
    revenuePrevious,
  ] = await Promise.all([
    readAdminHomeTodo(params, db),
    db.company.count({ where: { status: "ACTIVE", ...NOT_DEMO } }),
    db.company.count({ where: { status: "ACTIVE", ...NOT_DEMO, createdAt: { gte: companiesSince } } }),
    db.delivery.count({ where: deliveredWhere(windows.today) }),
    db.delivery.count({ where: deliveredWhere(windows.lastWeek) }),
    db.contactMessage.count({ where: contactWhere("waitlist", null) }),
    db.contactMessage.count({ where: { message: WAITLIST_MESSAGE, createdAt: { gte: waitlistSince } } }),
    db.order.findMany({
      where: { createdAt: { gte: seriesStart }, company: NOT_DEMO },
      select: { createdAt: true },
    }),
    db.delivery.findMany({
      where: { status: DELIVERED_STATUS, completedAt: { gte: seriesStart }, company: NOT_DEMO },
      select: { completedAt: true },
    }),
    readHealth().catch(() => null),
    readRevenue(now).catch(() => null),
    readRevenue(previousUtcMonthAnchor(now)).catch(() => null),
  ]);

  return {
    generatedAt: now.toISOString(),
    todo,
    kpis: {
      activeCompanies: { current: activeCompanies, newLast30Days: newCompanies },
      deliveredToday: { current: deliveredToday, previous: deliveredLastWeek },
      waitlist: { total: waitlistTotal, last7Days: waitlistRecent },
      subscriptionRevenue: revenueCurrent === null
        ? null
        : {
            currentCents: revenueCurrent,
            previousCents: revenuePrevious,
            monthStartsAt: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString(),
          },
    },
    series: buildDailySeries(
      orders.map((order) => order.createdAt),
      delivered.flatMap((row) => (row.completedAt ? [row.completedAt] : [])),
      now
    ),
    health: buildHealthSignal(health),
  };
}
