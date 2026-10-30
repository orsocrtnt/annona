-- Commande et suivi sans connexion, e-mails de commande reçus (brouillon à valider).
ALTER TYPE "OrderSource" ADD VALUE 'PUBLIC_LINK';
ALTER TYPE "OperationJobType" ADD VALUE 'INBOUND_EMAIL';
CREATE TYPE "InboundEmailStatus" AS ENUM ('RECEIVED', 'ANALYZED', 'ANALYSIS_FAILED', 'CONVERTED', 'DISMISSED');

CREATE TABLE "company_intake_channels" (
    "company_id" TEXT NOT NULL,
    "order_link_token" TEXT,
    "order_link_enabled" BOOLEAN NOT NULL DEFAULT false,
    "inbound_email_token" TEXT,
    "inbound_email_enabled" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_intake_channels_pkey" PRIMARY KEY ("company_id")
);
CREATE UNIQUE INDEX "company_intake_channels_order_link_token_key" ON "company_intake_channels"("order_link_token");
CREATE UNIQUE INDEX "company_intake_channels_inbound_email_token_key" ON "company_intake_channels"("inbound_email_token");
ALTER TABLE "company_intake_channels" ADD CONSTRAINT "company_intake_channels_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "order_tracking_links" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "guest_email" TEXT,
    "source_hash" TEXT,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_tracking_links_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "order_tracking_links_token_key" ON "order_tracking_links"("token");
CREATE UNIQUE INDEX "order_tracking_links_order_id_key" ON "order_tracking_links"("order_id");
CREATE INDEX "order_tracking_links_company_id_created_at_idx" ON "order_tracking_links"("company_id", "created_at");
CREATE INDEX "order_tracking_links_source_hash_created_at_idx" ON "order_tracking_links"("source_hash", "created_at");
ALTER TABLE "order_tracking_links" ADD CONSTRAINT "order_tracking_links_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "order_tracking_links" ADD CONSTRAINT "order_tracking_links_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "inbound_order_emails" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "provider_email_id" TEXT NOT NULL,
    "from_address" TEXT NOT NULL,
    "subject" TEXT NOT NULL DEFAULT '',
    "body_text" TEXT NOT NULL DEFAULT '',
    "attachment_count" INTEGER NOT NULL DEFAULT 0,
    "status" "InboundEmailStatus" NOT NULL DEFAULT 'RECEIVED',
    "draft" JSONB,
    "analysis_error" TEXT,
    "order_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inbound_order_emails_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "inbound_order_emails_provider_email_id_key" ON "inbound_order_emails"("provider_email_id");
CREATE INDEX "inbound_order_emails_company_id_status_created_at_idx" ON "inbound_order_emails"("company_id", "status", "created_at");
CREATE INDEX "inbound_order_emails_created_at_idx" ON "inbound_order_emails"("created_at");
ALTER TABLE "inbound_order_emails" ADD CONSTRAINT "inbound_order_emails_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Tables internes : exclusivement accessibles via le serveur Prisma.
ALTER TABLE "company_intake_channels" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE "company_intake_channels" FROM PUBLIC, anon, authenticated;
ALTER TABLE "order_tracking_links" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE "order_tracking_links" FROM PUBLIC, anon, authenticated;
ALTER TABLE "inbound_order_emails" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE "inbound_order_emails" FROM PUBLIC, anon, authenticated;
