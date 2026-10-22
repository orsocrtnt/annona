-- CreateEnum
CREATE TYPE "SaasCatalogStatus" AS ENUM ('DRAFT', 'ACTIVE', 'RETIRED');

-- CreateEnum
CREATE TYPE "SaasPlanCode" AS ENUM ('STARTER', 'PRO', 'BUSINESS');

-- CreateEnum
CREATE TYPE "SaasSubscriptionKind" AS ENUM ('COMMERCIAL', 'PILOT', 'LEGACY');

-- CreateEnum
CREATE TYPE "SaasSubscriptionStatus" AS ENUM ('PENDING_PAYMENT', 'ACTIVE', 'PAST_DUE', 'RESTRICTED', 'READ_ONLY', 'CANCEL_AT_PERIOD_END', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "SaasBillingInterval" AS ENUM ('MONTHLY', 'ANNUAL');

-- CreateEnum
CREATE TYPE "SaasSubscriptionItemKind" AS ENUM ('OPTION', 'DRIVER_SEAT', 'ADMIN_SEAT', 'DISPATCHER_SEAT');

-- CreateEnum
CREATE TYPE "SaasSubscriptionItemSource" AS ENUM ('INITIAL', 'ADDED_LATER');

-- CreateEnum
CREATE TYPE "SaasUsageEventKind" AS ENUM ('ORDER_CREATED', 'ORDER_REVERSED');

-- CreateTable
CREATE TABLE "saas_catalog_versions" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "status" "SaasCatalogStatus" NOT NULL DEFAULT 'DRAFT',
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "vat_rate_bps" INTEGER NOT NULL DEFAULT 2000,
    "effective_at" TIMESTAMP(3) NOT NULL,
    "retired_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "saas_catalog_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saas_plans" (
    "id" TEXT NOT NULL,
    "catalog_version_id" TEXT NOT NULL,
    "code" "SaasPlanCode" NOT NULL,
    "name" TEXT NOT NULL,
    "monthly_price_cents" INTEGER NOT NULL,
    "annual_price_cents" INTEGER NOT NULL,
    "included_driver_seats" INTEGER NOT NULL,
    "unlimited_driver_seats" BOOLEAN NOT NULL DEFAULT false,
    "max_driver_seats" INTEGER,
    "included_admin_seats" INTEGER NOT NULL,
    "max_admin_seats" INTEGER,
    "included_dispatcher_seats" INTEGER NOT NULL,
    "max_dispatcher_seats" INTEGER,
    "included_monthly_orders" INTEGER NOT NULL,
    "order_overage_unit_price_cents" INTEGER NOT NULL,
    "included_features" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "saas_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saas_options" (
    "id" TEXT NOT NULL,
    "catalog_version_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "SaasSubscriptionItemKind" NOT NULL,
    "feature_key" TEXT,
    "seat_role" "SystemRole",
    "monthly_price_cents" INTEGER NOT NULL,
    "annual_price_cents" INTEGER NOT NULL,
    "applicable_plans" "SaasPlanCode"[] DEFAULT ARRAY[]::"SaasPlanCode"[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "saas_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saas_subscriptions" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "catalog_version_id" TEXT,
    "kind" "SaasSubscriptionKind" NOT NULL,
    "status" "SaasSubscriptionStatus" NOT NULL,
    "billing_interval" "SaasBillingInterval",
    "starts_at" TIMESTAMP(3) NOT NULL,
    "current_period_start" TIMESTAMP(3) NOT NULL,
    "current_period_end" TIMESTAMP(3),
    "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT false,
    "ended_at" TIMESTAMP(3),
    "premium_discovery_ends_at" TIMESTAMP(3),
    "provider_customer_id" TEXT,
    "provider_subscription_id" TEXT,
    "snapshot" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "saas_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saas_plan_assignments" (
    "id" TEXT NOT NULL,
    "subscription_id" TEXT NOT NULL,
    "plan_id" TEXT NOT NULL,
    "effective_from" TIMESTAMP(3) NOT NULL,
    "effective_to" TIMESTAMP(3),
    "snapshot" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saas_plan_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saas_subscription_items" (
    "id" TEXT NOT NULL,
    "subscription_id" TEXT NOT NULL,
    "option_id" TEXT,
    "code" TEXT NOT NULL,
    "kind" "SaasSubscriptionItemKind" NOT NULL,
    "source" "SaasSubscriptionItemSource" NOT NULL DEFAULT 'INITIAL',
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unit_price_cents" INTEGER NOT NULL,
    "effective_from" TIMESTAMP(3) NOT NULL,
    "effective_to" TIMESTAMP(3),
    "snapshot" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saas_subscription_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saas_usage_periods" (
    "id" TEXT NOT NULL,
    "subscription_id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3) NOT NULL,
    "included_orders" INTEGER NOT NULL,
    "order_count" INTEGER NOT NULL DEFAULT 0,
    "overage_count" INTEGER NOT NULL DEFAULT 0,
    "order_overage_unit_price_cents" INTEGER NOT NULL,
    "closed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "saas_usage_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saas_usage_events" (
    "id" TEXT NOT NULL,
    "event_key" TEXT NOT NULL,
    "kind" "SaasUsageEventKind" NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "company_id" TEXT NOT NULL,
    "subscription_id" TEXT NOT NULL,
    "usage_period_id" TEXT NOT NULL,
    "order_id" TEXT,
    "reversed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saas_usage_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saas_seat_reservations" (
    "id" TEXT NOT NULL,
    "reservation_key" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "subscription_id" TEXT NOT NULL,
    "role" "SystemRole" NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saas_seat_reservations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "saas_catalog_versions_code_key" ON "saas_catalog_versions"("code");

-- CreateIndex
CREATE INDEX "saas_catalog_versions_status_effective_at_idx" ON "saas_catalog_versions"("status", "effective_at");

-- CreateIndex
CREATE INDEX "saas_plans_code_idx" ON "saas_plans"("code");

-- CreateIndex
CREATE UNIQUE INDEX "saas_plans_catalog_version_id_code_key" ON "saas_plans"("catalog_version_id", "code");

-- CreateIndex
CREATE INDEX "saas_options_kind_idx" ON "saas_options"("kind");

-- CreateIndex
CREATE UNIQUE INDEX "saas_options_catalog_version_id_code_key" ON "saas_options"("catalog_version_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "saas_subscriptions_company_id_key" ON "saas_subscriptions"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "saas_subscriptions_provider_customer_id_key" ON "saas_subscriptions"("provider_customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "saas_subscriptions_provider_subscription_id_key" ON "saas_subscriptions"("provider_subscription_id");

-- CreateIndex
CREATE INDEX "saas_subscriptions_status_idx" ON "saas_subscriptions"("status");

-- CreateIndex
CREATE INDEX "saas_subscriptions_kind_idx" ON "saas_subscriptions"("kind");

-- CreateIndex
CREATE INDEX "saas_plan_assignments_subscription_id_effective_from_idx" ON "saas_plan_assignments"("subscription_id", "effective_from");

-- CreateIndex
CREATE INDEX "saas_plan_assignments_subscription_id_effective_to_idx" ON "saas_plan_assignments"("subscription_id", "effective_to");

-- CreateIndex
CREATE INDEX "saas_subscription_items_subscription_id_effective_from_idx" ON "saas_subscription_items"("subscription_id", "effective_from");

-- CreateIndex
CREATE INDEX "saas_subscription_items_subscription_id_effective_to_idx" ON "saas_subscription_items"("subscription_id", "effective_to");

-- CreateIndex
CREATE INDEX "saas_usage_periods_company_id_starts_at_idx" ON "saas_usage_periods"("company_id", "starts_at");

-- CreateIndex
CREATE UNIQUE INDEX "saas_usage_periods_subscription_id_starts_at_key" ON "saas_usage_periods"("subscription_id", "starts_at");

-- CreateIndex
CREATE UNIQUE INDEX "saas_usage_events_event_key_key" ON "saas_usage_events"("event_key");

-- CreateIndex
CREATE INDEX "saas_usage_events_company_id_created_at_idx" ON "saas_usage_events"("company_id", "created_at");

-- CreateIndex
CREATE INDEX "saas_usage_events_usage_period_id_kind_idx" ON "saas_usage_events"("usage_period_id", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "saas_usage_events_order_id_kind_key" ON "saas_usage_events"("order_id", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "saas_seat_reservations_reservation_key_key" ON "saas_seat_reservations"("reservation_key");

-- CreateIndex
CREATE INDEX "saas_seat_reservations_company_id_role_expires_at_idx" ON "saas_seat_reservations"("company_id", "role", "expires_at");

-- AddForeignKey
ALTER TABLE "saas_plans" ADD CONSTRAINT "saas_plans_catalog_version_id_fkey" FOREIGN KEY ("catalog_version_id") REFERENCES "saas_catalog_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saas_options" ADD CONSTRAINT "saas_options_catalog_version_id_fkey" FOREIGN KEY ("catalog_version_id") REFERENCES "saas_catalog_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saas_subscriptions" ADD CONSTRAINT "saas_subscriptions_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saas_subscriptions" ADD CONSTRAINT "saas_subscriptions_catalog_version_id_fkey" FOREIGN KEY ("catalog_version_id") REFERENCES "saas_catalog_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saas_plan_assignments" ADD CONSTRAINT "saas_plan_assignments_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "saas_subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saas_plan_assignments" ADD CONSTRAINT "saas_plan_assignments_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "saas_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saas_subscription_items" ADD CONSTRAINT "saas_subscription_items_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "saas_subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saas_subscription_items" ADD CONSTRAINT "saas_subscription_items_option_id_fkey" FOREIGN KEY ("option_id") REFERENCES "saas_options"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saas_usage_periods" ADD CONSTRAINT "saas_usage_periods_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "saas_subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saas_usage_periods" ADD CONSTRAINT "saas_usage_periods_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saas_usage_events" ADD CONSTRAINT "saas_usage_events_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saas_usage_events" ADD CONSTRAINT "saas_usage_events_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "saas_subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saas_usage_events" ADD CONSTRAINT "saas_usage_events_usage_period_id_fkey" FOREIGN KEY ("usage_period_id") REFERENCES "saas_usage_periods"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saas_usage_events" ADD CONSTRAINT "saas_usage_events_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saas_seat_reservations" ADD CONSTRAINT "saas_seat_reservations_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saas_seat_reservations" ADD CONSTRAINT "saas_seat_reservations_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "saas_subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Domain guards: prices, quotas and quantities never become negative or incoherent.
ALTER TABLE "saas_catalog_versions"
  ADD CONSTRAINT "saas_catalog_versions_vat_rate_bps_check" CHECK ("vat_rate_bps" >= 0 AND "vat_rate_bps" <= 10000);
ALTER TABLE "saas_plans"
  ADD CONSTRAINT "saas_plans_prices_check" CHECK ("monthly_price_cents" >= 0 AND "annual_price_cents" >= 0),
  ADD CONSTRAINT "saas_plans_driver_limits_check" CHECK ("included_driver_seats" >= 0 AND ("max_driver_seats" IS NULL OR "max_driver_seats" >= "included_driver_seats")),
  ADD CONSTRAINT "saas_plans_admin_limits_check" CHECK ("included_admin_seats" >= 0 AND ("max_admin_seats" IS NULL OR "max_admin_seats" >= "included_admin_seats")),
  ADD CONSTRAINT "saas_plans_dispatcher_limits_check" CHECK ("included_dispatcher_seats" >= 0 AND ("max_dispatcher_seats" IS NULL OR "max_dispatcher_seats" >= "included_dispatcher_seats")),
  ADD CONSTRAINT "saas_plans_order_limits_check" CHECK ("included_monthly_orders" >= 0 AND "order_overage_unit_price_cents" >= 0);
ALTER TABLE "saas_options"
  ADD CONSTRAINT "saas_options_prices_check" CHECK ("monthly_price_cents" >= 0 AND "annual_price_cents" >= 0);
ALTER TABLE "saas_subscription_items"
  ADD CONSTRAINT "saas_subscription_items_quantity_check" CHECK ("quantity" > 0 AND "unit_price_cents" >= 0),
  ADD CONSTRAINT "saas_subscription_items_dates_check" CHECK ("effective_to" IS NULL OR "effective_to" > "effective_from");
ALTER TABLE "saas_plan_assignments"
  ADD CONSTRAINT "saas_plan_assignments_dates_check" CHECK ("effective_to" IS NULL OR "effective_to" > "effective_from");
ALTER TABLE "saas_usage_periods"
  ADD CONSTRAINT "saas_usage_periods_dates_check" CHECK ("ends_at" > "starts_at"),
  ADD CONSTRAINT "saas_usage_periods_counts_check" CHECK ("included_orders" >= 0 AND "order_count" >= 0 AND "overage_count" >= 0 AND "order_overage_unit_price_cents" >= 0);
ALTER TABLE "saas_usage_events"
  ADD CONSTRAINT "saas_usage_events_quantity_check" CHECK ("quantity" > 0);

CREATE UNIQUE INDEX "saas_plan_assignments_one_current_key"
  ON "saas_plan_assignments"("subscription_id") WHERE "effective_to" IS NULL;
CREATE UNIQUE INDEX "saas_subscription_items_one_current_code_key"
  ON "saas_subscription_items"("subscription_id", "code") WHERE "effective_to" IS NULL;

-- Catalogue C7 v1, versionné et réutilisable par le paiement fictif puis Stripe.
INSERT INTO "saas_catalog_versions" (
  "id", "code", "status", "currency", "vat_rate_bps", "effective_at", "created_at", "updated_at"
) VALUES (
  'saas_catalog_c7_v1', 'C7-2026-10-21', 'ACTIVE', 'EUR', 2000,
  TIMESTAMP '2026-10-21 00:00:00', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
);

INSERT INTO "saas_plans" (
  "id", "catalog_version_id", "code", "name", "monthly_price_cents", "annual_price_cents",
  "included_driver_seats", "unlimited_driver_seats", "max_driver_seats", "included_admin_seats", "max_admin_seats",
  "included_dispatcher_seats", "max_dispatcher_seats", "included_monthly_orders",
  "order_overage_unit_price_cents", "included_features", "created_at", "updated_at"
) VALUES
  ('saas_plan_c7_starter', 'saas_catalog_c7_v1', 'STARTER', 'Starter', 7900, 79000, 5, false, 10, 1, 1, 0, NULL, 1000, 10, ARRAY[]::TEXT[], CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('saas_plan_c7_pro', 'saas_catalog_c7_v1', 'PRO', 'Pro', 17900, 179000, 10, false, 30, 1, 1, 1, NULL, 3000, 8, ARRAY['auto_dispatch','admin_gps']::TEXT[], CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('saas_plan_c7_business', 'saas_catalog_c7_v1', 'BUSINESS', 'Business', 34900, 349000, 0, true, NULL, 2, NULL, 1, NULL, 6000, 6, ARRAY['auto_dispatch','admin_gps','client_gps','advanced_analytics','priority_support']::TEXT[], CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT INTO "saas_options" (
  "id", "catalog_version_id", "code", "name", "kind", "feature_key", "seat_role",
  "monthly_price_cents", "annual_price_cents", "applicable_plans", "created_at", "updated_at"
) VALUES
  ('saas_option_auto_dispatch', 'saas_catalog_c7_v1', 'AUTO_DISPATCH', 'Dispatch automatique', 'OPTION', 'auto_dispatch', NULL, 4900, 58800, ARRAY['STARTER']::"SaasPlanCode"[], CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('saas_option_admin_gps', 'saas_catalog_c7_v1', 'ADMIN_GPS', 'Carte GPS administrateur', 'OPTION', 'admin_gps', NULL, 3900, 46800, ARRAY['STARTER']::"SaasPlanCode"[], CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('saas_option_client_gps', 'saas_catalog_c7_v1', 'CLIENT_GPS', 'Carte GPS client', 'OPTION', 'client_gps', NULL, 4900, 58800, ARRAY['STARTER','PRO']::"SaasPlanCode"[], CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('saas_option_advanced_analytics', 'saas_catalog_c7_v1', 'ADVANCED_ANALYTICS', 'Analytics avancés', 'OPTION', 'advanced_analytics', NULL, 2900, 34800, ARRAY['STARTER','PRO']::"SaasPlanCode"[], CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('saas_option_priority_support', 'saas_catalog_c7_v1', 'PRIORITY_SUPPORT', 'Support prioritaire', 'OPTION', 'priority_support', NULL, 2900, 34800, ARRAY['STARTER','PRO']::"SaasPlanCode"[], CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('saas_option_driver_starter', 'saas_catalog_c7_v1', 'DRIVER_STARTER', 'Livreur supplémentaire Starter', 'DRIVER_SEAT', NULL, 'DRIVER', 1200, 14400, ARRAY['STARTER']::"SaasPlanCode"[], CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('saas_option_driver_pro', 'saas_catalog_c7_v1', 'DRIVER_PRO', 'Livreur supplémentaire Pro', 'DRIVER_SEAT', NULL, 'DRIVER', 1000, 12000, ARRAY['PRO']::"SaasPlanCode"[], CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('saas_option_admin_business', 'saas_catalog_c7_v1', 'ADMIN_BUSINESS', 'Administrateur supplémentaire Business', 'ADMIN_SEAT', NULL, 'COMPANY_ADMIN', 1200, 14400, ARRAY['BUSINESS']::"SaasPlanCode"[], CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('saas_option_dispatcher_all', 'saas_catalog_c7_v1', 'DISPATCHER_ALL', 'Dispatcher supplémentaire', 'DISPATCHER_SEAT', NULL, 'DISPATCHER', 800, 9600, ARRAY['STARTER','PRO','BUSINESS']::"SaasPlanCode"[], CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- Les entreprises existantes restent utilisables sans leur inventer un abonnement payant.
-- Leur état LEGACY explicite est illimité et auditable jusqu'à migration manuelle vers un pilote ou une offre.
INSERT INTO "saas_subscriptions" (
  "id", "company_id", "kind", "status", "starts_at", "current_period_start", "current_period_end",
  "snapshot", "created_at", "updated_at"
)
SELECT
  'saas_legacy_' || md5(c."id"), c."id", 'LEGACY', 'ACTIVE', c."created_at",
  date_trunc('month', CURRENT_TIMESTAMP), date_trunc('month', CURRENT_TIMESTAMP) + INTERVAL '1 month',
  jsonb_build_object(
    'schemaVersion', 1,
    'mode', 'LEGACY',
    'reason', 'Migration SAAS-01A sans activation payante',
    'limits', jsonb_build_object('drivers', NULL, 'admins', NULL, 'dispatchers', NULL, 'monthlyOrders', 2147483647),
    'features', jsonb_build_array('auto_dispatch','admin_gps','client_gps','advanced_analytics','priority_support')
  ),
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "companies" c
ON CONFLICT ("company_id") DO NOTHING;

-- Les données de souscription restent accessibles uniquement par le serveur privilégié.
ALTER TABLE "saas_catalog_versions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "saas_plans" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "saas_options" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "saas_subscriptions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "saas_plan_assignments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "saas_subscription_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "saas_usage_periods" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "saas_usage_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "saas_seat_reservations" ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE "saas_catalog_versions" FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE "saas_plans" FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE "saas_options" FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE "saas_subscriptions" FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE "saas_plan_assignments" FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE "saas_subscription_items" FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE "saas_usage_periods" FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE "saas_usage_events" FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE "saas_seat_reservations" FROM PUBLIC, anon, authenticated;

