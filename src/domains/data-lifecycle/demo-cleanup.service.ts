import { Prisma } from "@prisma/client";
import { prisma } from "@/services/prisma/client";
import { createAdminClient } from "@/services/supabase/admin";
import { demoPersonaSeedUsers } from "@/domains/demo/demo-users.service";
import { demoFixtureAuthId } from "@/lib/demo/constants";
import { DEMO_CLEANUP_GRACE_MS, demoSessionExpiry } from "@/lib/demo/retention";

export const DEMO_CLEANUP_AUTHORIZATION = "expired-demo-sessions-v1";
export const DEMO_LOGOUT_CLEANUP_AUTHORIZATION = "current-demo-session-logout-v1";
type Result = { status: "eligible" | "deleted" | "missing" | "blocked"; reason?: string };
class CleanupBlocked extends Error {}
function block(reason: string): never { throw new CleanupBlocked(reason); }

/** Read-only Storage probe: any object/folder (including orphan uploads) blocks deletion. */
export async function assertDemoStorageEmpty(companyId: string): Promise<void> {
  if (!/^[A-Za-z0-9_-]+$/.test(companyId)) block("INVALID_ID");
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      (async () => {
        const storage = createAdminClient().storage;
        const bucket = await storage.getBucket("delivery-pods");
        if (bucket.error || !bucket.data || bucket.data.public) block("STORAGE_UNAVAILABLE");
        const objects = await storage.from("delivery-pods").list(companyId, { limit: 1 });
        if (objects.error || !objects.data) block("STORAGE_UNAVAILABLE");
        if (objects.data.length !== 0) block("STORAGE_OBJECTS_PRESENT");
      })(),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new CleanupBlocked("STORAGE_TIMEOUT")), 10_000); }),
    ]);
  } finally { clearTimeout(timer); }
}

type DemoPodFolder = {
  list(path: string, options: { limit: number; offset: number; sortBy: { column: string; order: string } }): Promise<{
    data: { id: string | null; name: string }[] | null;
    error: unknown;
  }>;
  remove(paths: string[]): Promise<{ error: unknown }>;
};

const DEMO_PURGE_PAGE_SIZE = 100;
const DEMO_PURGE_TIMEOUT_MS = 20_000;

/**
 * Vide le dossier de preuves d'un espace du stock de démonstration. Réservé au recyclage,
 * qui a déjà vérifié le marqueur de l'entreprise. Un sous-dossier (id nul) n'est pas une
 * preuve de démo : il reste en place et le contrôle suivant met l'espace en quarantaine.
 */
export async function purgeDemoPoolStorage(
  companyId: string,
  folder: DemoPodFolder = createAdminClient().storage.from("delivery-pods")
): Promise<{ removed: number }> {
  if (!/^[A-Za-z0-9_-]+$/.test(companyId)) throw new Error("INVALID_ID");
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      (async () => {
        const paths: string[] = [];
        for (let offset = 0; ; offset += DEMO_PURGE_PAGE_SIZE) {
          const { data, error } = await folder.list(companyId, {
            limit: DEMO_PURGE_PAGE_SIZE,
            offset,
            sortBy: { column: "name", order: "asc" },
          });
          if (error || !data) throw new Error("STORAGE_UNAVAILABLE");
          paths.push(...data.filter((row) => row.id !== null).map((row) => `${companyId}/${row.name}`));
          if (data.length < DEMO_PURGE_PAGE_SIZE) break;
        }
        for (let start = 0; start < paths.length; start += DEMO_PURGE_PAGE_SIZE) {
          const { error } = await folder.remove(paths.slice(start, start + DEMO_PURGE_PAGE_SIZE));
          if (error) throw new Error("STORAGE_UNAVAILABLE");
        }
        return { removed: paths.length };
      })(),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("STORAGE_TIMEOUT")), DEMO_PURGE_TIMEOUT_MS); }),
    ]);
  } finally { clearTimeout(timer); }
}

export type DemoStorageInspection =
  | "empty"
  | "objectsPresent"
  | "unavailable"
  | "timeout"
  | "invalidId";

/** Read-only result for inventory tools; never returns object names or company ids. */
export async function inspectDemoStorage(companyId: string): Promise<DemoStorageInspection> {
  try {
    await assertDemoStorageEmpty(companyId);
    return "empty";
  } catch (error) {
    if (!(error instanceof Error)) throw error;
    const known: Record<string, DemoStorageInspection> = {
      STORAGE_OBJECTS_PRESENT: "objectsPresent",
      STORAGE_UNAVAILABLE: "unavailable",
      STORAGE_TIMEOUT: "timeout",
      INVALID_ID: "invalidId",
    };
    const result = known[error.message];
    if (!result) throw error;
    return result;
  }
}

/** Every relationship crossing the tenant boundary must fail closed before cascades. */
export async function hasCrossTenantDemoReference(
  tx: Prisma.TransactionClient,
  companyId: string,
  userIds: string[]
): Promise<boolean> {
  const own = { companyId };
  const foreign = { companyId: { not: companyId } };
  const foreignUser = { OR: [{ companyId: null }, foreign] };
  const counts = await Promise.all([
    tx.order.count({ where: { OR: [
      { ...own, customer: { is: foreignUser } }, { ...foreign, customerId: { in: userIds } },
      { ...own, recurringOrder: { is: foreign } }, { ...foreign, recurringOrder: { is: own } },
    ] } }),
    tx.delivery.count({ where: { OR: [
      { ...own, order: foreign }, { ...foreign, order: own },
      { ...own, customer: { is: foreignUser } }, { ...foreign, customerId: { in: userIds } },
      { ...own, driver: { is: foreignUser } }, { ...foreign, driverId: { in: userIds } },
    ] } }),
    tx.invoice.count({ where: { OR: [
      { ...own, order: { is: foreign } }, { ...foreign, order: { is: own } },
      { ...own, customer: { is: foreignUser } }, { ...foreign, customerId: { in: userIds } },
    ] } }),
    tx.recurringOrder.count({ where: { OR: [
      { ...own, customer: foreignUser }, { ...foreign, customerId: { in: userIds } },
    ] } }),
    tx.supportTicket.count({ where: { OR: [
      { ...own, customer: foreignUser }, { ...foreign, customerId: { in: userIds } },
      { ...own, relatedOrder: { is: foreign } }, { ...foreign, relatedOrder: { is: own } },
      { ...own, relatedDelivery: { is: foreign } }, { ...foreign, relatedDelivery: { is: own } },
    ] } }),
    tx.orderMessage.count({ where: { OR: [
      { order: own, author: foreignUser }, { order: foreign, authorId: { in: userIds } },
    ] } }),
    tx.orderThreadRead.count({ where: { OR: [
      { order: own, user: foreignUser }, { order: foreign, userId: { in: userIds } },
    ] } }),
    tx.clientNotification.count({ where: { OR: [
      { user: own, orderMessage: { is: { order: foreign } } },
      { user: foreignUser, orderMessage: { is: { order: own } } },
    ] } }),
    tx.orderItem.count({ where: { OR: [
      { order: own, orderStop: { is: { order: foreign } } },
      { order: foreign, orderStop: { is: { order: own } } },
    ] } }),
    tx.supportTicketMessage.count({ where: { OR: [
      { ticket: own, authorId: { notIn: userIds } },
      { ticket: foreign, authorId: { in: userIds } },
    ] } }),
  ]);
  return counts.some((count) => count !== 0);
}

/**
 * First conservative cleanup stage: managed expired demo sessions WITHOUT external assets.
 * No Auth/Storage delete call exists here. Legacy sessions and ambiguous graphs stay intact.
 * Caller is a trusted operator script, never a public company-delete endpoint.
 */
async function cleanupManagedDemoSession(companyId: string, options: {
  apply?: boolean;
  authorization?: string;
  now?: Date;
  assertStorageEmpty?: (companyId: string) => Promise<void>;
}, mode: "expired" | "logout"): Promise<Result> {
  const expectedAuthorization = mode === "expired"
    ? DEMO_CLEANUP_AUTHORIZATION
    : DEMO_LOGOUT_CLEANUP_AUTHORIZATION;
  if (options.apply && options.authorization !== expectedAuthorization) return { status: "blocked", reason: "EXPLICIT_ACTIVATION_REQUIRED" };
  const now = options.now ?? new Date();
  if (!Number.isFinite(now.getTime())) return { status: "blocked", reason: "INVALID_TIME" };
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await prisma.$transaction(async (tx): Promise<Result> => {
        const company = await tx.company.findUnique({ where: { id: companyId } });
        if (!company) return { status: "missing" };
        const expiry = demoSessionExpiry(company);
        if (!expiry) block("UNMANAGED_OR_NON_DEMO");
        if (mode === "expired") {
          if (expiry.getTime() > now.getTime()) block("ACTIVE_SESSION");
          if (expiry.getTime() + DEMO_CLEANUP_GRACE_MS > now.getTime()) block("IN_FLIGHT_GRACE");
        }
        if (company.status !== "ACTIVE") block("UNEXPECTED_STATUS");
        if (company.logoUrl) block("EXTERNAL_ASSET_REFERENCE");

        // Serialize concurrent cleanup workers and conflict with company/settings updates.
        // The lock and all subsequent mutations roll back together on ANY guard/failure.
        if (options.apply) {
          const locked = await tx.company.updateMany({
            where: { id: companyId, updatedAt: company.updatedAt, isDemo: true, slug: company.slug },
            data: { updatedAt: now },
          });
          if (locked.count !== 1) block("CONCURRENT_CHANGE");
        }
        const users = await tx.user.findMany({ where: { companyId }, include: { role: true } });
        const seeds = demoPersonaSeedUsers(companyId);
        // Missing/extra users are ambiguous too: this stage only owns the exact synthetic roster.
        if (users.length !== seeds.length || !seeds.every((seed) => {
          const authId = seed.authId ?? demoFixtureAuthId("admin", companyId);
          const [local, domain] = seed.email.toLowerCase().split("@");
          return users.some((user) => user.authId === authId && user.email === `${local}+session-${companyId}@${domain}` && user.role.slug === seed.roleSlug && !user.avatarUrl);
        })) block("NON_SYNTHETIC_OR_CHANGED_ROSTER");

        const [photos, pdfs, runningJobs] = await Promise.all([
          tx.delivery.count({ where: { companyId, OR: [{ podPhotoPath: { not: null } }, { podSignaturePath: { not: null } }] } }),
          tx.invoice.count({ where: { companyId, pdfUrl: { not: null } } }),
          tx.operationJob.count({ where: { companyId, status: { in: ["PENDING", "PROCESSING"] } } }),
        ]);
        if (photos || pdfs) block("EXTERNAL_ASSET_REFERENCE");
        if (runningJobs) block("UNFINISHED_JOBS");
        if (await hasCrossTenantDemoReference(tx, companyId, users.map((user) => user.id))) {
          block("CROSS_TENANT_REFERENCE");
        }
        await (options.assertStorageEmpty ?? assertDemoStorageEmpty)(companyId);
        if (!options.apply) return { status: "eligible" };

        await tx.operationJob.deleteMany({ where: { companyId } });
        await tx.supportTicket.deleteMany({ where: { companyId } });
        await tx.invoice.deleteMany({ where: { companyId } });
        await tx.order.deleteMany({ where: { companyId } });
        await tx.recurringOrder.deleteMany({ where: { companyId } });
        await tx.user.deleteMany({ where: { companyId } });
        await tx.company.delete({ where: { id: companyId } });
        return { status: "deleted" };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 10_000, timeout: 60_000 });
    } catch (error) {
      if (error instanceof CleanupBlocked) return { status: "blocked", reason: error.message };
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034" && attempt < 2) continue;
      throw error;
    }
  }
  throw new Error("DEMO_CLEANUP_RETRY_EXHAUSTED");
}

export async function cleanupExpiredDemoSession(companyId: string, options: {
  apply?: boolean;
  authorization?: string;
  now?: Date;
  assertStorageEmpty?: (companyId: string) => Promise<void>;
} = {}): Promise<Result> {
  return cleanupManagedDemoSession(companyId, options, "expired");
}

/**
 * Supprime uniquement la session de démonstration active du navigateur qui se
 * déconnecte. La route appelante doit d'abord vérifier le compte démo commun et
 * résoudre l'entreprise depuis son cookie HTTP-only.
 */
export async function cleanupDemoSessionOnLogout(companyId: string, options: {
  authorization?: string;
  now?: Date;
  assertStorageEmpty?: (companyId: string) => Promise<void>;
} = {}): Promise<Result> {
  return cleanupManagedDemoSession(companyId, {
    ...options,
    apply: true,
  }, "logout");
}
