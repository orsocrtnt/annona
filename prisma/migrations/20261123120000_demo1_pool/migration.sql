-- DEMO-1 : environnements de démo prêtés aux visiteurs (une boulangerie fictive par environnement).
CREATE TYPE "DemoPoolState" AS ENUM ('READY', 'PREPARING', 'LEASED');

CREATE TABLE "demo_pool_environments" (
    "id" TEXT NOT NULL,
    "slot" INTEGER NOT NULL,
    "company_id" TEXT NOT NULL,
    "state" "DemoPoolState" NOT NULL DEFAULT 'PREPARING',
    "lease_key_hash" TEXT,
    "leased_at" TIMESTAMP(3),
    "lease_expires_at" TIMESTAMP(3),
    "prepared_at" TIMESTAMP(3),
    "last_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "demo_pool_environments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "demo_pool_environments_slot_key" ON "demo_pool_environments"("slot");
CREATE UNIQUE INDEX "demo_pool_environments_company_id_key" ON "demo_pool_environments"("company_id");
CREATE UNIQUE INDEX "demo_pool_environments_lease_key_hash_key" ON "demo_pool_environments"("lease_key_hash");
CREATE INDEX "demo_pool_environments_state_lease_expires_at_idx" ON "demo_pool_environments"("state", "lease_expires_at");

-- Pas de clé étrangère vers "companies" : la reconstruction d'un environnement efface puis réécrit son entreprise.

-- Table de coordination réservée au serveur : aucun accès par l'API publique de Supabase.
ALTER TABLE "demo_pool_environments" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE "demo_pool_environments" FROM PUBLIC;
REVOKE ALL PRIVILEGES ON TABLE "demo_pool_environments" FROM anon;
REVOKE ALL PRIVILEGES ON TABLE "demo_pool_environments" FROM authenticated;
