import { redirect } from "next/navigation";
import { getServerAuth } from "@/lib/api/server-auth";
import { getDashboardPathForRole } from "@/domains/auth/auth.service";
import { getDashboardLayout } from "@/domains/back-office/dashboard-settings.service";
import { getCompanyDashboardStats } from "@/domains/dashboard/dashboard.service";
import { CompanyDashboardContent } from "@/features/back-office/company-dashboard-content";
import type { CompanyDashboardStats } from "@/features/back-office/types";
import { serialize } from "@/lib/serialize";

export default async function CompanyDashboardPage() {
  const auth = await getServerAuth("orders:read");
  if (!auth) redirect("/login");
  if (!auth.user.companyId) {
    redirect(getDashboardPathForRole(auth.user.role.systemRole));
  }

  const [dashboard, layout] = await Promise.all([
    getCompanyDashboardStats(auth.user.companyId),
    getDashboardLayout(auth.user.id),
  ]);

  return (
    <CompanyDashboardContent
      dashboard={serialize(dashboard) as unknown as CompanyDashboardStats}
      initialLayout={serialize(layout)}
    />
  );
}
