-- Catalogue C10 : décision du propriétaire du 29 octobre 2026 (DECISIONS_PRODUIT_COMMERCIALES C12, DISPATCH-4).
-- L'option « Dispatch automatique » devient « Dispatch intelligent » : 39 € HT par mois en Starter (au lieu de 29 €),
-- toujours incluse en Pro et Business. Le reste du catalogue C9 est recopié à l'identique ; C9 reste historisé
-- pour les souscriptions déjà instantanées (nouveaux contrats seulement).
UPDATE saas_catalog_versions SET status = 'RETIRED', retired_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE code = 'C9-2026-10-24' AND status = 'ACTIVE';
INSERT INTO saas_catalog_versions (id, code, status, currency, vat_rate_bps, effective_at, created_at, updated_at)
SELECT 'saas_catalog_c10_v1', 'C10-2026-10-29', 'ACTIVE', currency, vat_rate_bps, TIMESTAMP '2026-10-29 00:00:00', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM saas_catalog_versions WHERE id = 'saas_catalog_c9_v1';
INSERT INTO saas_plans (id, catalog_version_id, code, name, monthly_price_cents, annual_price_cents, included_driver_seats, unlimited_driver_seats, max_driver_seats, included_admin_seats, max_admin_seats, included_dispatcher_seats, max_dispatcher_seats, included_monthly_orders, order_overage_unit_price_cents, included_features, created_at, updated_at)
SELECT replace(id, '_c9_', '_c10_'), 'saas_catalog_c10_v1', code, name, monthly_price_cents, annual_price_cents, included_driver_seats, unlimited_driver_seats, max_driver_seats, included_admin_seats, max_admin_seats, included_dispatcher_seats, max_dispatcher_seats, included_monthly_orders, order_overage_unit_price_cents, included_features, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM saas_plans WHERE catalog_version_id = 'saas_catalog_c9_v1';
INSERT INTO saas_options (id, catalog_version_id, code, name, kind, feature_key, seat_role, monthly_price_cents, annual_price_cents, applicable_plans, created_at, updated_at)
SELECT replace(id, '_c9_', '_c10_'), 'saas_catalog_c10_v1', code,
  CASE WHEN code = 'AUTO_DISPATCH' THEN 'Dispatch intelligent' ELSE name END,
  kind, feature_key, seat_role,
  CASE WHEN code = 'AUTO_DISPATCH' THEN 3900 ELSE monthly_price_cents END,
  CASE WHEN code = 'AUTO_DISPATCH' THEN 46800 ELSE annual_price_cents END,
  applicable_plans, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM saas_options WHERE catalog_version_id = 'saas_catalog_c9_v1';
