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
  livraison: { subject: "Livraison effectuée", text: "CMD-2026-0042 a été livrée.\nPreuve de livraison (signature, photo, PDF) : https://tutelliv.example/portal/deliveries/exemple" },
  bienvenue: { subject: "Bienvenue sur TutelLiv", text: "Bonjour Camille,\n\nVotre espace Transports Exemple est prêt avec l’offre STARTER (mensuel).\nConnectez-vous puis suivez l’assistant pour ajouter vos livreurs, vos clients et créer votre première livraison.\n\nDécouvrir mon espace : https://tutelliv.example/onboarding\n\nL’équipe TutelLiv" },
  assignation: { subject: "Chauffeur assigné", text: "Un chauffeur a été assigné à CMD-2026-0042.\nConsulter ma livraison : https://tutelliv.example/portal/deliveries/exemple" },
  priseEnCharge: { subject: "Prise en charge", text: "Votre livreur a pris en charge CMD-2026-0042.\nConsulter ma livraison : https://tutelliv.example/portal/deliveries/exemple" },
  courses: { subject: "Courses en cours", text: "Les courses de CMD-2026-0042 ont commencé.\nConsulter ma livraison : https://tutelliv.example/portal/deliveries/exemple" },
  enRoute: { subject: "En cours de livraison", text: "CMD-2026-0042 est en route.\nConsulter ma livraison : https://tutelliv.example/portal/deliveries/exemple" },
  annulation: { subject: "Livraison annulée", text: "CMD-2026-0042 a été annulée.\nConsulter ma livraison : https://tutelliv.example/portal/deliveries/exemple" },
  echec: { subject: "Livraison non effectuée", text: "CMD-2026-0042 n’a pas pu être livrée.\nPreuve de livraison (signature, photo, PDF) : https://tutelliv.example/portal/deliveries/exemple" },
  facture: { subject: "Facture F-2026-0042", text: "La facture F-2026-0042 (148,00 €) est disponible.\nConsulter ma facture : https://tutelliv.example/portal/invoices/exemple" },
  rappel: { subject: "Rappel : facture F-2026-0042", text: "Bonjour,\n\nSauf erreur de notre part, la facture F-2026-0042 de Transports Exemple, d'un montant de 148,00 €, échue le 27 octobre 2026, reste à régler (en retard de 3 jours).\n\nConsultez-la dans votre espace client : https://tutelliv.example/portal/invoices/exemple\n\nSi votre règlement est déjà parti, merci de ne pas tenir compte de ce message." },
};
for (const [name, sample] of Object.entries(samples)) {
  writeFileSync(join(previewDir, `${name}.html`), renderTextEmailHtml({ ...sample, testRecipient: name === "livraison" ? "client@exemple.test" : undefined }));
}
const pages = [
  ...["signup", "invite", "recovery"].map((type) => [`auth-${type}`, type]),
  ...Object.entries(samples).map(([name, sample]) => [name, sample.subject]),
];
writeFileSync(join(previewDir, "index.html"), `<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>TutelLiv — modèles intégrés</title><style>body{margin:0;background:#f5f8f6;font:15px Arial;color:#0e1310;padding:24px}nav{display:flex;flex-wrap:wrap;gap:12px;margin:20px 0}a{color:#08783f}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,560px),1fr));gap:24px}iframe{width:100%;height:1000px;border:1px solid #e4e8e5;border-radius:16px;background:#fff}section{scroll-margin:20px}h2{font-size:16px}</style><h1>Mails TutelLiv — Menthe soignée</h1><p>13 rendus issus des modèles intégrés · données fictives · aucun envoi. Les liens de démonstration restent dans chaque aperçu.</p><nav>${pages.map(([name, label]) => `<a href="#${name}">${label}</a>`).join("")}</nav><div class="grid">${pages.map(([name, label]) => `<section id="${name}"><h2>${label}</h2><iframe title="${label}" src="${name}.html" sandbox=""></iframe></section>`).join("")}</div></html>`);
console.log(`Modèles : ${templatesDir} · aperçus locaux : ${previewDir}`);
