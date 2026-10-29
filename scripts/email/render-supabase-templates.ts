/**
 * Génère les modèles Supabase Auth (Authentication → Emails) à la DA TutelLiv, ainsi que des
 * aperçus locaux non versionnés des e-mails métier.
 *   npx tsx scripts/email/render-supabase-templates.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { renderSupabaseAuthTemplate, renderTextEmailHtml } from "../../src/lib/email/email-template";

const templatesDir = join("docs", "operations", "email", "supabase");
const previewDir = join("outputs", "email", "preview");
mkdirSync(templatesDir, { recursive: true });
mkdirSync(previewDir, { recursive: true });

for (const type of ["signup", "invite", "recovery"] as const) {
  const { subject, html } = renderSupabaseAuthTemplate(type);
  writeFileSync(join(templatesDir, `${type}.html`), html + "\n");
  writeFileSync(
    join(previewDir, `auth-${type}.html`),
    html.replaceAll("{{ .SiteURL }}", "https://tutelliv.example").replaceAll("{{ .TokenHash }}", "exemple")
  );
  console.log(`${type}: « ${subject} »`);
}

const samples = {
  livraison: {
    subject: "Livraison effectuée",
    text: "Votre livraison CMD-2026-0042 a été livrée.\nPreuve de livraison (signature, photo, PDF) : https://tutelliv.example/portal/deliveries/exemple",
  },
  bienvenue: {
    subject: "Bienvenue sur TutelLiv",
    text: "Bonjour Camille,\n\nVotre espace Transports Exemple est prêt avec l’offre STARTER (mensuel).\nConnectez-vous puis suivez l’assistant pour ajouter vos livreurs, vos clients et créer votre première livraison.\n\nL’équipe TutelLiv",
  },
};
for (const [name, sample] of Object.entries(samples)) {
  writeFileSync(join(previewDir, `${name}.html`), renderTextEmailHtml({ ...sample, testRecipient: name === "livraison" ? "client@exemple.test" : undefined }));
}
console.log(`Modèles : ${templatesDir} · aperçus locaux : ${previewDir}`);
