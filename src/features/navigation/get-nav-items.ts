import type { SystemRole } from "@prisma/client";
import type { NavItem } from "@/types";
import { adminNavItems, companyNavItems, dispatcherNavItems } from "./nav-config";

export function getNavItemsForRole(role?: SystemRole): NavItem[] {
  switch (role) {
    case "SUPER_ADMIN":
      return adminNavItems;
    case "DISPATCHER":
      return dispatcherNavItems;
    case "COMPANY_ADMIN":
    default:
      return companyNavItems;
  }
}
