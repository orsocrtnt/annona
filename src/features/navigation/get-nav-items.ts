import type { SystemRole } from "@prisma/client";
import type { NavItem } from "@/types";
import { adminNavItems, bakerNavItems, companyNavItems } from "./nav-config";

/** Menu du back-office selon le rôle (le commerçant et le livreur ont leurs propres espaces). */
export function getNavItemsForRole(role?: SystemRole): NavItem[] {
  switch (role) {
    case "SUPER_ADMIN":
      return adminNavItems;
    case "BAKER":
      return bakerNavItems;
    case "ADMIN":
    default:
      return companyNavItems;
  }
}
