-- TutelLiv system roles and permissions are application reference data.
-- This migration is additive and preserves existing row identifiers.

INSERT INTO "permissions" ("id", "slug", "name", "resource", "action", "created_at")
VALUES
  ('rbac_permission_users_read', 'users:read', 'Lire les utilisateurs', 'users', 'read', CURRENT_TIMESTAMP),
  ('rbac_permission_users_create', 'users:create', 'Créer des utilisateurs', 'users', 'create', CURRENT_TIMESTAMP),
  ('rbac_permission_users_update', 'users:update', 'Modifier les utilisateurs', 'users', 'update', CURRENT_TIMESTAMP),
  ('rbac_permission_users_delete', 'users:delete', 'Supprimer les utilisateurs', 'users', 'delete', CURRENT_TIMESTAMP),
  ('rbac_permission_companies_read', 'companies:read', 'Lire les entreprises', 'companies', 'read', CURRENT_TIMESTAMP),
  ('rbac_permission_companies_create', 'companies:create', 'Créer des entreprises', 'companies', 'create', CURRENT_TIMESTAMP),
  ('rbac_permission_companies_update', 'companies:update', 'Modifier les entreprises', 'companies', 'update', CURRENT_TIMESTAMP),
  ('rbac_permission_companies_delete', 'companies:delete', 'Supprimer les entreprises', 'companies', 'delete', CURRENT_TIMESTAMP),
  ('rbac_permission_deliveries_read', 'deliveries:read', 'Lire les livraisons', 'deliveries', 'read', CURRENT_TIMESTAMP),
  ('rbac_permission_deliveries_create', 'deliveries:create', 'Créer des livraisons', 'deliveries', 'create', CURRENT_TIMESTAMP),
  ('rbac_permission_deliveries_update', 'deliveries:update', 'Modifier les livraisons', 'deliveries', 'update', CURRENT_TIMESTAMP),
  ('rbac_permission_deliveries_delete', 'deliveries:delete', 'Supprimer les livraisons', 'deliveries', 'delete', CURRENT_TIMESTAMP),
  ('rbac_permission_deliveries_dispatch', 'deliveries:dispatch', 'Dispatcher les livraisons', 'deliveries', 'dispatch', CURRENT_TIMESTAMP),
  ('rbac_permission_orders_read', 'orders:read', 'Lire les commandes', 'orders', 'read', CURRENT_TIMESTAMP),
  ('rbac_permission_orders_create', 'orders:create', 'Créer des commandes', 'orders', 'create', CURRENT_TIMESTAMP),
  ('rbac_permission_orders_update', 'orders:update', 'Modifier les commandes', 'orders', 'update', CURRENT_TIMESTAMP),
  ('rbac_permission_drivers_read', 'drivers:read', 'Lire les chauffeurs', 'drivers', 'read', CURRENT_TIMESTAMP),
  ('rbac_permission_drivers_manage', 'drivers:manage', 'Gérer les chauffeurs', 'drivers', 'manage', CURRENT_TIMESTAMP),
  ('rbac_permission_vehicles_read', 'vehicles:read', 'Lire les véhicules', 'vehicles', 'read', CURRENT_TIMESTAMP),
  ('rbac_permission_vehicles_manage', 'vehicles:manage', 'Gérer les véhicules', 'vehicles', 'manage', CURRENT_TIMESTAMP),
  ('rbac_permission_analytics_read', 'analytics:read', 'Lire les analytics', 'analytics', 'read', CURRENT_TIMESTAMP),
  ('rbac_permission_settings_read', 'settings:read', 'Lire les paramètres', 'settings', 'read', CURRENT_TIMESTAMP),
  ('rbac_permission_settings_update', 'settings:update', 'Modifier les paramètres', 'settings', 'update', CURRENT_TIMESTAMP),
  ('rbac_permission_dashboard_admin', 'dashboard:admin', 'Dashboard Super Admin', 'dashboard', 'admin', CURRENT_TIMESTAMP),
  ('rbac_permission_dashboard_company', 'dashboard:company', 'Dashboard Entreprise', 'dashboard', 'company', CURRENT_TIMESTAMP),
  ('rbac_permission_dashboard_dispatcher', 'dashboard:dispatcher', 'Dashboard Dispatcher', 'dashboard', 'dispatcher', CURRENT_TIMESTAMP),
  ('rbac_permission_dashboard_driver', 'dashboard:driver', 'Dashboard Chauffeur', 'dashboard', 'driver', CURRENT_TIMESTAMP),
  ('rbac_permission_dashboard_client', 'dashboard:client', 'Dashboard Client', 'dashboard', 'client', CURRENT_TIMESTAMP),
  ('rbac_permission_invoices_read', 'invoices:read', 'Lire les factures', 'invoices', 'read', CURRENT_TIMESTAMP),
  ('rbac_permission_invoices_create', 'invoices:create', 'Créer des factures', 'invoices', 'create', CURRENT_TIMESTAMP),
  ('rbac_permission_invoices_update', 'invoices:update', 'Modifier les factures', 'invoices', 'update', CURRENT_TIMESTAMP),
  ('rbac_permission_support_read', 'support:read', 'Lire le support', 'support', 'read', CURRENT_TIMESTAMP),
  ('rbac_permission_support_create', 'support:create', 'Créer une demande support', 'support', 'create', CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO UPDATE SET
  "name" = EXCLUDED."name",
  "resource" = EXCLUDED."resource",
  "action" = EXCLUDED."action";

INSERT INTO "roles" ("id", "slug", "name", "description", "system_role", "is_system", "created_at", "updated_at")
VALUES
  ('rbac_role_super_admin', 'super-admin', 'Super Admin', 'Accès complet à la plateforme', 'SUPER_ADMIN', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rbac_role_company_admin', 'company-admin', 'Administrateur', 'Gestion complète de l''entreprise', 'COMPANY_ADMIN', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rbac_role_mini_admin', 'mini-admin', 'Mini-admin', 'Ops quotidien sans paramètres ni gestion des comptes', 'MINI_ADMIN', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rbac_role_dispatcher', 'dispatcher', 'Dispatcher', 'Gestion des livraisons et dispatch', 'DISPATCHER', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rbac_role_driver', 'driver', 'Chauffeur', 'Exécution des livraisons', 'DRIVER', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rbac_role_client', 'client', 'Client', 'Suivi des commandes et livraisons', 'CLIENT', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO UPDATE SET
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "system_role" = EXCLUDED."system_role",
  "is_system" = true,
  "updated_at" = CURRENT_TIMESTAMP;

WITH expected("role_slug", "permission_slug") AS (
  VALUES
    ('super-admin', 'users:read'), ('super-admin', 'users:create'), ('super-admin', 'users:update'), ('super-admin', 'users:delete'),
    ('super-admin', 'companies:read'), ('super-admin', 'companies:create'), ('super-admin', 'companies:update'), ('super-admin', 'companies:delete'),
    ('super-admin', 'deliveries:read'), ('super-admin', 'deliveries:create'), ('super-admin', 'deliveries:update'), ('super-admin', 'deliveries:delete'), ('super-admin', 'deliveries:dispatch'),
    ('super-admin', 'orders:read'), ('super-admin', 'orders:create'), ('super-admin', 'orders:update'),
    ('super-admin', 'drivers:read'), ('super-admin', 'drivers:manage'), ('super-admin', 'vehicles:read'), ('super-admin', 'vehicles:manage'),
    ('super-admin', 'analytics:read'), ('super-admin', 'settings:read'), ('super-admin', 'settings:update'),
    ('super-admin', 'dashboard:admin'), ('super-admin', 'dashboard:company'), ('super-admin', 'dashboard:dispatcher'), ('super-admin', 'dashboard:driver'), ('super-admin', 'dashboard:client'),
    ('super-admin', 'invoices:read'), ('super-admin', 'invoices:create'), ('super-admin', 'invoices:update'), ('super-admin', 'support:read'), ('super-admin', 'support:create'),

    ('company-admin', 'users:read'), ('company-admin', 'users:create'), ('company-admin', 'users:update'), ('company-admin', 'users:delete'),
    ('company-admin', 'companies:read'), ('company-admin', 'companies:update'),
    ('company-admin', 'deliveries:read'), ('company-admin', 'deliveries:create'), ('company-admin', 'deliveries:update'), ('company-admin', 'deliveries:delete'), ('company-admin', 'deliveries:dispatch'),
    ('company-admin', 'orders:read'), ('company-admin', 'orders:create'), ('company-admin', 'orders:update'),
    ('company-admin', 'drivers:read'), ('company-admin', 'drivers:manage'), ('company-admin', 'vehicles:read'), ('company-admin', 'vehicles:manage'),
    ('company-admin', 'analytics:read'), ('company-admin', 'settings:read'), ('company-admin', 'settings:update'),
    ('company-admin', 'invoices:read'), ('company-admin', 'invoices:create'), ('company-admin', 'invoices:update'),
    ('company-admin', 'support:read'), ('company-admin', 'dashboard:company'),

    ('mini-admin', 'users:read'), ('mini-admin', 'users:create'), ('mini-admin', 'users:update'), ('mini-admin', 'users:delete'),
    ('mini-admin', 'companies:read'), ('mini-admin', 'companies:update'),
    ('mini-admin', 'deliveries:read'), ('mini-admin', 'deliveries:create'), ('mini-admin', 'deliveries:update'), ('mini-admin', 'deliveries:delete'), ('mini-admin', 'deliveries:dispatch'),
    ('mini-admin', 'orders:read'), ('mini-admin', 'orders:create'), ('mini-admin', 'orders:update'),
    ('mini-admin', 'drivers:read'), ('mini-admin', 'drivers:manage'), ('mini-admin', 'vehicles:read'), ('mini-admin', 'vehicles:manage'),
    ('mini-admin', 'analytics:read'), ('mini-admin', 'settings:read'), ('mini-admin', 'settings:update'),
    ('mini-admin', 'invoices:read'), ('mini-admin', 'invoices:create'), ('mini-admin', 'invoices:update'),
    ('mini-admin', 'support:read'), ('mini-admin', 'dashboard:company'), ('mini-admin', 'dashboard:dispatcher'),

    ('dispatcher', 'deliveries:read'), ('dispatcher', 'deliveries:create'), ('dispatcher', 'deliveries:update'), ('dispatcher', 'deliveries:dispatch'),
    ('dispatcher', 'orders:read'), ('dispatcher', 'orders:create'), ('dispatcher', 'orders:update'),
    ('dispatcher', 'drivers:read'), ('dispatcher', 'vehicles:read'), ('dispatcher', 'support:read'), ('dispatcher', 'dashboard:dispatcher'),

    ('driver', 'deliveries:read'), ('driver', 'deliveries:update'), ('driver', 'dashboard:driver'),

    ('client', 'orders:read'), ('client', 'orders:create'), ('client', 'deliveries:read'), ('client', 'invoices:read'),
    ('client', 'support:read'), ('client', 'support:create'), ('client', 'settings:read'), ('client', 'settings:update'), ('client', 'dashboard:client')
)
INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT roles."id", permissions."id"
FROM expected
JOIN "roles" ON roles."slug" = expected."role_slug"
JOIN "permissions" ON permissions."slug" = expected."permission_slug"
ON CONFLICT ("role_id", "permission_id") DO NOTHING;
