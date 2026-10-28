-- Commande par message IA : journal minimal d'usage (appels et jetons) servant au quota par entreprise.
-- Aucune colonne ne contient le texte du message, l'expéditeur ni l'utilisateur.
CREATE TYPE "OrderIntakeUsageStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED');

CREATE TABLE "order_intake_usage" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "status" "OrderIntakeUsageStatus" NOT NULL DEFAULT 'PENDING',
    "model" TEXT NOT NULL,
    "input_tokens" INTEGER NOT NULL DEFAULT 0,
    "output_tokens" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_intake_usage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "order_intake_usage_company_id_created_at_idx" ON "order_intake_usage"("company_id", "created_at");

ALTER TABLE "order_intake_usage" ADD CONSTRAINT "order_intake_usage_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Table interne : exclusivement accessible via le serveur Prisma.
ALTER TABLE "order_intake_usage" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE "order_intake_usage" FROM PUBLIC, anon, authenticated;
