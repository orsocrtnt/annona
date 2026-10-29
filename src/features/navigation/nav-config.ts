import {
  LayoutDashboard, Building2, Users, Settings, Radio, ClipboardList, Activity, ShieldAlert,
  Truck, Package, MapPin, Shield, UserCircle, Receipt, CreditCard, BarChart3, HeadphonesIcon, ListChecks,
  ScrollText, BadgePercent, Inbox,
} from "lucide-react";
import type { NavItem } from "@/types";

export const adminNavItems: NavItem[] = [
  { title: "Tableau de bord", href: "/admin", icon: LayoutDashboard },
  { title: "Souscriptions", href: "/admin/subscriptions", icon: ClipboardList },
  { title: "Support plateforme", href: "/admin/support", icon: HeadphonesIcon },
  { title: "Exploitation", href: "/admin/operations", icon: Activity },
  { title: "Incidents", href: "/admin/incidents", icon: ShieldAlert },
  { title: "Journal d'accès", href: "/admin/access-events", icon: ScrollText },
  { title: "Codes commerciaux", href: "/admin/sales", icon: BadgePercent },
  { title: "Messages Contact", href: "/admin/contact", icon: Inbox },
  { title: "Entreprises", href: "/companies", icon: Building2 },
  { title: "Utilisateurs", href: "/admin/users", icon: Users },
];

const dispatchMapItems: NavItem[] = [
  { title: "Carte chauffeurs", href: "/dispatch/drivers", icon: Truck },
  { title: "Carte livraison", href: "/dispatch/map", icon: MapPin },
];

export const companyNavItems: NavItem[] = [
  { title: "Tableau de bord", href: "/dashboard", icon: LayoutDashboard },
  { title: "Première livraison", href: "/onboarding", icon: ListChecks },
  { title: "Analyse", href: "/dashboard/analytics", icon: BarChart3 },
  { title: "Commandes", href: "/dashboard/orders", icon: Package },
  { title: "Dispatch", href: "/dispatch", icon: Radio },
  ...dispatchMapItems,
  { title: "Clients", href: "/dashboard/clients", icon: UserCircle },
  { title: "Support", href: "/support", icon: HeadphonesIcon },
  { title: "Chauffeurs", href: "/dashboard/drivers", icon: Truck },
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
  { title: "Chauffeurs", href: "/dashboard/drivers", icon: Truck },
];

/** Tous les écrans back-office, filtrés ensuite par les accès du mini-admin. */
export const miniAdminNavItems: NavItem[] = [
  { title: "Tableau de bord", href: "/dashboard", icon: LayoutDashboard },
  { title: "Analyse", href: "/dashboard/analytics", icon: BarChart3 },
  { title: "Commandes", href: "/dashboard/orders", icon: Package },
  { title: "Dispatch", href: "/dispatch", icon: Radio },
  ...dispatchMapItems,
  { title: "Clients", href: "/dashboard/clients", icon: UserCircle },
  { title: "Support", href: "/support", icon: HeadphonesIcon },
  { title: "Chauffeurs", href: "/dashboard/drivers", icon: Truck },
  { title: "Gestion des comptes", href: "/users", icon: Users },
  { title: "Facturation", href: "/settings/billing", icon: Receipt },
  { title: "Paramètres", href: "/settings", icon: Settings },
];

export const driverNavItems: NavItem[] = [
  { title: "Accueil", href: "/driver", icon: LayoutDashboard },
  { title: "Missions", href: "/driver/missions", icon: Truck },
  { title: "Profil", href: "/driver/profile", icon: Shield },
];
