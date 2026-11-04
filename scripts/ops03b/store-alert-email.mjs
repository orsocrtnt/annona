// Copie les réglages d'e-mail d'alerte de la sonde externe vers le coffre Supabase de la préproduction.
// Base : DATABASE_URL de .env.preproduction.local. Réglages : .env.local (clé Resend, expéditeur,
// destinataire OPS_ALERT_RECIPIENT, sinon EMAIL_TEST_RECIPIENT). N'affiche aucune valeur.
// Usage : sh scripts/ops03b/copy-alert-email.sh (voir docs/operations/ops03b/README.md).
import { readFileSync } from "node:fs";
import { parse } from "dotenv";
import { PrismaClient } from "@prisma/client";

const PREPRODUCTION_REF = "zwwyalsslyydubtetagj";
const read = (file) => {
  try {
    return parse(readFileSync(file));
  } catch {
    return {};
  }
};
const preprod = read(".env.preproduction.local");
const local = read(".env.local");
const url = preprod.DATABASE_URL ?? "";
const values = {
  ops03b_resend_api_key: local.RESEND_API_KEY?.trim() ?? "",
  ops03b_alert_email_from: (local.MAIL_FROM || local.EMAIL_FROM || "").trim(),
  ops03b_alert_email_to: (local.OPS_ALERT_RECIPIENT || local.EMAIL_TEST_RECIPIENT || "").trim(),
};

const report = {
  baseAttendue: url.includes(PREPRODUCTION_REF),
  clePresente: values.ops03b_resend_api_key.length > 0,
  expediteurPresent: values.ops03b_alert_email_from.length > 0,
  destinatairePresent: values.ops03b_alert_email_to.includes("@"),
};

if (!Object.values(report).every(Boolean)) {
  console.log(JSON.stringify({ ...report, stored: false }));
  process.exit(1);
}

const prisma = new PrismaClient({ datasources: { db: { url } } });
try {
  const updated = [];
  for (const [name, value] of Object.entries(values)) {
    const existing = await prisma.$queryRawUnsafe(
      "select id::text as id from vault.secrets where name = $1 limit 1",
      name
    );
    if (existing.length > 0) {
      await prisma.$queryRawUnsafe("select vault.update_secret($1::uuid, $2)::text", existing[0].id, value);
      updated.push(name);
    } else {
      await prisma.$queryRawUnsafe(
        "select vault.create_secret($1, $2, 'Alerte e-mail de la sonde externe (OPS-FIAB)')::text",
        value,
        name
      );
    }
  }
  console.log(JSON.stringify({ ...report, stored: true, updated }));
} finally {
  await prisma.$disconnect();
}
