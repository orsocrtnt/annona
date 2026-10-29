/**
 * Envoi de recette Resend, toujours en mode test (redirection vers une seule boîte).
 *   npx tsx scripts/email/send-test.ts --confirm [--to delivered@resend.dev]
 * Sans --to : boîte EMAIL_TEST_RECIPIENT de .env.local. Seules cette boîte et les adresses
 * simulées @resend.dev (aucune boîte réelle) sont acceptées. Aucune clé ni adresse n'est affichée.
 */
import { config } from "dotenv";
import { sendTransactionalEmail } from "../../src/lib/email/transactional-email";

config({ path: ".env.local", quiet: true });

const args = process.argv.slice(2);
if (!args.includes("--confirm")) {
  console.error("Refusé : ajouter --confirm pour envoyer les e-mails de recette.");
  process.exit(1);
}
const configured = process.env.EMAIL_TEST_RECIPIENT?.trim().toLowerCase();
const toIndex = args.indexOf("--to");
const recipient = (toIndex >= 0 ? args[toIndex + 1] : configured)?.trim().toLowerCase();
if (!recipient || (recipient !== configured && !/^[a-z0-9+._-]+@resend\.dev$/.test(recipient))) {
  console.error("Refusé : destinataire limité à EMAIL_TEST_RECIPIENT ou à une adresse simulée @resend.dev.");
  process.exit(1);
}

const env = { ...process.env, EMAIL_DELIVERY_MODE: "test", EMAIL_TEST_RECIPIENT: recipient };
const runId = new Date().toISOString();
const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "") ?? "https://tutelliv.fr";
const samples = [
  {
    kind: "bienvenue",
    to: "admin.e2e@exemple.test",
    subject: "Bienvenue sur TutelLiv",
    text: "Bonjour Camille,\n\nVotre espace Transports E2E est prêt avec l’offre STARTER (mensuel).\nConnectez-vous puis suivez l’assistant pour ajouter vos livreurs, vos clients et créer votre première livraison.\n\nL’équipe TutelLiv",
  },
  {
    kind: "livraison",
    to: "client.e2e@exemple.test",
    subject: "Livraison effectuée",
    text: `Votre livraison CMD-E2E-0001 a été livrée.\nPreuve de livraison (signature, photo, PDF) : ${appUrl}/portal/deliveries/e2e`,
  },
  {
    kind: "relance",
    to: "client.e2e@exemple.test",
    subject: "Rappel : facture F-E2E-0001",
    text: `Bonjour,\n\nLa facture F-E2E-0001 de Transports E2E (120,00 €) est échue depuis 5 jours.\nVoir la facture : ${appUrl}/portal/invoices/e2e\n\nL’équipe TutelLiv`,
  },
];

async function main() {
  let failures = 0;
  for (const sample of samples) {
    try {
      const result = await sendTransactionalEmail(
        { ...sample, idempotencyKey: `email-test:${runId}:${sample.kind}`, replayWindowStart: null },
        { env }
      );
      console.log(`${sample.kind}: ${result.status}${"reason" in result ? ` (${result.reason})` : ""}`);
      if (result.status !== "sent") failures++;
    } catch (error) {
      failures++;
      console.log(`${sample.kind}: échec ${error instanceof Error ? error.message : "inconnu"}`);
    }
  }
  process.exitCode = failures ? 1 : 0;
}

void main();
