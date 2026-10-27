import { prisma } from "@/services/prisma/client";
import {
  alertActionKey,
  isOperationalOrderClosed,
} from "@/domains/operational-alerts/operational-alerts.policy";

const VISIBILITIES = ["INTERNAL", "SHARED"] as const;
const PAGE_SIZES = [25, 50, 100] as const;
const PARAMS = ["q", "visibility", "page", "pageSize"] as const;

type Visibility = (typeof VISIBILITIES)[number];
type PageSize = (typeof PAGE_SIZES)[number];
export type IncidentState = "OPEN" | "ACKNOWLEDGED" | "RESOLVED" | "CLOSED";

export type IncidentListParams = {
  q?: string;
  visibility?: Visibility;
  page: number;
  pageSize: PageSize;
};

export type PlatformIncidentRow = {
  id: string;
  company: string;
  orderReference: string;
  visibility: Visibility;
  state: IncidentState;
  createdAt: string;
};

export type PlatformIncidentPage = {
  page: number;
  pageSize: PageSize;
  total: number;
  rows: PlatformIncidentRow[];
};

type DeliveryState = { completedAt: Date | null; status: string };

type RawIncident = {
  id: string;
  internal: boolean;
  createdAt: Date;
  order: {
    reference: string;
    status: string;
    company: { name: string };
    deliveries: DeliveryState[];
  };
};

type RawAction = { orderId: string; requestKey: string };

type IncidentReader = {
  orderMessage: {
    count: (args: { where: Record<string, unknown> }) => Promise<number>;
    findMany: (args: Record<string, unknown>) => Promise<RawIncident[] | RawAction[]>;
  };
};

function integerParam(value: string) {
  if (!/^[1-9]\d*$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

export function parseIncidentListParams(
  search: URLSearchParams
): { query: IncidentListParams } | { error: string } {
  for (const key of search.keys()) {
    if (!PARAMS.includes(key as (typeof PARAMS)[number])) return { error: "Paramètre inconnu" };
  }

  const pageRaw = search.get("page");
  const page = pageRaw === null ? 1 : integerParam(pageRaw);
  if (page === null) return { error: "Page invalide" };

  const sizeRaw = search.get("pageSize");
  const pageSize = sizeRaw === null ? 25 : integerParam(sizeRaw);
  if (pageSize === null || !PAGE_SIZES.includes(pageSize as PageSize)) {
    return { error: "Taille de page invalide" };
  }

  const skip = (page - 1) * pageSize;
  if (!Number.isSafeInteger(skip)) return { error: "Page invalide" };

  const visibilityRaw = search.get("visibility");
  if (visibilityRaw !== null && !VISIBILITIES.includes(visibilityRaw as Visibility)) {
    return { error: "Visibilité invalide" };
  }

  const q = search.get("q")?.trim() ?? "";
  if (q.length > 80) return { error: "Recherche trop longue" };

  return {
    query: {
      ...(q ? { q } : {}),
      ...(visibilityRaw ? { visibility: visibilityRaw as Visibility } : {}),
      page,
      pageSize: pageSize as PageSize,
    },
  };
}

export function platformIncidentWhere(query: IncidentListParams) {
  return {
    kind: "INCIDENT",
    NOT: { requestKey: { startsWith: "alert1:" } },
    ...(query.visibility ? { internal: query.visibility === "INTERNAL" } : {}),
    ...(query.q
      ? { order: { company: { name: { contains: query.q, mode: "insensitive" as const } } } }
      : {}),
  };
}

export function platformIncidentSelect() {
  return {
    id: true,
    internal: true,
    createdAt: true,
    order: {
      select: {
        reference: true,
        status: true,
        company: { select: { name: true } },
        deliveries: { select: { status: true, completedAt: true } },
      },
    },
  };
}

export function platformIncidentActionSelect() {
  return { orderId: true, requestKey: true };
}

export function deriveIncidentState(
  id: string,
  order: { status: string; deliveries: DeliveryState[] },
  actionKeys: ReadonlySet<string>
): IncidentState {
  if (actionKeys.has(alertActionKey(`incident:${id}`, "resolve"))) return "RESOLVED";
  if (isOperationalOrderClosed(order)) return "CLOSED";
  if (actionKeys.has(alertActionKey(`incident:${id}`, "ack"))) return "ACKNOWLEDGED";
  return "OPEN";
}

export function toPlatformIncidentRow(row: RawIncident, actionKeys: ReadonlySet<string>): PlatformIncidentRow {
  return {
    id: row.id,
    company: row.order.company.name,
    orderReference: row.order.reference,
    visibility: row.internal ? "INTERNAL" : "SHARED",
    state: deriveIncidentState(row.id, row.order, actionKeys),
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listPlatformIncidents(
  query: IncidentListParams,
  db: IncidentReader = prisma as unknown as IncidentReader
): Promise<PlatformIncidentPage> {
  const where = platformIncidentWhere(query);
  const [total, rows] = await Promise.all([
    db.orderMessage.count({ where }),
    db.orderMessage.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      select: platformIncidentSelect(),
    }),
  ]);
  const incidents = rows as RawIncident[];
  const keys = incidents.flatMap((row) => [
    alertActionKey(`incident:${row.id}`, "resolve"),
    alertActionKey(`incident:${row.id}`, "ack"),
  ]);
  const actions = keys.length === 0
    ? []
    : (await db.orderMessage.findMany({
        where: { requestKey: { in: keys } },
        select: platformIncidentActionSelect(),
      })) as RawAction[];
  const present = new Set(actions.map((action) => action.requestKey));

  return {
    page: query.page,
    pageSize: query.pageSize,
    total,
    rows: incidents.map((row) => toPlatformIncidentRow(row, present)),
  };
}
