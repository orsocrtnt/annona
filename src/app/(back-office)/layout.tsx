"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";
import { BackOfficeLayout } from "@/components/layouts/back-office-layout";
import { getNavItemsForRole } from "@/features/navigation/get-nav-items";
import { adminNavItems, companyNavItems } from "@/features/navigation/nav-config";
import { applyAdminNavBadges } from "@/features/navigation/admin-nav-badges";
import { useAdminNavBadges } from "@/features/admin/hooks";
import { AdminGlobalSearch } from "@/features/admin/search/admin-global-search";
import { useAuthStore } from "@/stores/auth.store";
import { useAccessRefresh } from "@/hooks/use-access-refresh";
import { canOpenPage } from "@/lib/permissions/page-access";
import { miniAdminModules } from "@/lib/permissions/mini-admin";

export default function BackOfficeRootLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const user = useAuthStore((state) => state.user);
  const permissions = useAuthStore((state) => state.permissions);
  // Lot 1, demande 4 : droits relus pendant la session (mini admin modifié par l'administrateur).
  useAccessRefresh();
  // Pastilles du menu super-administrateur : tickets support ouverts.
  const isSuperAdmin = user?.role.systemRole === "SUPER_ADMIN";
  const { data: adminBadges } = useAdminNavBadges(isSuperAdmin);

  const navItems = useMemo(() => {
    const items = user?.role.systemRole
      ? getNavItemsForRole(user.role.systemRole)
      : pathname.startsWith("/admin") || pathname.startsWith("/companies")
        ? adminNavItems
        : companyNavItems;
    if (isSuperAdmin) return applyAdminNavBadges(items, adminBadges?.todo);
    // Lot 1, demande 4 : le menu ne montre que les pages ouvertes au compte (mini admin : ses fonctionnalités).
    if (user?.role.systemRole === "ADMIN") {
      const subject = { role: user.role.systemRole, permissions, modules: miniAdminModules(user) };
      return items.filter((item) => canOpenPage(item.href, subject));
    }
    return items;
  }, [user, permissions, pathname, isSuperAdmin, adminBadges]);

  return (
    <BackOfficeLayout
      navItems={navItems}
      headerActions={isSuperAdmin ? <AdminGlobalSearch /> : undefined}
    >
      {children}
    </BackOfficeLayout>
  );
}
