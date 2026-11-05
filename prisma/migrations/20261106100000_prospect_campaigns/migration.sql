-- ADMIN-ESPACE, lot 5 (5 novembre 2026) : campagnes de mails de prospection et leur suivi.
-- Ajouts seulement : deux valeurs d'énumération, deux types, trois tables. Aucune ligne existante n'est modifiée.

-- Clics comptés depuis les mails (/go/<code>/rejoindre et /go/<code>/site), dans les compteurs existants.
ALTER TYPE "WaitlistFunnelEvent" ADD VALUE IF NOT EXISTS 'MAIL_JOIN';
ALTER TYPE "WaitlistFunnelEvent" ADD VALUE IF NOT EXISTS 'MAIL_SITE';

-- Journal d'accès plateforme : nouvelle ressource.
ALTER TYPE "PlatformAccessResource" ADD VALUE IF NOT EXISTS 'PROSPECT_CAMPAIGNS';

DO $$ BEGIN
  CREATE TYPE "ProspectRecipientStatus" AS ENUM ('PENDING', 'SENDING', 'SENT', 'FAILED', 'SKIPPED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE "prospect_campaigns" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "address_source" TEXT NOT NULL,
    "replies_count" INTEGER NOT NULL DEFAULT 0,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prospect_campaigns_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "prospect_campaigns_code_key" ON "prospect_campaigns"("code");
CREATE INDEX "prospect_campaigns_created_by_id_idx" ON "prospect_campaigns"("created_by_id");
ALTER TABLE "prospect_campaigns" ADD CONSTRAINT "prospect_campaigns_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "prospect_campaign_recipients" (
    "id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "status" "ProspectRecipientStatus" NOT NULL DEFAULT 'PENDING',
    "detail" TEXT,
    "sent_at" TIMESTAMP(3),
    "claimed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prospect_campaign_recipients_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "prospect_campaign_recipients_campaign_id_email_key" ON "prospect_campaign_recipients"("campaign_id", "email");
CREATE INDEX "prospect_campaign_recipients_campaign_id_status_created_at_idx" ON "prospect_campaign_recipients"("campaign_id", "status", "created_at");
CREATE INDEX "prospect_campaign_recipients_email_idx" ON "prospect_campaign_recipients"("email");
ALTER TABLE "prospect_campaign_recipients" ADD CONSTRAINT "prospect_campaign_recipients_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "prospect_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "prospect_opt_outs" (
    "email" TEXT NOT NULL,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prospect_opt_outs_pkey" PRIMARY KEY ("email")
);
CREATE INDEX "prospect_opt_outs_created_by_id_idx" ON "prospect_opt_outs"("created_by_id");
ALTER TABLE "prospect_opt_outs" ADD CONSTRAINT "prospect_opt_outs_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Tables lues et écrites par le serveur seulement (Prisma), jamais par l'API Supabase.
ALTER TABLE "prospect_campaigns" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "prospect_campaign_recipients" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "prospect_opt_outs" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE "prospect_campaigns" FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE "prospect_campaign_recipients" FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE "prospect_opt_outs" FROM PUBLIC, anon, authenticated;
