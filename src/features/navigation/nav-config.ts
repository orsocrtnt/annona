import {
  LayoutDashboard, Building2, Users, Settings, Activity, Truck, Package, Shield, UserCircle, Receipt,
  HeadphonesIcon, BookOpen, Route, Tag, Navigation, Store, MonitorPlay, Factory, Boxes, ClipboardList } from "lucide-react";
import type { NavItem } from "@/types";

/** Groupes du menu super-administrateur (ADMIN-ESPACE, lot 1). */
export const ADMIN_NAV_GROUPS = { clients: "Clients", technique: "Technique" } as const;

export const adminNavItems: NavItem[] = [
  { title: "Tableau de bord", href: "/admin", icon: LayoutDashboard },
  { title: "Entreprises", href: "/companies", icon: Building2, group: ADMIN_NAV_GROUPS.clients },
  { title: "Utilisateurs", href: "/admin/users", icon: Users, group: ADMIN_NAV_GROUPS.clients },
  { title: "Exploitation", href: "/admin/operations", icon: Activity, group: ADMIN_NAV_GROUPS.technique },
  { title: "Support plateforme", href: "/admin/support", icon: HeadphonesIcon, group: ADMIN_NAV_GROUPS.technique },
  { title: "Démos", href: "/admin/demos", icon: MonitorPlay, group: ADMIN_NAV_GROUPS.technique },
];

/** Administrateur de l'entreprise (back-office). */
export const companyNavItems: NavItem[] = [
  { title: "Tableau de bord", href: "/dashboard", icon: LayoutDashboard },
  { title: "Commandes", href: "/dashboard/orders", icon: Package },
  { title: "Carte", href: "/dashboard/tracking", icon: Navigation },
  { title: "Tournées", href: "/dashboard/rounds", icon: Route },
  { title: "Clients", href: "/dashboard/merchants", icon: UserCircle },
  { title: "Points de vente", href: "/dashboard/shops", icon: Store },
  { title: "Stock des points de vente", href: "/dashboard/stock", icon: Package },
  { title: "Catalogue", href: "/dashboard/catalog", icon: BookOpen },
  { title: "Promotions", href: "/dashboard/promotions", icon: Tag },
  { title: "Factures", href: "/dashboard/invoices", icon: Receipt },
  { title: "Support", href: "/support", icon: HeadphonesIcon },
  { title: "Gestion des comptes", href: "/users", icon: Users },
  { title: "Facturation", href: "/settings/billing", icon: Receipt },
  { title: "Paramètres", href: "/settings", icon: Settings },
];

/** Boulanger : un seul espace, la production. */
export const bakerNavItems: NavItem[] = [
  { title: "Production", href: "/bakery", icon: Factory },
  // Lot 2, demande 3 : durée de vente du pain.
  { title: "Durée de vente", href: "/bakery/products", icon: BookOpen },
  // Lot 2, demande 5 : envois quotidiens vers les boutiques.
  { title: "Envois aux points de vente", href: "/bakery/shipments", icon: Truck },
  // Lot 2, demande 8 : stock des boutiques (pain).
  { title: "Stock des points de vente", href: "/bakery/stock", icon: Store },
];

/** Lot 2, demande 1 : tablette de la boutique (vendeuse). */
export const sellerNavItems: NavItem[] = [
  { title: "Mon point de vente", href: "/shop", icon: Store },
  // Lot 2, demandes 6, 7 et 8 : réception du matin, clôture du soir, stock.
  { title: "Réception du matin", href: "/shop/reception", icon: Package },
  { title: "Clôture du soir", href: "/shop/closing", icon: Receipt },
  { title: "Stock", href: "/shop/stock", icon: BookOpen },
  // Lot 2, demande 9 : commandes de gâteaux des particuliers.
  { title: "Commandes sur mesure", href: "/shop/cakes", icon: ClipboardList },
  { title: "Paramètres", href: "/shop/settings", icon: Settings },
];

/** Lot 2, demande 2 : espace pâtissier. */
export const pastryNavItems: NavItem[] = [
  { title: "Atelier", href: "/pastry", icon: Boxes },
  // Lot 2, demande 3 : fiches, recettes et durées de vente des pâtisseries.
  { title: "Mes produits", href: "/pastry/products", icon: BookOpen },
  { title: "Envois aux points de vente", href: "/pastry/shipments", icon: Truck },
  { title: "Stock des points de vente", href: "/pastry/stock", icon: Store },
];

export const driverNavItems: NavItem[] = [
  { title: "Ma tournée", href: "/driver", icon: Truck },
  { title: "Profil", href: "/driver/profile", icon: Shield },
];
