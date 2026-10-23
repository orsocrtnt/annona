-- SIGNUP-1 : inscription durable et activation atomique après paiement confirmé.
CREATE TYPE "SignupStatus" AS ENUM (
  'DRAFT', 'EMAIL_PENDING', 'EMAIL_VERIFIED', 'PAYMENT_PENDING',
  'PAYMENT_CONFIRMED', 'ACTIVATED', 'FAILED'
);
CREATE TYPE "SignupPaymentStatus" AS ENUM ('PENDING', 'CONFIRMED', 'DECLINED');

ALTER TABLE "companies"
  ADD COLUMN "legal_name" TEXT,
  ADD COLUMN "siren" TEXT,
  ADD COLUMN "siret" TEXT,
  ADD COLUMN "billing_address" TEXT,
  ADD COLUMN "billing_postal_code" TEXT,
  ADD COLUMN "billing_city" TEXT;

CREATE UNIQUE INDEX "companies_siren_key" ON "companies"("siren");
CREATE UNIQUE INDEX "companies_siret_key" ON "companies"("siret");

CREATE TABLE "signup_journeys" (
  "id" TEXT NOT NULL,
  "resume_token_hash" TEXT NOT NULL,
  "status" "SignupStatus" NOT NULL DEFAULT 'DRAFT',
  "catalog_version_id" TEXT NOT NULL,
  "plan_code" "SaasPlanCode" NOT NULL,
  "billing_interval" "SaasBillingInterval" NOT NULL,
  "option_selections" JSONB NOT NULL DEFAULT '[]',
  "quote_snapshot" JSONB NOT NULL,
  "email" TEXT,
  "auth_user_id" TEXT,
  "first_name" TEXT,
  "last_name" TEXT,
  "company_name" TEXT,
  "legal_name" TEXT,
  "siren" TEXT,
  "siret" TEXT,
  "phone" TEXT,
  "billing_address" TEXT,
  "billing_postal_code" TEXT,
  "billing_city" TEXT,
  "billing_country" TEXT NOT NULL DEFAULT 'FR',
  "email_verified_at" TIMESTAMP(3),
  "payment_confirmed_at" TIMESTAMP(3),
  "activated_at" TIMESTAMP(3),
  "failure_code" TEXT,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "company_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "signup_journeys_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "signup_payment_events" (
  "id" TEXT NOT NULL,
  "event_key" TEXT NOT NULL,
  "signup_id" TEXT NOT NULL,
  "status" "SignupPaymentStatus" NOT NULL,
  "amount_cents" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'EUR',
  "snapshot" JSONB NOT NULL DEFAULT '{}',
  "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "signup_payment_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "signup_journeys_resume_token_hash_key" ON "signup_journeys"("resume_token_hash");
CREATE UNIQUE INDEX "signup_journeys_auth_user_id_key" ON "signup_journeys"("auth_user_id");
CREATE UNIQUE INDEX "signup_journeys_company_id_key" ON "signup_journeys"("company_id");
CREATE INDEX "signup_journeys_email_status_idx" ON "signup_journeys"("email", "status");
CREATE INDEX "signup_journeys_siren_status_idx" ON "signup_journeys"("siren", "status");
CREATE INDEX "signup_journeys_siret_status_idx" ON "signup_journeys"("siret", "status");
CREATE INDEX "signup_journeys_expires_at_idx" ON "signup_journeys"("expires_at");
CREATE UNIQUE INDEX "signup_payment_events_event_key_key" ON "signup_payment_events"("event_key");
CREATE INDEX "signup_payment_events_signup_id_received_at_idx" ON "signup_payment_events"("signup_id", "received_at");

ALTER TABLE "signup_journeys"
  ADD CONSTRAINT "signup_journeys_catalog_version_id_fkey"
  FOREIGN KEY ("catalog_version_id") REFERENCES "saas_catalog_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "signup_journeys_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "signup_payment_events"
  ADD CONSTRAINT "signup_payment_events_signup_id_fkey"
  FOREIGN KEY ("signup_id") REFERENCES "signup_journeys"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Tables internes : exclusivement accessibles via le serveur Prisma.
ALTER TABLE "signup_journeys" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "signup_payment_events" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE "signup_journeys", "signup_payment_events" FROM PUBLIC, anon, authenticated;
