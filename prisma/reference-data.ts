import type { SystemRole } from "@prisma/client";

/**
 * Rôles et permissions de la plateforme (SCHEMA-1). Insérés par la migration initiale et
 * resynchronisés par le seed ; la table `role_permissions` est la source lue à la connexion.
 */
export const PERMISSIONS = [
  { slug: "users:read", name: "Lire les utilisateurs", resource: "users", action: "read" },
  { slug: "users:create", name: "Créer des utilisateurs", resource: "users", action: "create" },
  { slug: "users:update", name: "Modifier les utilisateurs", resource: "users", action: "update" },
  { slug: "users:delete", name: "Supprimer les utilisateurs", resource: "users", action: "delete" },
  { slug: "companies:read", name: "Lire les entreprises", resource: "companies", action: "read" },
  { slug: "companies:create", name: "Créer des entreprises", resource: "companies", action: "create" },
  { slug: "companies:update", name: "Modifier les entreprises", resource: "companies", action: "update" },
  { slug: "companies:delete", name: "Supprimer les entreprises", resource: "companies", action: "delete" },
  { slug: "merchants:read", name: "Lire les clients", resource: "merchants", action: "read" },
  { slug: "merchants:manage", name: "Gérer les clients", resource: "merchants", action: "manage" },
  { slug: "catalog:read", name: "Lire le catalogue", resource: "catalog", action: "read" },
  { slug: "catalog:manage", name: "Gérer le catalogue et les prix", resource: "catalog", action: "manage" },
  { slug: "orders:read", name: "Lire les commandes", resource: "orders", action: "read" },
  { slug: "orders:create", name: "Créer des commandes", resource: "orders", action: "create" },
  { slug: "orders:update", name: "Modifier les commandes", resource: "orders", action: "update" },
  { slug: "production:read", name: "Lire la production", resource: "production", action: "read" },
  { slug: "production:update", name: "Marquer préparé, signaler un manquant", resource: "production", action: "update" },
  { slug: "rounds:read", name: "Lire les tournées", resource: "rounds", action: "read" },
  { slug: "rounds:manage", name: "Gérer et attribuer les tournées", resource: "rounds", action: "manage" },
  { slug: "stops:update", name: "Marquer un arrêt livré ou en incident", resource: "stops", action: "update" },
  { slug: "invoices:read", name: "Lire les factures", resource: "invoices", action: "read" },
  { slug: "invoices:create", name: "Créer des factures", resource: "invoices", action: "create" },
  { slug: "invoices:update", name: "Modifier les factures et règlements", resource: "invoices", action: "update" },
  { slug: "settings:read", name: "Lire les paramètres", resource: "settings", action: "read" },
  { slug: "settings:update", name: "Modifier les paramètres", resource: "settings", action: "update" },
  { slug: "support:read", name: "Lire le support", resource: "support", action: "read" },
  { slug: "support:create", name: "Créer une demande support", resource: "support", action: "create" },
  { slug: "dashboard:admin", name: "Espace plateforme", resource: "dashboard", action: "admin" },
  { slug: "dashboard:company", name: "Back-office de l'entreprise", resource: "dashboard", action: "company" },
  { slug: "dashboard:baker", name: "Espace boulanger", resource: "dashboard", action: "baker" },
  { slug: "dashboard:driver", name: "Application livreur", resource: "dashboard", action: "driver" },
  { slug: "dashboard:merchant", name: "Portail client", resource: "dashboard", action: "merchant" },
  // Lot 1 (migration 20261110130000_module_permissions) : fonctionnalités séparées pour les mini admins.
  { slug: "promotions:read", name: "Lire les promotions", resource: "promotions", action: "read" },
  { slug: "promotions:manage", name: "Gérer les promotions", resource: "promotions", action: "manage" },
  { slug: "tracking:read", name: "Suivre les livreurs", resource: "tracking", action: "read" },
] as const;

export const ROLE_PERMISSIONS: Record<SystemRole, readonly string[]> = {
  // Éditeur : entreprises, comptes et supervision ; aucune opération courante (section 3).
  SUPER_ADMIN: [
    "companies:read", "companies:create", "companies:update", "companies:delete",
    "users:read", "users:create", "users:update", "users:delete",
    "support:read",
    "dashboard:admin",
  ],
  ADMIN: [
    "users:read", "users:create", "users:update", "users:delete",
    "companies:read", "companies:update",
    "merchants:read", "merchants:manage",
    "catalog:read", "catalog:manage",
    "promotions:read", "promotions:manage",
    "orders:read", "orders:create", "orders:update",
    "production:read",
    "tracking:read",
    "rounds:read", "rounds:manage", "stops:update",
    "invoices:read", "invoices:create", "invoices:update",
    "settings:read", "settings:update",
    "support:read",
    "dashboard:company",
  ],
  BAKER: ["catalog:read", "orders:read", "production:read", "production:update", "rounds:read", "dashboard:baker"],
  DRIVER: ["rounds:read", "stops:update", "dashboard:driver"],
  MERCHANT: [
    "catalog:read",
    "orders:read", "orders:create", "orders:update",
    "invoices:read",
    "support:read", "support:create",
    "settings:read", "settings:update",
    "dashboard:merchant",
  ],
};

export const ROLES = [
  { slug: "super-admin", name: "Super-administrateur", systemRole: "SUPER_ADMIN", description: "Éditeur de la plateforme" },
  { slug: "admin", name: "Administrateur", systemRole: "ADMIN", description: "Gestion complète de l'entreprise" },
  { slug: "baker", name: "Boulanger", systemRole: "BAKER", description: "Production et préparation des commandes" },
  { slug: "driver", name: "Livreur", systemRole: "DRIVER", description: "Exécution des tournées" },
  { slug: "merchant", name: "Client", systemRole: "MERCHANT", description: "Commerçant qui commande" },
] as const satisfies ReadonlyArray<{
  slug: string;
  name: string;
  systemRole: SystemRole;
  description: string;
}>;
