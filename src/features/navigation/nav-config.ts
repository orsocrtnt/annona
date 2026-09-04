import {
  LayoutDashboard, Building2, Users, Settings, Radio,
  Truck, Package, BarChart3, MapPin, Shield, UserCircle, Receipt,
} from "lucide-react";
import type { NavItem } from "@/types";

export const adminNavItems: NavItem[] = [
  { title: "Tableau de bord", href: "/admin", icon: LayoutDashboard },
  { title: "Entreprises", href: "/companies", icon: Building2 },
  { title: "Utilisateurs", href: "/users", icon: Users },
  { title: "Analytics", href: "/admin/analytics", icon: BarChart3, disabled: true },
  { title: "Facturation", href: "/settings/billing", icon: Receipt },
  { title: "Paramètres", href: "/settings", icon: Settings },
];

const dispatchMapItems: NavItem[] = [
  { title: "Carte chauffeurs", href: "/dispatch/drivers", icon: Truck },
  { title: "Carte livraison", href: "/dispatch/map", icon: MapPin },
];

export const companyNavItems: NavItem[] = [
  { title: "Tableau de bord", href: "/dashboard", icon: LayoutDashboard },
  { title: "Commandes", href: "/dashboard/orders", icon: Package },
  { title: "Dispatch", href: "/dispatch", icon: Radio },
  ...dispatchMapItems,
  { title: "Clients", href: "/dashboard/clients", icon: UserCircle },
  { title: "Chauffeurs", href: "/dashboard/drivers", icon: Truck },
  { title: "Gestion des comptes", href: "/users", icon: Users },
  { title: "Analytics", href: "/dashboard/analytics", icon: BarChart3, disabled: true, badge: "Bientôt" },
  { title: "Facturation", href: "/settings/billing", icon: Receipt },
  { title: "Paramètres", href: "/settings", icon: Settings },
];

export const dispatcherNavItems: NavItem[] = [
  { title: "Dispatch", href: "/dispatch", icon: Radio },
  { title: "Commandes", href: "/dashboard/orders", icon: Package },
  ...dispatchMapItems,
  { title: "Clients", href: "/dashboard/clients", icon: UserCircle },
  { title: "Chauffeurs", href: "/dashboard/drivers", icon: Truck },
  { title: "Gestion des comptes", href: "/users", icon: Users },
];

/** Tous les écrans back-office, filtrés ensuite par les accès du mini-admin. */
export const miniAdminNavItems: NavItem[] = [
  { title: "Tableau de bord", href: "/dashboard", icon: LayoutDashboard },
  { title: "Commandes", href: "/dashboard/orders", icon: Package },
  { title: "Dispatch", href: "/dispatch", icon: Radio },
  ...dispatchMapItems,
  { title: "Clients", href: "/dashboard/clients", icon: UserCircle },
  { title: "Chauffeurs", href: "/dashboard/drivers", icon: Truck },
  { title: "Gestion des comptes", href: "/users", icon: Users },
  { title: "Analytics", href: "/dashboard/analytics", icon: BarChart3, disabled: true, badge: "Bientôt" },
  { title: "Facturation", href: "/settings/billing", icon: Receipt },
  { title: "Paramètres", href: "/settings", icon: Settings },
];

export const driverNavItems: NavItem[] = [
  { title: "Accueil", href: "/driver", icon: LayoutDashboard },
  { title: "Missions", href: "/driver/missions", icon: Truck },
  { title: "Profil", href: "/driver/profile", icon: Shield },
];
