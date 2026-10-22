-- DEMO-2: stock durable d'environnements fictifs préconstruits.
CREATE TYPE "DemoPoolState" AS ENUM ('PREPARING', 'READY', 'LEASED', 'RECYCLING', 'QUARANTINED');

CREATE TABLE "demo_pool_environments" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "pool_key" TEXT NOT NULL DEFAULT 'public',
    "slot" INTEGER NOT NULL,
    "state" "DemoPoolState" NOT NULL DEFAULT 'PREPARING',
    "lease_key_hash" TEXT,
    "leased_at" TIMESTAMP(3),
    "lease_expires_at" TIMESTAMP(3),
    "recycle_requested_at" TIMESTAMP(3),
    "recycle_started_at" TIMESTAMP(3),
    "recycle_attempts" INTEGER NOT NULL DEFAULT 0,
    "last_failure_code" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "demo_pool_environments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "demo_pool_environments_company_id_key" ON "demo_pool_environments"("company_id");
CREATE UNIQUE INDEX "demo_pool_environments_lease_key_hash_key" ON "demo_pool_environments"("lease_key_hash");
CREATE UNIQUE INDEX "demo_pool_environments_pool_key_slot_key" ON "demo_pool_environments"("pool_key", "slot");
CREATE INDEX "demo_pool_environments_pool_key_state_slot_idx" ON "demo_pool_environments"("pool_key", "state", "slot");
CREATE INDEX "demo_pool_environments_state_lease_expires_at_idx" ON "demo_pool_environments"("state", "lease_expires_at");

ALTER TABLE "demo_pool_environments"
ADD CONSTRAINT "demo_pool_environments_company_id_fkey"
FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
