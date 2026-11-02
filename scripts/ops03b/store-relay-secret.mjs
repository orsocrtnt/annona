// Copie CRON_SECRET vers le coffre Supabase de la préproduction, pour le relais pg_cron.
// N'affiche aucune valeur. Refuse toute autre base que la préproduction.
// Usage : voir docs/OPERATIONS.md, section « Relais des tâches de fond ».
import { PrismaClient } from "@prisma/client";

const PREPRODUCTION_REF = "zwwyalsslyydubtetagj";
const url = process.env.DATABASE_URL ?? "";
const secret = process.env.CRON_SECRET ?? "";

const report = {
  baseAttendue: url.includes(PREPRODUCTION_REF),
  cronSecretPresent: secret.length > 0,
  emailMode: process.env.EMAIL_DELIVERY_MODE ?? null,
  emailRecetteConfiguree: Boolean(process.env.EMAIL_TEST_RECIPIENT?.trim()),
  fournisseurConfigure: Boolean(process.env.RESEND_API_KEY?.trim()),
  expediteurConfigure: Boolean((process.env.MAIL_FROM || process.env.EMAIL_FROM)?.trim()),
};

if (!report.baseAttendue || !report.cronSecretPresent) {
  console.log(JSON.stringify({ ...report, stored: false }));
  process.exit(1);
}

const prisma = new PrismaClient({ datasources: { db: { url } } });
try {
  const existing = await prisma.$queryRawUnsafe(
    "select id::text as id from vault.secrets where name = 'relay_cron_secret' limit 1"
  );
  if (existing.length > 0) {
    await prisma.$queryRawUnsafe("select vault.update_secret($1::uuid, $2)::text", existing[0].id, secret);
  } else {
    await prisma.$queryRawUnsafe(
      "select vault.create_secret($1, 'relay_cron_secret', 'CRON_SECRET de la préproduction, pour le relais pg_cron')::text",
      secret
    );
  }
  console.log(JSON.stringify({ ...report, stored: true, updated: existing.length > 0 }));
} finally {
  await prisma.$disconnect();
}
