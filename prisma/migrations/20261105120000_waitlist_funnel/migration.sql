-- ADMIN-ESPACE, lot 2 (5 novembre 2026) : page Liste d'attente et entonnoir de /tarifs.
-- Ajouts seulement : trois colonnes facultatives sur les messages Contact, un type et une table de
-- compteurs. Aucune ligne existante n'est modifiée.

-- Suivi des inscriptions : case « contacté » (date et auteur) et campagne d'origine.
ALTER TABLE "contact_messages" ADD COLUMN IF NOT EXISTS "contacted_at" TIMESTAMP(3);
ALTER TABLE "contact_messages" ADD COLUMN IF NOT EXISTS "contacted_by_id" TEXT;
ALTER TABLE "contact_messages" ADD COLUMN IF NOT EXISTS "campaign_code" TEXT;
CREATE INDEX IF NOT EXISTS "contact_messages_contacted_by_id_idx" ON "contact_messages"("contacted_by_id");
DO $$ BEGIN
  ALTER TABLE "contact_messages" ADD CONSTRAINT "contact_messages_contacted_by_id_fkey" FOREIGN KEY ("contacted_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Entonnoir visites → clics → inscriptions : un compteur par jour (Paris), campagne et étape.
-- Ni cookie, ni adresse IP, ni identifiant de visiteur, ni heure précise.
DO $$ BEGIN
  CREATE TYPE "WaitlistFunnelEvent" AS ENUM ('VISIT', 'CLICK', 'SIGNUP');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE "waitlist_funnel_daily" (
    "day" DATE NOT NULL,
    "campaign_code" TEXT NOT NULL,
    "event" "WaitlistFunnelEvent" NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "waitlist_funnel_daily_pkey" PRIMARY KEY ("day","campaign_code","event")
);

-- Table lue et écrite par le serveur seulement (Prisma), jamais par l'API Supabase.
ALTER TABLE "waitlist_funnel_daily" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE "waitlist_funnel_daily" FROM PUBLIC, anon, authenticated;
