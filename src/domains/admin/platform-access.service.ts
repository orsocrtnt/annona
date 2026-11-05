export const PLATFORM_ACCESS_RESOURCES = [
  "OVERVIEW",
  "SAAS_HEALTH",
  "SERVICE_HEALTH",
  "COMPANIES",
  "COMPANY_DETAIL",
  "USERS",
  "SUBSCRIPTIONS",
  "SUPPORT_TICKETS",
  "OPERATION_JOBS",
  "INCIDENTS",
  "ACCESS_EVENTS",
  "CONTACT_MESSAGES",
  "SALES_CODES",
  "SALES_COMMISSIONS",
] as const;

export const PLATFORM_ACCESS_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;

export type PlatformAccessResource = (typeof PLATFORM_ACCESS_RESOURCES)[number];
export type PlatformAccessRole = "SUPER_ADMIN" | "COMPANY_ADMIN" | "MINI_ADMIN" | "DISPATCHER" | "DRIVER" | "CLIENT";
export type PlatformAccessDecision = "ALLOWED" | "DENIED";
/** Seules les routes des codes commerciaux écrivent (SALES-1, décision C10). */
export type PlatformAccessMethod = "GET" | "POST" | "PATCH";

export type PlatformAccessEvent = {
  id: string;
  occurredAt: Date;
  expiresAt: Date;
  actorId: string;
  role: PlatformAccessRole;
  method: PlatformAccessMethod;
  resource: PlatformAccessResource;
  decision: PlatformAccessDecision;
};

export type PlatformAccessRepository = {
  record(entry: PlatformAccessEvent, now: Date): Promise<void>;
  listActive(now: Date): Promise<PlatformAccessEvent[]>;
  listPage(args: {
    now: Date;
    resource?: PlatformAccessResource;
    decision?: PlatformAccessDecision;
    skip: number;
    take: number;
  }): Promise<{ total: number; rows: PlatformAccessEvent[] }>;
};

type AccessWhere = {
  expiresAt: { gt: Date };
  resource?: PlatformAccessResource;
  decision?: PlatformAccessDecision;
};

type PlatformAccessStore = {
  $transaction<T>(run: (tx: PlatformAccessStore) => Promise<T>): Promise<T>;
  platformAccessEvent: {
    deleteMany(args: { where: { expiresAt: { lte: Date } } }): Promise<unknown>;
    create(args: { data: PlatformAccessEvent }): Promise<unknown>;
    findMany(args: { where: { expiresAt: { gt: Date } }; orderBy: { occurredAt: "asc" } }): Promise<PlatformAccessEvent[]>;
    count(args: { where: AccessWhere }): Promise<number>;
    findPage(args: {
      where: AccessWhere;
      orderBy: [{ occurredAt: "desc" }, { id: "desc" }];
      skip: number;
      take: number;
    }): Promise<PlatformAccessEvent[]>;
  };
};

export function platformAccessExpiry(occurredAt: Date) {
  return new Date(occurredAt.getTime() + PLATFORM_ACCESS_RETENTION_MS);
}

export function createPrismaPlatformAccessRepository(client: PlatformAccessStore): PlatformAccessRepository {
  return {
    async record(entry, now) {
      await client.$transaction(async (tx) => {
        await tx.platformAccessEvent.deleteMany({ where: { expiresAt: { lte: now } } });
        await tx.platformAccessEvent.create({ data: entry });
      });
    },
    async listActive(now) {
      const rows = await client.platformAccessEvent.findMany({
        where: { expiresAt: { gt: now } },
        orderBy: { occurredAt: "asc" },
      });
      return rows.filter((row) => row.expiresAt > now);
    },
    async listPage(args) {
      const where: AccessWhere = {
        expiresAt: { gt: args.now },
        ...(args.resource ? { resource: args.resource } : {}),
        ...(args.decision ? { decision: args.decision } : {}),
      };
      return client.$transaction(async (tx) => {
        const total = await tx.platformAccessEvent.count({ where });
        const rows = await tx.platformAccessEvent.findPage({
          where,
          orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
          skip: args.skip,
          take: args.take,
        });
        return { total, rows: rows.filter((row) => row.expiresAt > args.now) };
      });
    },
  };
}

export const JOURNAL_TRANSACTION_MAX_WAIT_MS = 10_000;
export const JOURNAL_TRANSACTION_TIMEOUT_MS = 10_000;

async function defaultRepository(): Promise<PlatformAccessRepository> {
  const { prisma } = await import("@/services/prisma/client");
  const events = prisma.platformAccessEvent as unknown as PlatformAccessStore["platformAccessEvent"] & {
    findMany(args: {
      where: AccessWhere;
      orderBy: [{ occurredAt: "desc" }, { id: "desc" }];
      skip: number;
      take: number;
    }): Promise<PlatformAccessEvent[]>;
  };
  const store: PlatformAccessStore = {
    $transaction: (run) => prisma.$transaction((tx) => run({
      $transaction: async () => { throw new Error("transaction imbriquée"); },
      platformAccessEvent: {
        ...events,
        findPage: (args) => (tx.platformAccessEvent as unknown as typeof events).findMany(args),
        count: (args) => tx.platformAccessEvent.count(args),
        deleteMany: (args) => tx.platformAccessEvent.deleteMany(args),
        create: (args) => tx.platformAccessEvent.create(args),
      },
    }), {
      // ADMIN-ESPACE lot 2 : plusieurs lectures journalisées partent ensemble (liste, entonnoir, pastilles) ;
      // l'attente par défaut de Prisma (2 s) faisait échouer la dernière en 503 derrière PgBouncer.
      maxWait: JOURNAL_TRANSACTION_MAX_WAIT_MS,
      timeout: JOURNAL_TRANSACTION_TIMEOUT_MS,
    }),
    platformAccessEvent: {
      ...events,
      findPage: (args) => events.findMany(args),
    },
  };
  return createPrismaPlatformAccessRepository(store);
}

export async function recordPlatformAccess(
  input: {
    actorId: string;
    role: PlatformAccessRole;
    resource: PlatformAccessResource;
    decision: PlatformAccessDecision;
    method?: PlatformAccessMethod;
  },
  dependencies?: {
    now?: () => Date;
    repository?: PlatformAccessRepository;
    createId?: () => string;
  },
) {
  if (!PLATFORM_ACCESS_RESOURCES.includes(input.resource)) return false;
  const occurredAt = dependencies?.now?.() ?? new Date();
  const entry: PlatformAccessEvent = {
    id: dependencies?.createId?.() ?? crypto.randomUUID(),
    occurredAt,
    expiresAt: platformAccessExpiry(occurredAt),
    actorId: input.actorId,
    role: input.role,
    method: input.method ?? "GET",
    resource: input.resource,
    decision: input.decision,
  };
  try {
    await (dependencies?.repository ?? await defaultRepository()).record(entry, occurredAt);
    return true;
  } catch {
    return false;
  }
}

const PAGE_SIZES = [25, 50, 100] as const;
const LIST_PARAMS = ["resource", "decision", "page", "pageSize"] as const;
const DECISIONS = ["ALLOWED", "DENIED"] as const;

export type PlatformAccessListParams = {
  resource?: PlatformAccessResource;
  decision?: PlatformAccessDecision;
  page: number;
  pageSize: (typeof PAGE_SIZES)[number];
};

export type PlatformAccessListRow = {
  id: string;
  occurredAt: string;
  actorId: string;
  role: PlatformAccessRole;
  resource: PlatformAccessResource;
  decision: PlatformAccessDecision;
};

export type PlatformAccessEventPage = {
  page: number;
  pageSize: number;
  total: number;
  rows: PlatformAccessListRow[];
};

function integerParam(value: string) {
  if (!/^[1-9]\d*$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

export function parsePlatformAccessListParams(search: URLSearchParams): { query: PlatformAccessListParams } | { error: string } {
  for (const key of search.keys()) {
    if (!LIST_PARAMS.includes(key as (typeof LIST_PARAMS)[number])) return { error: "Paramètre inconnu" };
  }
  const pageRaw = search.get("page");
  const page = pageRaw === null ? 1 : integerParam(pageRaw);
  if (page === null) return { error: "Page invalide" };
  const sizeRaw = search.get("pageSize");
  const pageSize = sizeRaw === null ? 25 : integerParam(sizeRaw);
  if (pageSize === null || !PAGE_SIZES.includes(pageSize as (typeof PAGE_SIZES)[number])) return { error: "Taille de page invalide" };
  if (!Number.isSafeInteger((page - 1) * pageSize)) return { error: "Page invalide" };
  const resourceRaw = search.get("resource");
  if (resourceRaw !== null && !PLATFORM_ACCESS_RESOURCES.includes(resourceRaw as PlatformAccessResource)) return { error: "Ressource invalide" };
  const decisionRaw = search.get("decision");
  if (decisionRaw !== null && !DECISIONS.includes(decisionRaw as PlatformAccessDecision)) return { error: "Décision invalide" };
  return {
    query: {
      ...(resourceRaw ? { resource: resourceRaw as PlatformAccessResource } : {}),
      ...(decisionRaw ? { decision: decisionRaw as PlatformAccessDecision } : {}),
      page,
      pageSize: pageSize as (typeof PAGE_SIZES)[number],
    },
  };
}

export async function listPlatformAccessEvents(
  query: PlatformAccessListParams,
  dependencies?: { now?: () => Date; repository?: PlatformAccessRepository },
): Promise<PlatformAccessEventPage> {
  const now = dependencies?.now?.() ?? new Date();
  const repository = dependencies?.repository ?? await defaultRepository();
  const page = await repository.listPage({
    now,
    resource: query.resource,
    decision: query.decision,
    skip: (query.page - 1) * query.pageSize,
    take: query.pageSize,
  });
  return {
    page: query.page,
    pageSize: query.pageSize,
    total: page.total,
    rows: page.rows.filter((row) => row.expiresAt > now).map((row): PlatformAccessListRow => ({
      id: row.id,
      occurredAt: row.occurredAt.toISOString(),
      actorId: row.actorId,
      role: row.role,
      resource: row.resource,
      decision: row.decision,
    })),
  };
}
