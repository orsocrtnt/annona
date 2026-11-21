-- Lot 2, demandes 1 et 2 (18 novembre 2026) : données de référence seulement (identiques à prisma/reference-data.ts).
-- Rôles pâtissier et vendeuse, espaces /pastry et /shop, gestion des boutiques par l'administrateur.

INSERT INTO "roles" ("id", "name", "slug", "description", "system_role", "is_system", "created_at", "updated_at")
VALUES
  ('rbac_role_pastry_chef', 'Pâtissier', 'pastry-chef', 'Production de la pâtisserie et envois aux boutiques', 'PASTRY_CHEF', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rbac_role_seller', 'Vendeuse', 'seller', 'Tablette d''une boutique de l''entreprise', 'SELLER', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO NOTHING;

INSERT INTO "permissions" ("id", "slug", "name", "resource", "action", "created_at")
VALUES
  ('rbac_permission_shops_read', 'shops:read', 'Lire les boutiques', 'shops', 'read', CURRENT_TIMESTAMP),
  ('rbac_permission_shops_manage', 'shops:manage', 'Gérer les boutiques', 'shops', 'manage', CURRENT_TIMESTAMP),
  ('rbac_permission_dashboard_pastry', 'dashboard:pastry', 'Espace pâtissier', 'dashboard', 'pastry', CURRENT_TIMESTAMP),
  ('rbac_permission_dashboard_shop', 'dashboard:shop', 'Tablette de la boutique', 'dashboard', 'shop', CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id"
FROM (VALUES
  ('rbac_role_admin', 'shops:read'),
  ('rbac_role_admin', 'shops:manage'),
  ('rbac_role_pastry_chef', 'catalog:read'),
  ('rbac_role_pastry_chef', 'orders:read'),
  ('rbac_role_pastry_chef', 'production:read'),
  ('rbac_role_pastry_chef', 'rounds:read'),
  ('rbac_role_pastry_chef', 'shops:read'),
  ('rbac_role_pastry_chef', 'dashboard:pastry'),
  ('rbac_role_baker', 'shops:read'),
  ('rbac_role_seller', 'dashboard:shop')
) AS grant_list(role_id, permission_slug)
JOIN "roles" r ON r."id" = grant_list.role_id
JOIN "permissions" p ON p."slug" = grant_list.permission_slug
ON CONFLICT DO NOTHING;
