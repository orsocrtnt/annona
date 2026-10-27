-- GROWTH-1 / décision C10 : messages du formulaire Contact, lus par le super-administrateur.
ALTER TYPE "PlatformAccessResource" ADD VALUE 'CONTACT_MESSAGES';

CREATE TABLE "contact_messages" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "company" TEXT,
    "phone" TEXT,
    "message" TEXT NOT NULL,
    "source_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contact_messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "contact_messages_created_at_idx" ON "contact_messages"("created_at");

CREATE INDEX "contact_messages_source_hash_created_at_idx" ON "contact_messages"("source_hash", "created_at");

-- Table interne : exclusivement accessible via le serveur Prisma.
ALTER TABLE "contact_messages" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE "contact_messages" FROM PUBLIC, anon, authenticated;
