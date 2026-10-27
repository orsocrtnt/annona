import { prisma } from "@/services/prisma/client";

const STATUSES = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"] as const;
const PRIORITIES = ["LOW", "NORMAL", "HIGH", "URGENT"] as const;
const PAGE_SIZES = [25, 50, 100] as const;
const PARAMS = ["q", "status", "priority", "page", "pageSize"] as const;

type Status = (typeof STATUSES)[number];
type Priority = (typeof PRIORITIES)[number];
type PageSize = (typeof PAGE_SIZES)[number];

export type SupportTicketListParams = {
  q?: string;
  status?: Status;
  priority?: Priority;
  page: number;
  pageSize: PageSize;
};

export type PlatformSupportTicketRow = {
  id: string;
  company: string;
  status: Status;
  priority: Priority;
  contactType: "ADMIN" | "DRIVER" | null;
  relatedOrderReference: string | null;
  relatedDeliveryReference: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PlatformSupportTicketPage = {
  page: number;
  pageSize: PageSize;
  total: number;
  rows: PlatformSupportTicketRow[];
};

type RawRow = {
  id: string;
  status: Status;
  priority: Priority;
  contactType: "ADMIN" | "DRIVER" | null;
  relatedOrder: { reference: string } | null;
  relatedDelivery: { reference: string } | null;
  createdAt: Date;
  updatedAt: Date;
  company: { name: string };
};

type TicketReader = {
  supportTicket: {
    count: (args: { where: Record<string, unknown> }) => Promise<number>;
    findMany: (args: Record<string, unknown>) => Promise<RawRow[]>;
  };
};

function integerParam(value: string) {
  if (!/^[1-9]\d*$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

export function parseSupportTicketListParams(
  search: URLSearchParams
): { query: SupportTicketListParams } | { error: string } {
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

  const statusRaw = search.get("status");
  if (statusRaw !== null && !STATUSES.includes(statusRaw as Status)) return { error: "Statut invalide" };

  const priorityRaw = search.get("priority");
  if (priorityRaw !== null && !PRIORITIES.includes(priorityRaw as Priority)) {
    return { error: "Priorité invalide" };
  }

  const q = search.get("q")?.trim() ?? "";
  if (q.length > 80) return { error: "Recherche trop longue" };

  return {
    query: {
      ...(q ? { q } : {}),
      ...(statusRaw ? { status: statusRaw as Status } : {}),
      ...(priorityRaw ? { priority: priorityRaw as Priority } : {}),
      page,
      pageSize: pageSize as PageSize,
    },
  };
}

export function platformSupportTicketWhere(query: SupportTicketListParams) {
  return {
    ...(query.status ? { status: query.status } : {}),
    ...(query.priority ? { priority: query.priority } : {}),
    ...(query.q ? { company: { name: { contains: query.q, mode: "insensitive" as const } } } : {}),
  };
}

export function platformSupportTicketSelect() {
  return {
    id: true,
    status: true,
    priority: true,
    contactType: true,
    createdAt: true,
    updatedAt: true,
    company: { select: { name: true } },
    relatedOrder: { select: { reference: true } },
    relatedDelivery: { select: { reference: true } },
  };
}

export function toPlatformSupportTicketRow(row: RawRow): PlatformSupportTicketRow {
  return {
    id: row.id,
    company: row.company.name,
    status: row.status,
    priority: row.priority,
    contactType: row.contactType,
    relatedOrderReference: row.relatedOrder?.reference ?? null,
    relatedDeliveryReference: row.relatedDelivery?.reference ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listPlatformSupportTickets(
  query: SupportTicketListParams,
  db: TicketReader = prisma as unknown as TicketReader
): Promise<PlatformSupportTicketPage> {
  const where = platformSupportTicketWhere(query);
  const [total, rows] = await Promise.all([
    db.supportTicket.count({ where }),
    db.supportTicket.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      select: platformSupportTicketSelect(),
    }),
  ]);

  return {
    page: query.page,
    pageSize: query.pageSize,
    total,
    rows: rows.map(toPlatformSupportTicketRow),
  };
}
