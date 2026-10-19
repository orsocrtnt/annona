-- OPS-02B — évolution additive appliquée uniquement à la base de test autorisée.
-- Idempotence des commandes et file durable dispatch/notifications.
BEGIN;
SET LOCAL lock_timeout = '5s';

ALTER TABLE public."orders"
  ADD COLUMN IF NOT EXISTS "idempotency_key" TEXT,
  ADD COLUMN IF NOT EXISTS "request_fingerprint" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "orders_customer_id_idempotency_key_key"
  ON public."orders" ("customer_id", "idempotency_key");

DO $$
BEGIN
  CREATE TYPE public."OperationJobType" AS ENUM ('AUTO_DISPATCH', 'CLIENT_NOTIFICATION');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE public."OperationJobStatus" AS ENUM ('PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public."operation_jobs" (
  "id" TEXT NOT NULL,
  "job_key" TEXT NOT NULL,
  "type" public."OperationJobType" NOT NULL,
  "status" public."OperationJobStatus" NOT NULL DEFAULT 'PENDING',
  "payload" JSONB NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "max_attempts" INTEGER NOT NULL DEFAULT 3,
  "next_attempt_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "locked_at" TIMESTAMP(3),
  "last_error" TEXT,
  "completed_at" TIMESTAMP(3),
  "company_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "operation_jobs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "operation_jobs_job_key_key" UNIQUE ("job_key"),
  CONSTRAINT "operation_jobs_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES public."companies"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "operation_jobs_attempts_check"
    CHECK ("attempts" >= 0 AND "max_attempts" BETWEEN 1 AND 10)
);

CREATE INDEX IF NOT EXISTS "operation_jobs_status_next_attempt_at_idx"
  ON public."operation_jobs" ("status", "next_attempt_at");
CREATE INDEX IF NOT EXISTS "operation_jobs_company_id_status_idx"
  ON public."operation_jobs" ("company_id", "status");

ALTER TABLE public."operation_jobs" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public."operation_jobs" FROM anon, authenticated, PUBLIC;

COMMIT;
