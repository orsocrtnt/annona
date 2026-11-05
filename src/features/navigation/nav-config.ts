import {
  LayoutDashboard, Building2, Users, Settings, Radio, ClipboardList, Activity, ShieldAlert,
  Truck, Package, MapPin, Shield, UserCircle, Receipt, CreditCard, BarChart3, HeadphonesIcon, ListChecks,
  ScrollText, BadgePercent, Inbox,
} from "lucide-react";
import type { NavItem } from "@/types";

/** Groupes du menu super-administrateur (ADMIN-ESPACE, lot 1). */
export const ADMIN_NAV_GROUPS = { clients: "Clients", commercial: "Commercial", technique: "Technique" } as const;

export const adminNavItems: NavItem[] = [
  { title: "Tableau de bord", href: "/admin", icon: LayoutDashboard },
  { title: "Entreprises", href: "/companies", icon: Building2, group: ADMIN_NAV_GROUPS.clients },
  { title: "Utilisateurs", href: "/admin/users", icon: Users, group: ADMIN_NAV_GROUPS.clients },
  { title: "Souscriptions", href: "/admin/subscriptions", icon: ClipboardList, group: ADMIN_NAV_GROUPS.clients },
  { title: "Messages Contact", href: "/admin/contact", icon: Inbox, group: ADMIN_NAV_GROUPS.commercial },
  { title: "Codes commerciaux", href: "/admin/sales", icon: BadgePercent, group: ADMIN_NAV_GROUPS.commercial },
  { title: "Exploitation", href: "/admin/operations", icon: Activity, group: ADMIN_NAV_GROUPS.technique },
  { title: "Incidents", href: "/admin/incidents", icon: ShieldAlert, group: ADMIN_NAV_GROUPS.technique },
  { title: "Support plateforme", href: "/admin/support", icon: HeadphonesIcon, group: ADMIN_NAV_GROUPS.technique },
  { title: "Journal d'accès", href: "/admin/access-events", icon: ScrollText, group: ADMIN_NAV_GROUPS.technique },
];

/** Une seule entrée « Carte » : livreurs et livraisons sur la même carte (MAP-UNIFY-2). */
const dispatchMapItems: NavItem[] = [{ title: "Carte", href: "/dispatch/map", icon: MapPin }];

export const companyNavItems: NavItem[] = [
  { title: "Tableau de bord", href: "/dashboard", icon: LayoutDashboard },
  { title: "Première livraison", href: "/onboarding", icon: ListChecks },
  { title: "Analyse", href: "/dashboard/analytics", icon: BarChart3 },
  { title: "Commandes", href: "/dashboard/orders", icon: Package },
  { title: "Dispatch", href: "/dispatch", icon: Radio },
  ...dispatchMapItems,
  { title: "Clients", href: "/dashboard/clients", icon: UserCircle },
  { title: "Support", href: "/support", icon: HeadphonesIcon },
  { title: "Livreurs", href: "/dashboard/drivers", icon: Truck },
  { title: "Gestion des comptes", href: "/users", icon: Users },
  { title: "Mon abonnement", href: "/settings/subscription", icon: CreditCard },
  { title: "Facturation", href: "/settings/billing", icon: Receipt },
  { title: "Paramètres", href: "/settings", icon: Settings },
];

export const dispatcherNavItems: NavItem[] = [
  { title: "Dispatch", href: "/dispatch", icon: Radio },
  { title: "Commandes", href: "/dashboard/orders", icon: Package },
  ...dispatchMapItems,
  { title: "Clients", href: "/dashboard/clients", icon: UserCircle },
  { title: "Support", href: "/support", icon: HeadphonesIcon },
  { title: "Livreurs", href: "/dashboard/drivers", icon: Truck },
];

/** Tous les écrans back-office, filtrés ensuite par les accès du mini-admin. */
export const miniAdminNavItems: NavItem[] = [
  { title: "Tableau de bord", href: "/dashboard", icon: LayoutDashboard },
  { title: "Analyse", href: "/dashboard/analytics", icon: BarChart3 },
  { title: "Commandes", href: "/dashboard/orders", icon: Package },
  { title: "Dispatch", href: "/dispatch", icon: Radio },
  ...dispatchMapItems,
  // Mini-admin qui n'a que l'ancien module « Carte livreurs » : même carte, par son ancienne adresse.
  { title: "Carte", href: "/dispatch/drivers", icon: MapPin },
  { title: "Clients", href: "/dashboard/clients", icon: UserCircle },
  { title: "Support", href: "/support", icon: HeadphonesIcon },
  { title: "Livreurs", href: "/dashboard/drivers", icon: Truck },
  { title: "Gestion des comptes", href: "/users", icon: Users },
  { title: "Facturation", href: "/settings/billing", icon: Receipt },
  { title: "Paramètres", href: "/settings", icon: Settings },
];

export const driverNavItems: NavItem[] = [
  { title: "Accueil", href: "/driver", icon: LayoutDashboard },
  { title: "Missions", href: "/driver/missions", icon: Truck },
  { title: "Profil", href: "/driver/profile", icon: Shield },
];
