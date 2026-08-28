import { prisma } from "@/services/prisma/client";
import { PLATFORM_COMPANIES_TAKE } from "@/lib/query/list-limits";

export interface PlatformCompany {
  id: string;
  name: string;
  slug: string;
  status: string;
  users: number;
  deliveries: number;
}

export interface PlatformOverview {
  stats: {
    activeCompanies: number;
    totalUsers: number;
    deliveriesToday: number;
    revenueThisMonth: number;
  };
  companies: PlatformCompany[];
}

export async function getPlatformOverview(): Promise<PlatformOverview> {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [activeCompanies, totalUsers, deliveriesToday, paidThisMonth, companies] =
    await Promise.all([
      prisma.company.count({ where: { status: "ACTIVE" } }),
      prisma.user.count(),
      prisma.delivery.count({ where: { createdAt: { gte: startOfToday } } }),
      prisma.invoice.aggregate({
        _sum: { amount: true },
        where: { status: "PAID", paidAt: { gte: startOfMonth } },
      }),
      prisma.company.findMany({
        orderBy: { createdAt: "desc" },
        take: PLATFORM_COMPANIES_TAKE,
        select: {
          id: true,
          name: true,
          slug: true,
          status: true,
          _count: { select: { users: true, deliveries: true } },
        },
      }),
    ]);

  return {
    stats: {
      activeCompanies,
      totalUsers,
      deliveriesToday,
      revenueThisMonth: Number(paidThisMonth._sum.amount ?? 0),
    },
    companies: companies.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      status: c.status,
      users: c._count.users,
      deliveries: c._count.deliveries,
    })),
  };
}
