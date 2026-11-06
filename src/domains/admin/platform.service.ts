import { prisma } from "@/services/prisma/client";
import { PLATFORM_COMPANIES_TAKE } from "@/lib/query/list-limits";

export interface PlatformCompany {
  id: string;
  name: string;
  status: string;
  users: number;
  deliveries: number;
}

export interface PlatformOverview {
  stats: {
    activeCompanies: number;
    totalUsers: number;
    deliveriesToday: number;
    paidDeliveryInvoiceRevenue: number;
  };
  companies: PlatformCompany[];
}

export async function getPlatformOverview(now: Date = new Date()): Promise<PlatformOverview> {
  const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const endOfToday = new Date(startOfToday.getTime() + 86_400_000);

  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const endOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

  const [activeCompanies, totalUsers, deliveriesToday, paidThisMonth, companies] =
    await Promise.all([
      prisma.company.count({ where: { status: "ACTIVE" } }),
      prisma.user.count(),
      prisma.delivery.count({ where: { createdAt: { gte: startOfToday, lt: endOfToday } } }),
      prisma.invoice.aggregate({
        _sum: { amount: true },
        where: { status: "PAID", paidAt: { gte: startOfMonth, lt: endOfMonth } },
      }),
      prisma.company.findMany({
        orderBy: { createdAt: "desc" },
        take: PLATFORM_COMPANIES_TAKE,
        select: {
          id: true,
          name: true,
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
      paidDeliveryInvoiceRevenue: Number(paidThisMonth._sum.amount ?? 0),
    },
    companies: companies.map((c) => ({
      id: c.id,
      name: c.name,
      status: c.status,
      users: c._count.users,
      deliveries: c._count.deliveries,
    })),
  };
}
