-- Lot 2, demande 5 (18 novembre 2026) : envois quotidiens du laboratoire vers les boutiques. Un envoi est une
-- commande d'origine SHIPMENT vers la boutique (créneau du matin de sa tournée) : il devient un arrêt de la
-- tournée du livreur, avec la liste des produits. Aucune nouvelle table.

ALTER TYPE "OrderOrigin" ADD VALUE 'SHIPMENT';

-- Données de référence (identiques à prisma/reference-data.ts) : le pâtissier envoie la pâtisserie, le boulanger le pain.
INSERT INTO "permissions" ("id", "slug", "name", "resource", "action", "created_at")
VALUES ('rbac_permission_shipments_manage', 'shipments:manage', 'Envoyer des produits aux boutiques', 'shipments', 'manage', CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id"
FROM (VALUES
  ('rbac_role_pastry_chef', 'shipments:manage'),
  ('rbac_role_baker', 'shipments:manage')
) AS grant_list(role_id, permission_slug)
JOIN "roles" r ON r."id" = grant_list.role_id
JOIN "permissions" p ON p."slug" = grant_list.permission_slug
ON CONFLICT DO NOTHING;
