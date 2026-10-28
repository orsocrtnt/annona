import {
  BarChart3,
  FileText,
  HeadphonesIcon,
  LayoutDashboard,
  Package,
  Radio,
  Receipt,
  RefreshCw,
  Settings,
  ShoppingBag,
  Truck,
} from "lucide-react";
import type { SpaceNavItem } from "@/features/landing/product-tour/space-sidebar";

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
