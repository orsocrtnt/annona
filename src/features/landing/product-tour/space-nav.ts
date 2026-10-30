import {
  FileText,
  HeadphonesIcon,
  LayoutDashboard,
  RefreshCw,
  Settings,
  ShoppingBag,
  Truck,
  type LucideIcon,
} from "lucide-react";
import type { SpaceNavItem } from "@/features/landing/product-tour/space-sidebar";
import { companyNavItems } from "@/features/navigation/nav-config";

/** Les onglets réels du portail client (`client-portal-layout.tsx`). */
const CLIENT_ITEMS = [
  { icon: LayoutDashboard, label: "Tableau de bord" },
  { icon: ShoppingBag, label: "Mes commandes" },
  { icon: RefreshCw, label: "Récurrentes" },
  { icon: Truck, label: "Livraisons" },
  { icon: FileText, label: "Factures" },
  { icon: HeadphonesIcon, label: "Support" },
  { icon: Settings, label: "Paramètres" },
] as const;

/** Le vrai menu de l'espace entreprise (`nav-config.ts`) : tous les onglets disponibles aujourd'hui. */
const COMPANY_ITEMS = companyNavItems.flatMap((item) =>
  // Toutes les icônes de la navigation sont des icônes Lucide.
  item.icon ? [{ icon: item.icon as LucideIcon, label: item.title }] : []
);

/** Menus des espaces client et entreprise, avec l'entrée active de la scène. */
export function clientNav(active: (typeof CLIENT_ITEMS)[number]["label"]): SpaceNavItem[] {
  return CLIENT_ITEMS.map((item) => ({ ...item, active: item.label === active }));
}

export function companyNav(active: string): SpaceNavItem[] {
  return COMPANY_ITEMS.map((item) => ({ ...item, active: item.label === active }));
}
