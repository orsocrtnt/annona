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

export default function BackOfficeRootLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const user = useAuthStore((state) => state.user);
  // Pastilles du menu super-administrateur : tickets support ouverts.
  const isSuperAdmin = user?.role.systemRole === "SUPER_ADMIN";
  const { data: adminBadges } = useAdminNavBadges(isSuperAdmin);

  const navItems = useMemo(() => {
    const items = user?.role.systemRole
      ? getNavItemsForRole(user.role.systemRole)
      : pathname.startsWith("/admin") || pathname.startsWith("/companies")
        ? adminNavItems
        : companyNavItems;
    return isSuperAdmin ? applyAdminNavBadges(items, adminBadges?.todo) : items;
  }, [user, pathname, isSuperAdmin, adminBadges]);

  return (
    <BackOfficeLayout
      navItems={navItems}
      headerActions={isSuperAdmin ? <AdminGlobalSearch /> : undefined}
    >
      {children}
    </BackOfficeLayout>
  );
}
