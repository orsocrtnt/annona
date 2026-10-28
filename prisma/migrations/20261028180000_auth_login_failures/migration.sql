-- SEC-2 : limitation des échecs de connexion par empreinte HMAC d'e-mail et de source.
CREATE TABLE "auth_login_failures" (
    "id" TEXT NOT NULL,
    "key_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_login_failures_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "auth_login_failures_key_hash_created_at_idx" ON "auth_login_failures"("key_hash", "created_at");

CREATE INDEX "auth_login_failures_created_at_idx" ON "auth_login_failures"("created_at");

-- Table interne : exclusivement accessible via le serveur Prisma.
ALTER TABLE "auth_login_failures" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE "auth_login_failures" FROM PUBLIC, anon, authenticated;
