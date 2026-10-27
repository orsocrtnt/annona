import { prisma } from "@/services/prisma/client";

const STATUSES = ["PENDING", "PROCESSING", "SUCCEEDED", "FAILED"] as const;
const TYPES = ["AUTO_DISPATCH", "CLIENT_NOTIFICATION"] as const;
const PAGE_SIZES = [25, 50, 100] as const;
const PARAMS = ["q", "status", "type", "page", "pageSize"] as const;
const STALE_AFTER_MS = 10 * 60_000;

type Status = (typeof STATUSES)[number];
type JobType = (typeof TYPES)[number];
type PageSize = (typeof PAGE_SIZES)[number];

export type OperationJobListParams = {
  q?: string;
  status?: Status;
  type?: JobType;
  page: number;
  pageSize: PageSize;
  now?: Date;
};

export type OperationJobRow = {
  id: string;
  company: string | null;
  type: JobType;
  status: Status;
  attempts: number;
  maxAttempts: number;
  nextAttemptAt: string;
  lockedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  stale: boolean;
};

export type OperationJobPage = {
  page: number;
  pageSize: PageSize;
  total: number;
  rows: OperationJobRow[];
};

type RawRow = {
  id: string;
  type: JobType;
  status: Status;
  attempts: number;
  maxAttempts: number;
  nextAttemptAt: Date;
  lockedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  company: { name: string } | null;
};

type JobReader = {
  operationJob: {
    count: (args: { where: Record<string, unknown> }) => Promise<number>;
    findMany: (args: Record<string, unknown>) => Promise<RawRow[]>;
  };
};

function integerParam(value: string) {
  if (!/^[1-9]\d*$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

export function parseOperationJobListParams(
  search: URLSearchParams
): { query: OperationJobListParams } | { error: string } {
  for (const key of search.keys()) {
    if (!PARAMS.includes(key as (typeof PARAMS)[number])) return { error: "Paramètre inconnu" };
  }
  const pageRaw = search.get("page");
  const page = pageRaw === null ? 1 : integerParam(pageRaw);
  if (page === null) return { error: "Page invalide" };
  const sizeRaw = search.get("pageSize");
  const pageSize = sizeRaw === null ? 25 : integerParam(sizeRaw);
  if (pageSize === null || !PAGE_SIZES.includes(pageSize as PageSize)) return { error: "Taille de page invalide" };
  if (!Number.isSafeInteger((page - 1) * pageSize)) return { error: "Page invalide" };

  const statusRaw = search.get("status");
  if (statusRaw !== null && !STATUSES.includes(statusRaw as Status)) return { error: "Statut invalide" };
  const typeRaw = search.get("type");
  if (typeRaw !== null && !TYPES.includes(typeRaw as JobType)) return { error: "Type invalide" };
  const q = search.get("q")?.trim() ?? "";
  if (q.length > 80) return { error: "Recherche trop longue" };

  return {
    query: {
      ...(q ? { q } : {}),
      ...(statusRaw ? { status: statusRaw as Status } : {}),
      ...(typeRaw ? { type: typeRaw as JobType } : {}),
      page,
      pageSize: pageSize as PageSize,
    },
  };
}

export function operationJobWhere(query: OperationJobListParams) {
  return {
    ...(query.status ? { status: query.status } : {}),
    ...(query.type ? { type: query.type } : {}),
    ...(query.q ? { company: { name: { contains: query.q, mode: "insensitive" as const } } } : {}),
  };
}

export function operationJobSelect() {
  return {
    id: true,
    type: true,
    status: true,
    attempts: true,
    maxAttempts: true,
    nextAttemptAt: true,
    lockedAt: true,
    completedAt: true,
    createdAt: true,
    updatedAt: true,
    company: { select: { name: true } },
  };
}

export function toOperationJobRow(row: RawRow, now: Date): OperationJobRow {
  const staleBefore = now.getTime() - STALE_AFTER_MS;
  return {
    id: row.id,
    company: row.company?.name ?? null,
    type: row.type,
    status: row.status,
    attempts: row.attempts,
    maxAttempts: row.maxAttempts,
    nextAttemptAt: row.nextAttemptAt.toISOString(),
    lockedAt: row.lockedAt?.toISOString() ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    stale: row.status === "PROCESSING" && row.lockedAt !== null && row.lockedAt.getTime() <= staleBefore,
  };
}

export async function listOperationJobs(
  query: OperationJobListParams,
  db: JobReader = prisma as unknown as JobReader
): Promise<OperationJobPage> {
  const now = query.now ?? new Date();
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) throw new Error("OPERATION_JOB_DATE_INVALID");
  const where = operationJobWhere(query);
  const [total, rows] = await Promise.all([
    db.operationJob.count({ where }),
    db.operationJob.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      select: operationJobSelect(),
    }),
  ]);
  return { page: query.page, pageSize: query.pageSize, total, rows: rows.map((row) => toOperationJobRow(row, now)) };
}
