import type { DashboardStat } from "@/types";
import {
  Building2, Users, Truck, Package, TrendingUp,
  Clock, CheckCircle2, AlertTriangle, MapPin,
} from "lucide-react";

export const adminStats: DashboardStat[] = [
  { label: "Entreprises actives", value: "247", change: 12, changeLabel: "vs mois dernier", icon: Building2 },
  { label: "Utilisateurs totaux", value: "3,842", change: 8, changeLabel: "vs mois dernier", icon: Users },
  { label: "Livraisons / jour", value: "12,450", change: 15, changeLabel: "vs hier", icon: Truck },
  { label: "Revenus MRR", value: "€186K", change: 22, changeLabel: "vs mois dernier", icon: TrendingUp },
];

export const companyStats: DashboardStat[] = [
  { label: "Livraisons aujourd'hui", value: "156", change: 8, changeLabel: "vs hier", icon: Truck },
  { label: "En cours", value: "42", icon: Clock },
  { label: "Terminées", value: "108", change: 12, changeLabel: "vs hier", icon: CheckCircle2 },
  { label: "Livreurs actifs", value: "28", icon: Users },
];

export const dispatcherStats: DashboardStat[] = [
  { label: "À dispatcher", value: "18", icon: AlertTriangle },
  { label: "En livraison", value: "42", icon: Truck },
  { label: "Livreurs dispo", value: "12", icon: Users },
  { label: "Retard moyen", value: "4 min", change: -15, changeLabel: "vs hier", icon: Clock },
];

export const clientStats: DashboardStat[] = [
  { label: "Commandes actives", value: "3", icon: Package },
  { label: "En livraison", value: "1", icon: Truck },
  { label: "Livrées ce mois", value: "24", change: 5, changeLabel: "vs mois dernier", icon: CheckCircle2 },
  { label: "Prochaine livraison", value: "14h30", icon: Clock },
];

export const driverStats: DashboardStat[] = [
  { label: "Missions du jour", value: "8", icon: MapPin },
  { label: "Terminées", value: "5", icon: CheckCircle2 },
  { label: "Restantes", value: "3", icon: Clock },
  { label: "Distance parcourue", value: "87 km", icon: Truck },
];

export const mockCompanies = [
  { id: "1", name: "LogiExpress Paris", slug: "logiexpress-paris", status: "ACTIVE", users: 45, deliveries: 1250 },
  { id: "2", name: "SpeedDelivery Lyon", slug: "speeddelivery-lyon", status: "ACTIVE", users: 32, deliveries: 890 },
  { id: "3", name: "FastFreight Marseille", slug: "fastfreight-marseille", status: "TRIAL", users: 8, deliveries: 120 },
  { id: "4", name: "UrbanLogistics Bordeaux", slug: "urbanlogistics-bordeaux", status: "ACTIVE", users: 28, deliveries: 670 },
  { id: "5", name: "QuickShip Nantes", slug: "quickship-nantes", status: "INACTIVE", users: 12, deliveries: 340 },
];

export const mockUsers = [
  { id: "1", name: "Marie Dupont", email: "marie@logiexpress.fr", role: "Administrateur", company: "LogiExpress Paris", status: "ACTIVE" },
  { id: "2", name: "Jean Martin", email: "jean@logiexpress.fr", role: "Dispatcher", company: "LogiExpress Paris", status: "ACTIVE" },
  { id: "3", name: "Pierre Leroy", email: "pierre@logiexpress.fr", role: "Livreur", company: "LogiExpress Paris", status: "ACTIVE" },
  { id: "4", name: "Sophie Bernard", email: "sophie@speeddelivery.fr", role: "Administrateur", company: "SpeedDelivery Lyon", status: "ACTIVE" },
  { id: "5", name: "Lucas Petit", email: "lucas@fastfreight.fr", role: "Livreur", company: "FastFreight Marseille", status: "INACTIVE" },
];

export const mockDeliveries = [
  { id: "DEL-001", status: "EN_COURS", client: "Amazon FR", address: "12 rue de Rivoli, Paris", driver: "Pierre Leroy", eta: "14:30" },
  { id: "DEL-002", status: "EN_ATTENTE", client: "Carrefour", address: "45 av. des Champs, Paris", driver: "—", eta: "—" },
  { id: "DEL-003", status: "LIVREE", client: "Darty", address: "8 bd Haussmann, Paris", driver: "Lucas Petit", eta: "13:15" },
  { id: "DEL-004", status: "EN_COURS", client: "Fnac", address: "22 rue de la Paix, Paris", driver: "Marc Dubois", eta: "15:00" },
  { id: "DEL-005", status: "RETARD", client: "Decathlon", address: "3 pl. de la République, Lyon", driver: "Jean Martin", eta: "16:30" },
];

export const mockMissions = [
  { id: "M-001", status: "EN_COURS", client: "Amazon FR", address: "12 rue de Rivoli, Paris", packages: 3, priority: "HAUTE" },
  { id: "M-002", status: "A_FAIRE", client: "Carrefour", address: "45 av. des Champs, Paris", packages: 1, priority: "NORMALE" },
  { id: "M-003", status: "A_FAIRE", client: "Darty", address: "8 bd Haussmann, Paris", packages: 2, priority: "NORMALE" },
];

export const mockOrders = [
  { id: "CMD-2024-001", date: "2024-06-01", status: "LIVREE", items: 3, total: "€89.90" },
  { id: "CMD-2024-002", date: "2024-06-03", status: "EN_LIVRAISON", items: 1, total: "€45.00" },
  { id: "CMD-2024-003", date: "2024-06-04", status: "PREPARATION", items: 5, total: "€156.50" },
];

export const mockInvoices = [
  { id: "FAC-2024-001", date: "2024-05-31", amount: "€1,250.00", status: "PAYEE" },
  { id: "FAC-2024-002", date: "2024-06-15", amount: "€890.00", status: "EN_ATTENTE" },
];

export const mockActivity = [
  { id: "1", action: "Nouvelle entreprise inscrite", entity: "QuickShip Nantes", time: "Il y a 5 min", type: "company" },
  { id: "2", action: "Livraison terminée", entity: "DEL-003", time: "Il y a 12 min", type: "delivery" },
  { id: "3", action: "Nouveau livreur ajouté", entity: "Marc Dubois", time: "Il y a 25 min", type: "user" },
  { id: "4", action: "Alerte retard", entity: "DEL-005", time: "Il y a 35 min", type: "alert" },
  { id: "5", action: "Mise à jour paramètres", entity: "LogiExpress Paris", time: "Il y a 1h", type: "settings" },
];
