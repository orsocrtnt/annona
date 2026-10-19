import type { Prisma } from "@prisma/client";
import { prisma } from "@/services/prisma/client";
import { DEMO_SESSION_COMPANY_PREFIX } from "@/lib/demo/constants";
import { DEMO_SESSION_LIFETIME_MS } from "@/lib/demo/retention";
import {
  cleanupExpiredDemoSession,
  DEMO_CLEANUP_AUTHORIZATION,
} from "@/domains/data-lifecycle/demo-cleanup.service";

const DEMO_CLEANUP_BATCH_SIZE = 100;

type CleanupResult = Awaited<ReturnType<typeof cleanupExpiredDemoSession>>;

type BatchDependencies = {
  cleanupSession?: typeof cleanupExpiredDemoSession;
  findCompanies?: (
    args: Prisma.CompanyFindManyArgs
  ) => Promise<Array<{ id: string }>>;
};

export type DemoCleanupBatchResult = {
  dryRun: boolean;
  processed: number;
  counts: Record<string, number>;
  reasons: Record<string, number>;
  remaining: boolean;
  success: boolean;
};

export async function cleanupExpiredDemoSessions(
  options: {
    apply?: boolean;
    authorization?: string;
    now?: Date;
  } = {},
  dependencies: BatchDependencies = {}
): Promise<DemoCleanupBatchResult> {
  const apply = options.apply ?? false;
  if (apply && options.authorization !== DEMO_CLEANUP_AUTHORIZATION) {
    throw new Error("EXPLICIT_ACTIVATION_REQUIRED");
  }
  const now = options.now ?? new Date();
  if (!Number.isFinite(now.getTime())) throw new Error("INVALID_TIME");

  const findCompanies =
    dependencies.findCompanies ??
    ((args: Prisma.CompanyFindManyArgs) => prisma.company.findMany(args));
  const companies = await findCompanies({
    where: {
      isDemo: true,
      slug: { startsWith: DEMO_SESSION_COMPANY_PREFIX },
      createdAt: {
        lte: new Date(now.getTime() - DEMO_SESSION_LIFETIME_MS),
      },
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: DEMO_CLEANUP_BATCH_SIZE + 1,
    select: { id: true },
  });

  const cleanup = dependencies.cleanupSession ?? cleanupExpiredDemoSession;
  const counts: Record<CleanupResult["status"], number> = {
    eligible: 0,
    deleted: 0,
    missing: 0,
    blocked: 0,
  };
  const reasons: Record<string, number> = {};
  for (const company of companies.slice(0, DEMO_CLEANUP_BATCH_SIZE)) {
    const result = await cleanup(company.id, {
      apply,
      authorization: options.authorization,
      now,
    });
    counts[result.status] += 1;
    if (result.reason) {
      reasons[result.reason] = (reasons[result.reason] ?? 0) + 1;
    }
  }

  const remaining = companies.length > DEMO_CLEANUP_BATCH_SIZE;
  return {
    dryRun: !apply,
    processed: Math.min(companies.length, DEMO_CLEANUP_BATCH_SIZE),
    counts,
    reasons,
    remaining,
    success: !remaining && counts.blocked === 0,
  };
}
