import type { SystemRole } from "@prisma/client";
import type { NavItem } from "@/types";
import { adminNavItems, bakerNavItems, companyNavItems, pastryNavItems, sellerNavItems } from "./nav-config";
import { DEFAULT_SPACE_NAMES, type SpaceNames } from "@/lib/company/space-names";

/** RETOURS-3 : l'entrée d'accueil d'un laboratoire porte le nom choisi par le gérant. */
function withSpaceName(items: NavItem[], href: string, name: string): NavItem[] {
  return items.map((item) => (item.href === href ? { ...item, title: name } : item));
}

/** Menu du back-office selon le rôle (le commerçant et le livreur ont leurs propres espaces). */
export function getNavItemsForRole(role?: SystemRole, names: SpaceNames = DEFAULT_SPACE_NAMES): NavItem[] {
  switch (role) {
    case "SUPER_ADMIN":
      return adminNavItems;
    case "BAKER":
      return withSpaceName(bakerNavItems, "/bakery", names.production);
    case "PASTRY_CHEF":
      return withSpaceName(pastryNavItems, "/pastry", names.atelier);
    case "SELLER":
      return sellerNavItems;
    case "ADMIN":
    default:
      return companyNavItems;
  }
}
