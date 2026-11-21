import type { SystemRole } from "@prisma/client";
import type { NavItem } from "@/types";
import { adminNavItems, bakerNavItems, companyNavItems, pastryNavItems, sellerNavItems } from "./nav-config";

/** Menu du back-office selon le rôle (le commerçant et le livreur ont leurs propres espaces). */
export function getNavItemsForRole(role?: SystemRole): NavItem[] {
  switch (role) {
    case "SUPER_ADMIN":
      return adminNavItems;
    case "BAKER":
      return bakerNavItems;
    case "PASTRY_CHEF":
      return pastryNavItems;
    case "SELLER":
      return sellerNavItems;
    case "ADMIN":
    default:
      return companyNavItems;
  }
}
