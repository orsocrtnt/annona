-- MAIL-PONT, étape 4 : fiche client sans accès, propre à chaque entreprise (option B du 3 novembre 2026).
-- Ajouts seulement : nouvelle table et colonne facultative sur les commandes, sans effet sur les lignes existantes.
CREATE TABLE "company_customers" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "company_customers_pkey" PRIMARY KEY ("id")
);

-- Table lue et écrite par le serveur seulement (Prisma), jamais par l'API Supabase.
ALTER TABLE "company_customers" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE "company_customers" FROM PUBLIC, anon, authenticated;

CREATE UNIQUE INDEX IF NOT EXISTS "company_customers_company_id_email_key" ON "company_customers"("company_id", "email");
CREATE INDEX IF NOT EXISTS "company_customers_company_id_created_at_idx" ON "company_customers"("company_id", "created_at");
CREATE INDEX IF NOT EXISTS "company_customers_user_id_idx" ON "company_customers"("user_id");

DO $$ BEGIN
  ALTER TABLE "company_customers" ADD CONSTRAINT "company_customers_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "company_customers" ADD CONSTRAINT "company_customers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "company_customer_id" TEXT;
CREATE INDEX IF NOT EXISTS "orders_company_customer_id_idx" ON "orders"("company_customer_id");
DO $$ BEGIN
  ALTER TABLE "orders" ADD CONSTRAINT "orders_company_customer_id_fkey" FOREIGN KEY ("company_customer_id") REFERENCES "company_customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
