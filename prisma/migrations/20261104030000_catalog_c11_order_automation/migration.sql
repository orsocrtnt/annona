-- Catalogue C11 : décision du propriétaire du 4 novembre 2026 (DECISIONS_PRODUIT_COMMERCIALES C15, OFFER-1).
-- Nouvelle option « Réception automatique des commandes » (`order_automation` : e-mails renvoyés, WhatsApp,
-- message collé lu par l'IA) : 29 € HT par mois en Starter (348 € par an, douze mensualités), incluse en Pro
-- et Business. Le reste du catalogue C10 est recopié à l'identique ; C10 reste historisé pour les
-- souscriptions déjà instantanées (nouveaux contrats seulement).
UPDATE saas_catalog_versions SET status = 'RETIRED', retired_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE code = 'C10-2026-10-29' AND status = 'ACTIVE';
INSERT INTO saas_catalog_versions (id, code, status, currency, vat_rate_bps, effective_at, created_at, updated_at)
SELECT 'saas_catalog_c11_v1', 'C11-2026-11-04', 'ACTIVE', currency, vat_rate_bps, TIMESTAMP '2026-11-04 00:00:00', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM saas_catalog_versions WHERE id = 'saas_catalog_c10_v1';
INSERT INTO saas_plans (id, catalog_version_id, code, name, monthly_price_cents, annual_price_cents, included_driver_seats, unlimited_driver_seats, max_driver_seats, included_admin_seats, max_admin_seats, included_dispatcher_seats, max_dispatcher_seats, included_monthly_orders, order_overage_unit_price_cents, included_features, created_at, updated_at)
SELECT 'saas_plan_c11_' || lower(code::text), 'saas_catalog_c11_v1', code, name, monthly_price_cents, annual_price_cents, included_driver_seats, unlimited_driver_seats, max_driver_seats, included_admin_seats, max_admin_seats, included_dispatcher_seats, max_dispatcher_seats, included_monthly_orders, order_overage_unit_price_cents,
  CASE WHEN code IN ('PRO', 'BUSINESS') THEN array_append(included_features, 'order_automation') ELSE included_features END,
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM saas_plans WHERE catalog_version_id = 'saas_catalog_c10_v1';
INSERT INTO saas_options (id, catalog_version_id, code, name, kind, feature_key, seat_role, monthly_price_cents, annual_price_cents, applicable_plans, created_at, updated_at)
SELECT 'saas_option_c11_' || lower(code::text), 'saas_catalog_c11_v1', code, name, kind, feature_key, seat_role, monthly_price_cents, annual_price_cents, applicable_plans, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM saas_options WHERE catalog_version_id = 'saas_catalog_c10_v1';
INSERT INTO saas_options (id, catalog_version_id, code, name, kind, feature_key, seat_role, monthly_price_cents, annual_price_cents, applicable_plans, created_at, updated_at)
SELECT 'saas_option_c11_order_automation', 'saas_catalog_c11_v1', 'ORDER_AUTOMATION', 'Réception automatique des commandes', 'OPTION', 'order_automation', NULL, 2900, 34800, ARRAY['STARTER']::"SaasPlanCode"[], CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE EXISTS (SELECT 1 FROM saas_catalog_versions WHERE id = 'saas_catalog_c11_v1');
-- Pilotes (démonstrations comprises) : un pilote ouvre tout. Seuls les pilotes qui avaient déjà les cinq
-- fonctions reçoivent la sixième ; un pilote aux fonctions restreintes garde exactement ses limites convenues.
UPDATE saas_subscriptions
SET snapshot = jsonb_set(snapshot, '{features}', (snapshot -> 'features') || '["order_automation"]'::jsonb), updated_at = CURRENT_TIMESTAMP
WHERE kind = 'PILOT'
  AND jsonb_typeof(snapshot -> 'features') = 'array'
  AND (snapshot -> 'features') @> '["auto_dispatch","admin_gps","client_gps","advanced_analytics","priority_support"]'::jsonb
  AND NOT (snapshot -> 'features') @> '["order_automation"]'::jsonb;
