-- CreateTable
CREATE TABLE "saas_billing_accounts" (
    "id" TEXT NOT NULL,
    "signup_id" TEXT NOT NULL,
    "subscription_id" TEXT,
    "provider_subscription_id" TEXT,
    "provider_customer_id" TEXT,
    "checkout_id" TEXT,
    "state" JSONB NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "pending_operation_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "saas_billing_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saas_billing_operations" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PREPARED',
    "input" JSONB NOT NULL,
    "result" JSONB,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "saas_billing_operations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "saas_billing_accounts_signup_id_key" ON "saas_billing_accounts"("signup_id");

-- CreateIndex
CREATE UNIQUE INDEX "saas_billing_accounts_subscription_id_key" ON "saas_billing_accounts"("subscription_id");

-- CreateIndex
CREATE UNIQUE INDEX "saas_billing_accounts_provider_subscription_id_key" ON "saas_billing_accounts"("provider_subscription_id");

-- CreateIndex
CREATE UNIQUE INDEX "saas_billing_accounts_provider_customer_id_key" ON "saas_billing_accounts"("provider_customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "saas_billing_accounts_checkout_id_key" ON "saas_billing_accounts"("checkout_id");

-- CreateIndex
CREATE INDEX "saas_billing_operations_account_id_created_at_idx" ON "saas_billing_operations"("account_id", "created_at");

-- CreateIndex
CREATE INDEX "saas_billing_operations_status_created_at_idx" ON "saas_billing_operations"("status", "created_at");

-- AddForeignKey
ALTER TABLE "saas_billing_accounts" ADD CONSTRAINT "saas_billing_accounts_signup_id_fkey" FOREIGN KEY ("signup_id") REFERENCES "signup_journeys"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saas_billing_accounts" ADD CONSTRAINT "saas_billing_accounts_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "saas_subscriptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saas_billing_operations" ADD CONSTRAINT "saas_billing_operations_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "saas_billing_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


ALTER TABLE "saas_billing_accounts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "saas_billing_operations" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "saas_billing_accounts", "saas_billing_operations" FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON "saas_billing_accounts", "saas_billing_operations" FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON "saas_billing_accounts", "saas_billing_operations" FROM authenticated;
  END IF;
END $$;
