import {
  LayoutDashboard, Building2, Users, Settings, Activity, Truck, Package, Shield, UserCircle, Receipt,
  HeadphonesIcon, BookOpen, ChefHat, Route, Tag,
} from "lucide-react";
import type { NavItem } from "@/types";

/** Groupes du menu super-administrateur (ADMIN-ESPACE, lot 1). */
export const ADMIN_NAV_GROUPS = { clients: "Clients", technique: "Technique" } as const;

export const adminNavItems: NavItem[] = [
  { title: "Tableau de bord", href: "/admin", icon: LayoutDashboard },
  { title: "Entreprises", href: "/companies", icon: Building2, group: ADMIN_NAV_GROUPS.clients },
  { title: "Utilisateurs", href: "/admin/users", icon: Users, group: ADMIN_NAV_GROUPS.clients },
  { title: "Exploitation", href: "/admin/operations", icon: Activity, group: ADMIN_NAV_GROUPS.technique },
  { title: "Support plateforme", href: "/admin/support", icon: HeadphonesIcon, group: ADMIN_NAV_GROUPS.technique },
];

/** Administrateur de l'entreprise (back-office). */
export const companyNavItems: NavItem[] = [
  { title: "Tableau de bord", href: "/dashboard", icon: LayoutDashboard },
  { title: "Commandes", href: "/dashboard/orders", icon: Package },
  { title: "Tournées", href: "/dashboard/rounds", icon: Route },
  { title: "Clients", href: "/dashboard/merchants", icon: UserCircle },
  { title: "Catalogue", href: "/dashboard/catalog", icon: BookOpen },
  { title: "Promotions", href: "/dashboard/promotions", icon: Tag },
  { title: "Factures", href: "/dashboard/invoices", icon: Receipt },
  { title: "Support", href: "/support", icon: HeadphonesIcon },
  { title: "Gestion des comptes", href: "/users", icon: Users },
  { title: "Facturation", href: "/settings/billing", icon: Receipt },
  { title: "Paramètres", href: "/settings", icon: Settings },
];

/** Boulanger : un seul espace, la production. */
export const bakerNavItems: NavItem[] = [{ title: "Production", href: "/bakery", icon: ChefHat }];

export const driverNavItems: NavItem[] = [
  { title: "Ma tournée", href: "/driver", icon: Truck },
  { title: "Profil", href: "/driver/profile", icon: Shield },
];
