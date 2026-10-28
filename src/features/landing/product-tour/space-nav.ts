import { BarChart3, Home, LayoutDashboard, LifeBuoy, MapPinned, Package, Radio, Receipt, Truck } from "lucide-react";
import type { SpaceNavItem } from "@/features/landing/product-tour/space-sidebar";

const CLIENT_ITEMS = [
  { icon: Home, label: "Accueil" },
  { icon: Package, label: "Commandes" },
  { icon: MapPinned, label: "Suivi" },
  { icon: Receipt, label: "Factures" },
  { icon: LifeBuoy, label: "Support" },
] as const;

const COMPANY_ITEMS = [
  { icon: LayoutDashboard, label: "Tableau de bord" },
  { icon: Package, label: "Commandes" },
  { icon: Radio, label: "Dispatch" },
  { icon: Truck, label: "Chauffeurs" },
  { icon: BarChart3, label: "Analyse" },
  { icon: Receipt, label: "Facturation" },
] as const;

/** Menus des espaces client et entreprise, avec l'entrée active de la scène. */
export function clientNav(active: (typeof CLIENT_ITEMS)[number]["label"]): SpaceNavItem[] {
  return CLIENT_ITEMS.map((item) => ({ ...item, active: item.label === active }));
}

export function companyNav(active: (typeof COMPANY_ITEMS)[number]["label"]): SpaceNavItem[] {
  return COMPANY_ITEMS.map((item) => ({ ...item, active: item.label === active }));
}
