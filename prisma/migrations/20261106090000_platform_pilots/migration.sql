-- ADMIN-ESPACE, lot 4 (6 novembre 2026) : suivi des pilotes accompagnés par le super-administrateur.
-- Ajouts seulement : un type, deux tables, leurs index et clés étrangères. Aucune ligne existante n'est modifiée.
-- Étapes alignées sur docs/operations/pilot1/README.md. L'entreprise liée est facultative (SET NULL si supprimée),
-- les notes disparaissent avec leur pilote (CASCADE), l'auteur supprimé laisse la note sans auteur (SET NULL).

-- CreateEnum
CREATE TYPE "PilotStage" AS ENUM ('PREPARATION', 'ACTIVATION', 'FIRST_VALUE', 'REPRESENTATIVE_USE', 'CONSOLIDATION', 'CONTINUED', 'STOPPED');

-- CreateTable
CREATE TABLE "platform_pilots" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "company_id" TEXT,
    "contact_name" TEXT,
    "contact_email" TEXT,
    "contact_phone" TEXT,
    "stage" "PilotStage" NOT NULL DEFAULT 'PREPARATION',
    "stage_changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "start_date" DATE,
    "planned_end_date" DATE,
    "end_date" DATE,
    "first_delivery_date" DATE,
    "created_by_id" TEXT,
    "updated_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_pilots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_pilot_notes" (
    "id" TEXT NOT NULL,
    "pilot_id" TEXT NOT NULL,
    "author_id" TEXT,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_pilot_notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "platform_pilots_company_id_idx" ON "platform_pilots"("company_id");

-- CreateIndex
CREATE INDEX "platform_pilots_stage_idx" ON "platform_pilots"("stage");

-- CreateIndex
CREATE INDEX "platform_pilots_created_by_id_idx" ON "platform_pilots"("created_by_id");

-- CreateIndex
CREATE INDEX "platform_pilots_updated_by_id_idx" ON "platform_pilots"("updated_by_id");

-- CreateIndex
CREATE INDEX "platform_pilot_notes_pilot_id_created_at_idx" ON "platform_pilot_notes"("pilot_id", "created_at");

-- CreateIndex
CREATE INDEX "platform_pilot_notes_author_id_idx" ON "platform_pilot_notes"("author_id");

-- AddForeignKey
ALTER TABLE "platform_pilots" ADD CONSTRAINT "platform_pilots_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_pilots" ADD CONSTRAINT "platform_pilots_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_pilots" ADD CONSTRAINT "platform_pilots_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_pilot_notes" ADD CONSTRAINT "platform_pilot_notes_pilot_id_fkey" FOREIGN KEY ("pilot_id") REFERENCES "platform_pilots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_pilot_notes" ADD CONSTRAINT "platform_pilot_notes_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Tables lues et écrites par le serveur seulement (Prisma), jamais par l'API Supabase.
ALTER TABLE "platform_pilots" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "platform_pilot_notes" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE "platform_pilots", "platform_pilot_notes" FROM PUBLIC, anon, authenticated;
