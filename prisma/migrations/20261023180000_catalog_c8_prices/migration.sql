-- Catalogue C8 : prix validés le 23/10/2026 (Drive « Catalogue des offres et tarifs »).
-- C7 reste historisé pour les souscriptions déjà instantanées.

UPDATE "saas_catalog_versions"
SET "status" = 'RETIRED', "retired_at" = CURRENT_TIMESTAMP, "updated_at" = CURRENT_TIMESTAMP
WHERE "id" = 'saas_catalog_c7_v1' AND "status" = 'ACTIVE';

INSERT INTO "saas_catalog_versions" (
  "id", "code", "status", "currency", "vat_rate_bps", "effective_at", "created_at", "updated_at"
) VALUES (
  'saas_catalog_c8_v1', 'C8-2026-10-23', 'ACTIVE', 'EUR', 2000,
  TIMESTAMP '2026-10-23 00:00:00', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
);

INSERT INTO "saas_plans" (
  "id", "catalog_version_id", "code", "name", "monthly_price_cents", "annual_price_cents",
  "included_driver_seats", "unlimited_driver_seats", "max_driver_seats", "included_admin_seats", "max_admin_seats",
  "included_dispatcher_seats", "max_dispatcher_seats", "included_monthly_orders",
  "order_overage_unit_price_cents", "included_features", "created_at", "updated_at"
) VALUES
  ('saas_plan_c8_starter', 'saas_catalog_c8_v1', 'STARTER', 'Starter', 7900, 79000, 5, false, 10, 1, NULL, 0, NULL, 1000, 10, ARRAY[]::TEXT[], CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('saas_plan_c8_pro', 'saas_catalog_c8_v1', 'PRO', 'Pro', 17900, 179000, 10, false, 30, 1, NULL, 1, NULL, 3000, 8, ARRAY['auto_dispatch','admin_gps']::TEXT[], CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('saas_plan_c8_business', 'saas_catalog_c8_v1', 'BUSINESS', 'Business', 34900, 349000, 0, true, NULL, 2, NULL, 1, NULL, 6000, 6, ARRAY['auto_dispatch','admin_gps','client_gps','advanced_analytics','priority_support']::TEXT[], CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT INTO "saas_options" (
  "id", "catalog_version_id", "code", "name", "kind", "feature_key", "seat_role",
  "monthly_price_cents", "annual_price_cents", "applicable_plans", "created_at", "updated_at"
) VALUES
  ('saas_option_c8_auto_dispatch', 'saas_catalog_c8_v1', 'AUTO_DISPATCH', 'Dispatch automatique', 'OPTION', 'auto_dispatch', NULL, 2900, 34800, ARRAY['STARTER']::"SaasPlanCode"[], CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('saas_option_c8_admin_gps', 'saas_catalog_c8_v1', 'ADMIN_GPS', 'Carte GPS administrateur', 'OPTION', 'admin_gps', NULL, 3900, 46800, ARRAY['STARTER']::"SaasPlanCode"[], CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('saas_option_c8_client_gps', 'saas_catalog_c8_v1', 'CLIENT_GPS', 'Carte GPS client', 'OPTION', 'client_gps', NULL, 4900, 58800, ARRAY['STARTER','PRO']::"SaasPlanCode"[], CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('saas_option_c8_advanced_analytics', 'saas_catalog_c8_v1', 'ADVANCED_ANALYTICS', 'Analytics avancés', 'OPTION', 'advanced_analytics', NULL, 2900, 34800, ARRAY['STARTER','PRO']::"SaasPlanCode"[], CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('saas_option_c8_priority_support', 'saas_catalog_c8_v1', 'PRIORITY_SUPPORT', 'Support prioritaire', 'OPTION', 'priority_support', NULL, 2900, 34800, ARRAY['STARTER','PRO']::"SaasPlanCode"[], CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('saas_option_c8_driver_starter', 'saas_catalog_c8_v1', 'DRIVER_STARTER', 'Livreur supplémentaire Starter', 'DRIVER_SEAT', NULL, 'DRIVER', 1200, 14400, ARRAY['STARTER']::"SaasPlanCode"[], CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('saas_option_c8_driver_pro', 'saas_catalog_c8_v1', 'DRIVER_PRO', 'Livreur supplémentaire Pro', 'DRIVER_SEAT', NULL, 'DRIVER', 1000, 12000, ARRAY['PRO']::"SaasPlanCode"[], CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('saas_option_c8_admin_extra', 'saas_catalog_c8_v1', 'ADMIN_EXTRA', 'Administrateur supplémentaire', 'ADMIN_SEAT', NULL, 'COMPANY_ADMIN', 1200, 14400, ARRAY['STARTER','PRO','BUSINESS']::"SaasPlanCode"[], CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('saas_option_c8_dispatcher_all', 'saas_catalog_c8_v1', 'DISPATCHER_ALL', 'Dispatcher supplémentaire', 'DISPATCHER_SEAT', NULL, 'DISPATCHER', 800, 9600, ARRAY['STARTER','PRO','BUSINESS']::"SaasPlanCode"[], CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
