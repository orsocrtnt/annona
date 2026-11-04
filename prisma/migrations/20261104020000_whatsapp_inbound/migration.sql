-- WHATSAPP-1 (option A) : messages WhatsApp transférés par l'équipe, rangés avec les e-mails reçus.
DO $$ BEGIN
  CREATE TYPE "InboundChannel" AS ENUM ('EMAIL', 'WHATSAPP');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "inbound_order_emails" ADD COLUMN IF NOT EXISTS "channel" "InboundChannel" NOT NULL DEFAULT 'EMAIL';
ALTER TABLE "company_intake_channels" ADD COLUMN IF NOT EXISTS "whatsapp_enabled" BOOLEAN NOT NULL DEFAULT false;
