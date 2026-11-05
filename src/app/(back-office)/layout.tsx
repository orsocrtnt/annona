"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { BackOfficeLayout } from "@/components/layouts/back-office-layout";
import { getNavItemsForRole } from "@/features/navigation/get-nav-items";
import { adminNavItems, companyNavItems } from "@/features/navigation/nav-config";
import { applyOfferNavLocks } from "@/features/saas/offer-nav";
import { applyOnboardingNavVisibility } from "@/features/navigation/onboarding-nav";
import { ONBOARDING_QUERY_KEY, fetchOnboardingStatus } from "@/features/back-office/onboarding-query";
import { applyAdminNavBadges } from "@/features/navigation/admin-nav-badges";
import { useAdminNavBadges } from "@/features/admin/hooks";
import { useAdminLastVisits } from "@/features/admin/contact-last-visit";
import { AdminGlobalSearch } from "@/features/admin/search/admin-global-search";
import { useAuthStore } from "@/stores/auth.store";

export default function BackOfficeRootLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const user = useAuthStore((state) => state.user);
  const saas = useAuthStore((state) => state.saas);
  // « Première livraison » : dans le menu tant que le parcours est proposé (même cache que la page du guide).
  const isCompanyAdmin = user?.role.systemRole === "COMPANY_ADMIN";
  const { data: onboarding } = useQuery({
    queryKey: ONBOARDING_QUERY_KEY,
    queryFn: fetchOnboardingStatus,
    enabled: isCompanyAdmin,
    // Court : une étape franchie ailleurs (première livraison terminée) retire l'entrée au retour sur l'onglet.
    staleTime: 30_000,
  });

  // Pastilles du menu super-administrateur : nouveautés Contact et liste d'attente, incidents et tickets ouverts.
  const isSuperAdmin = user?.role.systemRole === "SUPER_ADMIN";
  const adminLastVisits = useAdminLastVisits();
  const { data: adminBadges } = useAdminNavBadges(adminLastVisits, isSuperAdmin);

  const navItems = useMemo(() => {
    const items = user?.role.systemRole
      ? getNavItemsForRole(user.role.systemRole, user.settings)
      : pathname.startsWith("/admin") || pathname.startsWith("/companies")
        ? adminNavItems
        : companyNavItems;
    const withBadges = isSuperAdmin ? applyAdminNavBadges(items, adminBadges?.todo) : items;
    return applyOfferNavLocks(applyOnboardingNavVisibility(withBadges, isCompanyAdmin ? onboarding : undefined), saas);
  }, [user, pathname, saas, isCompanyAdmin, onboarding, isSuperAdmin, adminBadges]);

  const mapFullscreen =
    pathname === "/dispatch/drivers" || pathname === "/dispatch/map";

  return (
    <BackOfficeLayout
      navItems={navItems}
      mapFullscreen={mapFullscreen}
      headerActions={isSuperAdmin ? <AdminGlobalSearch /> : undefined}
    >
      {children}
    </BackOfficeLayout>
  );
}
