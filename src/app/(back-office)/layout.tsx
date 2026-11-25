"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";
import { DemoBar } from "@/features/demo/demo-bar";
import { BackOfficeLayout } from "@/components/layouts/back-office-layout";
import { getNavItemsForRole } from "@/features/navigation/get-nav-items";
import { adminNavItems, companyNavItems } from "@/features/navigation/nav-config";
import { applyAdminNavBadges, applyCompanyNavBadges } from "@/features/navigation/admin-nav-badges";
import { useCompanySupportSummary } from "@/features/back-office/hooks";
import { useAdminNavBadges } from "@/features/admin/hooks";
import { AdminGlobalSearch } from "@/features/admin/search/admin-global-search";
import { useAuthStore } from "@/stores/auth.store";
import { useAccessRefresh } from "@/hooks/use-access-refresh";
import { canOpenPage } from "@/lib/permissions/page-access";
import { miniAdminModules } from "@/lib/permissions/mini-admin";
import { useSpaceNames } from "@/hooks/use-space-names";
import { BackToDashboard, shouldShowBackToDashboard } from "@/features/navigation/back-to-dashboard";

export default function BackOfficeRootLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const user = useAuthStore((state) => state.user);
  const permissions = useAuthStore((state) => state.permissions);
  // Lot 1, demande 4 : droits relus pendant la session (mini admin modifié par l'administrateur).
  useAccessRefresh();
  // Pastilles du menu super-administrateur : tickets support ouverts.
  const isSuperAdmin = user?.role.systemRole === "SUPER_ADMIN";
  const { data: adminBadges } = useAdminNavBadges(isSuperAdmin);
  const spaceNames = useSpaceNames();
  // RETOURS-3 : pastille rouge du gérant sur « Support » (demandes nouvelles), si le compte ouvre le support.
  const canSeeSupport =
    user?.role.systemRole === "ADMIN" && canOpenPage("/support", { role: user.role.systemRole, permissions, modules: miniAdminModules(user) });
  const { data: supportSummary } = useCompanySupportSummary(Boolean(canSeeSupport));

  const navItems = useMemo(() => {
    const items = user?.role.systemRole
      ? getNavItemsForRole(user.role.systemRole, spaceNames)
      : pathname.startsWith("/admin") || pathname.startsWith("/companies")
        ? adminNavItems
        : companyNavItems;
    if (isSuperAdmin) return applyAdminNavBadges(items, adminBadges?.todo);
    // Lot 1, demande 4 : le menu ne montre que les pages ouvertes au compte (mini admin : ses fonctionnalités).
    if (user?.role.systemRole === "ADMIN") {
      const subject = { role: user.role.systemRole, permissions, modules: miniAdminModules(user) };
      return applyCompanyNavBadges(items.filter((item) => canOpenPage(item.href, subject)), supportSummary);
    }
    return items;
  }, [user, permissions, pathname, isSuperAdmin, adminBadges, spaceNames, supportSummary]);

  return (
    <>
      <DemoBar />
      <BackOfficeLayout
        navItems={navItems}
        headerActions={isSuperAdmin ? <AdminGlobalSearch /> : undefined}
      >
        {shouldShowBackToDashboard(user?.role.systemRole, pathname) ? <BackToDashboard /> : null}
        {children}
      </BackOfficeLayout>
    </>
  );
}
