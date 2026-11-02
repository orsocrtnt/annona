-- AUDIT-0111, C2 : numéros de facture en suite continue, par entreprise.
CREATE TABLE "invoice_counters" (
    "company_id" TEXT NOT NULL,
    "last_number" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoice_counters_pkey" PRIMARY KEY ("company_id")
);

ALTER TABLE "invoice_counters" ADD CONSTRAINT "invoice_counters_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Deux entreprises ont chacune leur facture numéro 1 : la référence est unique par entreprise.
DROP INDEX "invoices_reference_key";
CREATE UNIQUE INDEX "invoices_company_id_reference_key" ON "invoices"("company_id", "reference");

ALTER TABLE "invoice_counters" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE "invoice_counters" FROM PUBLIC, anon, authenticated;
