import { prisma } from "@/services/prisma/client";
import { formatPersonNameByRole } from "@/lib/format/person-labels";
import type { SystemRole, UserStatus } from "@prisma/client";

const ROLES = ["SUPER_ADMIN", "COMPANY_ADMIN", "MINI_ADMIN", "DISPATCHER", "DRIVER", "CLIENT"] as const;
const STATUSES = ["ACTIVE", "INACTIVE", "SUSPENDED", "PENDING_VERIFICATION"] as const;
const PAGE_SIZES = [25, 50, 100] as const;
const PARAMS = ["q", "role", "status", "page", "pageSize"] as const;

type PageSize = (typeof PAGE_SIZES)[number];

export type PlatformUserListParams = {
  q?: string;
  role?: SystemRole;
  status?: UserStatus;
  page: number;
  pageSize: PageSize;
};

export type PlatformUserRow = {
  id: string;
  name: string;
  role: SystemRole;
  status: UserStatus;
  company: string | null;
  createdAt: string;
};

export type PlatformUserPage = {
  page: number;
  pageSize: PageSize;
  total: number;
  rows: PlatformUserRow[];
};

type RawRow = {
  id: string;
  firstName: string;
  lastName: string;
  status: UserStatus;
  createdAt: Date;
  company: { name: string } | null;
  role: { systemRole: SystemRole };
};

type UserReader = {
  user: {
    count: (args: { where: Record<string, unknown> }) => Promise<number>;
    findMany: (args: Record<string, unknown>) => Promise<RawRow[]>;
  };
};

function integerParam(value: string) {
  if (!/^[1-9]\d*$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

export function parsePlatformUserListParams(
  search: URLSearchParams
): { query: PlatformUserListParams } | { error: string } {
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

  const roleRaw = search.get("role");
  if (roleRaw !== null && !ROLES.includes(roleRaw as (typeof ROLES)[number])) return { error: "Rôle invalide" };

  const statusRaw = search.get("status");
  if (statusRaw !== null && !STATUSES.includes(statusRaw as (typeof STATUSES)[number])) {
    return { error: "Statut invalide" };
  }

  const q = search.get("q")?.trim() ?? "";
  if (q.length > 80) return { error: "Recherche trop longue" };

  return {
    query: {
      ...(q ? { q } : {}),
      ...(roleRaw ? { role: roleRaw as SystemRole } : {}),
      ...(statusRaw ? { status: statusRaw as UserStatus } : {}),
      page,
      pageSize: pageSize as PageSize,
    },
  };
}

export function platformUserWhere(query: PlatformUserListParams) {
  const name = query.q ? { contains: query.q, mode: "insensitive" as const } : null;
  return {
    // Comptes des espaces de démonstration exclus (personas fictifs) ; les comptes sans entreprise restent.
    NOT: { company: { is: { isDemo: true } } },
    ...(query.role ? { role: { systemRole: query.role } } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(name
      ? {
          OR: [
            { firstName: name },
            { lastName: name },
            { company: { name } },
          ],
        }
      : {}),
  };
}

export function platformUserSelect() {
  return {
    id: true,
    firstName: true,
    lastName: true,
    status: true,
    createdAt: true,
    company: { select: { name: true } },
    role: { select: { systemRole: true } },
  };
}

export function toPlatformUserRow(row: RawRow): PlatformUserRow {
  return {
    id: row.id,
    name: formatPersonNameByRole(row.firstName, row.lastName, row.role.systemRole),
    role: row.role.systemRole,
    status: row.status,
    company: row.company?.name ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listPlatformUsers(
  query: PlatformUserListParams,
  db: UserReader = prisma as unknown as UserReader
): Promise<PlatformUserPage> {
  const where = platformUserWhere(query);
  const [total, rows] = await Promise.all([
    db.user.count({ where }),
    db.user.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      select: platformUserSelect(),
    }),
  ]);

  return {
    page: query.page,
    pageSize: query.pageSize,
    total,
    rows: rows.map(toPlatformUserRow),
  };
}
