-- Lot 1, demandes 2 et 4 (10 novembre 2026) : fonctionnalités séparées pour les comptes « mini admin ».
-- Données de référence seulement (identiques à prisma/reference-data.ts) : trois permissions nouvelles,
-- données au rôle administrateur. Les promotions quittent « catalog:* » ; le suivi des livreurs (demande 5)
-- a sa propre permission. Les mini admins sont des administrateurs dont les fonctionnalités accordées sont
-- dans `users.settings` (aucune colonne nouvelle).

INSERT INTO "permissions" ("id", "slug", "name", "resource", "action", "created_at")
VALUES
  ('rbac_permission_promotions_read', 'promotions:read', 'Lire les promotions', 'promotions', 'read', CURRENT_TIMESTAMP),
  ('rbac_permission_promotions_manage', 'promotions:manage', 'Gérer les promotions', 'promotions', 'manage', CURRENT_TIMESTAMP),
  ('rbac_permission_tracking_read', 'tracking:read', 'Suivre les livreurs', 'tracking', 'read', CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT 'rbac_role_admin', p."id" FROM "permissions" p
WHERE p."slug" IN ('promotions:read', 'promotions:manage', 'tracking:read')
  AND EXISTS (SELECT 1 FROM "roles" r WHERE r."id" = 'rbac_role_admin')
ON CONFLICT DO NOTHING;
