-- DEMO-3 : trace des relances de factures de livraison et type de tâche « facture à la livraison »
-- (additive, aucune donnée existante modifiée).
ALTER TYPE "OperationJobType" ADD VALUE 'DELIVERY_INVOICE';

CREATE TABLE "invoice_reminders" (
    "id" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'EMAIL',
    "result" TEXT NOT NULL,
    "completed_at" TIMESTAMP(3),
    "invoice_id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "sent_by_id" TEXT,
    "operation_job_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoice_reminders_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "invoice_reminders_invoice_id_created_at_idx" ON "invoice_reminders"("invoice_id", "created_at");

CREATE INDEX "invoice_reminders_company_id_created_at_idx" ON "invoice_reminders"("company_id", "created_at");

CREATE INDEX "invoice_reminders_sent_by_id_idx" ON "invoice_reminders"("sent_by_id");

CREATE INDEX "invoice_reminders_operation_job_id_idx" ON "invoice_reminders"("operation_job_id");

ALTER TABLE "invoice_reminders" ADD CONSTRAINT "invoice_reminders_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "invoice_reminders" ADD CONSTRAINT "invoice_reminders_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "invoice_reminders" ADD CONSTRAINT "invoice_reminders_sent_by_id_fkey" FOREIGN KEY ("sent_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "invoice_reminders" ADD CONSTRAINT "invoice_reminders_operation_job_id_fkey" FOREIGN KEY ("operation_job_id") REFERENCES "operation_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Table interne : exclusivement accessible via le serveur Prisma.
ALTER TABLE "invoice_reminders" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE "invoice_reminders" FROM PUBLIC, anon, authenticated;
