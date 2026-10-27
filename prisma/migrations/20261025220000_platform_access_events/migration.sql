CREATE TYPE "PlatformAccessDecision" AS ENUM ('ALLOWED', 'DENIED');

CREATE TYPE "PlatformAccessResource" AS ENUM ('OVERVIEW', 'SAAS_HEALTH', 'SERVICE_HEALTH', 'COMPANIES', 'COMPANY_DETAIL', 'USERS', 'SUBSCRIPTIONS', 'SUPPORT_TICKETS', 'OPERATION_JOBS', 'INCIDENTS', 'ACCESS_EVENTS');

CREATE TABLE "platform_access_events" (
    "id" TEXT NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "actor_id" TEXT NOT NULL,
    "role" "SystemRole" NOT NULL,
    "method" TEXT NOT NULL,
    "resource" "PlatformAccessResource" NOT NULL,
    "decision" "PlatformAccessDecision" NOT NULL,

    CONSTRAINT "platform_access_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "platform_access_events_occurred_at_idx" ON "platform_access_events"("occurred_at");

CREATE INDEX "platform_access_events_expires_at_idx" ON "platform_access_events"("expires_at");

CREATE INDEX "platform_access_events_actor_id_idx" ON "platform_access_events"("actor_id");

-- Table interne : exclusivement accessible via le serveur Prisma.
ALTER TABLE "platform_access_events" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE "platform_access_events" FROM PUBLIC, anon, authenticated;
