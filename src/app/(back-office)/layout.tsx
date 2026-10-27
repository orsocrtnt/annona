"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";
import { BackOfficeLayout } from "@/components/layouts/back-office-layout";
import { getNavItemsForRole } from "@/features/navigation/get-nav-items";
import { adminNavItems, companyNavItems } from "@/features/navigation/nav-config";
import { applyOfferNavLocks } from "@/features/saas/offer-nav";
import { useAuthStore } from "@/stores/auth.store";

export default function BackOfficeRootLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const user = useAuthStore((state) => state.user);
  const saas = useAuthStore((state) => state.saas);

  const navItems = useMemo(() => {
    const items = user?.role.systemRole
      ? getNavItemsForRole(user.role.systemRole, user.settings)
      : pathname.startsWith("/admin") || pathname.startsWith("/companies")
        ? adminNavItems
        : companyNavItems;
    return applyOfferNavLocks(items, saas);
  }, [user, pathname, saas]);

  const mapFullscreen =
    pathname === "/dispatch/drivers" || pathname === "/dispatch/map";
  const dashboardVisualV2 = pathname === "/dashboard";

  return (
    <BackOfficeLayout
      navItems={navItems}
      mapFullscreen={mapFullscreen}
      dashboardVisualV2={dashboardVisualV2}
    >
      {children}
    </BackOfficeLayout>
  );
}
