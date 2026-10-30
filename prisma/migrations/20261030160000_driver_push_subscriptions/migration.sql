-- Notifications « Nouvelle mission » au livreur : abonnements par appareil et type de tâche durable.
ALTER TYPE "OperationJobType" ADD VALUE 'DRIVER_NOTIFICATION';

CREATE TABLE "driver_push_subscriptions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "driver_push_subscriptions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "driver_push_subscriptions_endpoint_key" ON "driver_push_subscriptions"("endpoint");
CREATE INDEX "driver_push_subscriptions_user_id_company_id_idx" ON "driver_push_subscriptions"("user_id", "company_id");
CREATE INDEX "driver_push_subscriptions_company_id_idx" ON "driver_push_subscriptions"("company_id");

ALTER TABLE "driver_push_subscriptions" ADD CONSTRAINT "driver_push_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "driver_push_subscriptions" ADD CONSTRAINT "driver_push_subscriptions_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Table interne : exclusivement accessible via le serveur Prisma.
ALTER TABLE "driver_push_subscriptions" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE "driver_push_subscriptions" FROM PUBLIC, anon, authenticated;
