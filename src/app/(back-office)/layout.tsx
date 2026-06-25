"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";
import { BackOfficeLayout } from "@/components/layouts/back-office-layout";
import { getNavItemsForRole } from "@/features/navigation/get-nav-items";
import { adminNavItems, companyNavItems } from "@/features/navigation/nav-config";
import { useAuthStore } from "@/stores/auth.store";

export default function BackOfficeRootLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const user = useAuthStore((state) => state.user);

  const navItems = useMemo(() => {
    if (user?.role.systemRole) {
      return getNavItemsForRole(user.role.systemRole);
    }
    if (pathname.startsWith("/admin") || pathname.startsWith("/companies")) {
      return adminNavItems;
    }
    return companyNavItems;
  }, [user, pathname]);

  const mapFullscreen =
    pathname === "/dispatch/drivers" || pathname === "/dispatch/map";

  return (
    <BackOfficeLayout navItems={navItems} mapFullscreen={mapFullscreen}>
      {children}
    </BackOfficeLayout>
  );
}
