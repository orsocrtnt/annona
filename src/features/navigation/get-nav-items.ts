import type { SystemRole } from "@prisma/client";
import type { NavItem } from "@/types";
import {
  adminNavItems,
  companyNavItems,
  dispatcherNavItems,
  miniAdminNavItems,
} from "./nav-config";
import { miniAdminAllowsHref, parseMiniAdminSettings } from "@/lib/permissions/mini-admin";

export function getNavItemsForRole(role?: SystemRole, settings?: unknown): NavItem[] {
  switch (role) {
    case "SUPER_ADMIN":
      return adminNavItems;
    case "DISPATCHER":
      return dispatcherNavItems;
    case "MINI_ADMIN": {
      const { modules } = parseMiniAdminSettings(settings);
      const allowed = miniAdminNavItems.filter((item) => miniAdminAllowsHref(item.href, modules));
      // Les deux anciens modules carte mènent à la même carte : une seule entrée « Carte ».
      return allowed.filter((item, index) => allowed.findIndex((other) => other.title === item.title) === index);
    }
    case "COMPANY_ADMIN":
    default:
      return companyNavItems;
  }
}
