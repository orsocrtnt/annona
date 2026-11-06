import { escapeHtml } from "@/lib/email/email-template";

/**
 * ADMIN-ESPACE lot 5 : mail « Il en est où ? » (modèle de référence : docs/operations/email/prospection/teaser-il-en-est-ou.html).
 * Version « mail personnel simple » décidée par le propriétaire le 5 novembre 2026 : la version mise en forme
 * (logo joint, encadré, bouton, aperçu caché) tombait en indésirables chez Microsoft 365, alors qu'un mail simple
 * de la même boîte arrivait. Ne pas remettre de logo, de bouton, de tableau de mise en page ni de texte caché.
 * Aucun pixel de suivi : seuls les deux liens passent par /go/<code>/… pour être comptés.
 */

export const PROSPECT_SENDER_ADDRESS = "orso@tutelliv.fr";
export const PROSPECT_SENDER_NAME = "Orso — TutelLiv";
export const PROSPECT_SUBJECT = "Il en est où ?";
/** Identité de l'émetteur exigée par la CNIL ; à compléter par le SIREN dès qu'il est attribué. */
export const PROSPECT_SENDER_IDENTITY =
  "Orso Carotenuto-Marchetti, entrepreneur individuel (immatriculation en cours), 10 traverse de la Gaye, 13009 Marseille.";

export type ProspectEmailInput = {
  city: string;
  /** Code compté par /go ; « test » pour un envoi d'essai (chiffres de la campagne inchangés). */
  linkCode: string;
  addressSource: string;
  /** Origine des liens, sans barre finale (ex. https://tutelliv.fr). */
  baseUrl: string;
};

export type ProspectEmail = {
  subject: string;
  html: string;
  text: string;
  headers: Record<string, string>;
};

export function prospectLinks(baseUrl: string, code: string) {
  const origin = baseUrl.replace(/\/+$/, "");
  return {
    join: `${origin}/go/${encodeURIComponent(code)}/rejoindre`,
    site: `${origin}/go/${encodeURIComponent(code)}/site`,
  };
}

const STEPS = [
  { icon: "📥", title: "La commande arrive", detail: "E-mail, WhatsApp… toutes les demandes au même endroit." },
  { icon: "🧭", title: "Le dispatch intelligent s'en occupe", detail: "Il optimise les tournées et vous fait gagner du temps." },
  { icon: "🛵", title: "Le livreur la reçoit et confirme", detail: "Sur son téléphone, sans appel ni message." },
  { icon: "📍", title: "Le client suit sa course tout seul", detail: "Carte en direct, que vous pouvez désactiver." },
  { icon: "✅", title: "Facture envoyée, relances automatiques", detail: "Rien à saisir en fin de journée." },
] as const;

const STOP_LINE = "Pour ne plus recevoir de message, répondez STOP : je retire votre adresse aussitôt.";

export function renderProspectEmail(input: ProspectEmailInput): ProspectEmail {
  const city = escapeHtml(input.city);
  const links = prospectLinks(input.baseUrl, input.linkCode);
  const p = (content: string, style = "") => `<p style="margin:0 0 14px${style}">${content}</p>`;
  const html = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>${PROSPECT_SUBJECT}</title>
</head>
<body>
<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#1f2421">
${p("Bonjour,")}
${p(`Vous en avez marre de ce genre de question ?<br>Quelque chose arrive pour les entreprises de coursiers de ${city}. De A à Z, tout est suivi :`)}
${p(STEPS.map((step) => `${step.icon} <strong>${step.title}</strong> : ${escapeHtml(step.detail)}`).join("<br>"))}
${p(`Envie d'être parmi les premiers informés ? <a href="${escapeHtml(links.join)}">Je veux en être</a>`)}
${p(`Carotenuto-Marchetti Orso<br>Fondateur, TutelLiv · <a href="${escapeHtml(links.site)}">tutelliv.fr</a>`)}
${p(`${escapeHtml(PROSPECT_SENDER_IDENTITY)}<br>Adresse trouvée sur ${escapeHtml(input.addressSource)}. ${STOP_LINE}`, ";font-size:12px;color:#68726b")}
</div>
</body>
</html>`;

  const text = [
    "Bonjour,",
    "",
    "Vous en avez marre de ce genre de question ?",
    `Quelque chose arrive pour les entreprises de coursiers de ${input.city}. De A à Z, tout est suivi :`,
    "",
    ...STEPS.map((step) => `${step.icon} ${step.title} : ${step.detail}`),
    "",
    `Envie d'être parmi les premiers informés ? Je veux en être : ${links.join}`,
    "",
    "Carotenuto-Marchetti Orso",
    `Fondateur, TutelLiv · ${links.site}`,
    "",
    "--",
    PROSPECT_SENDER_IDENTITY,
    `Adresse trouvée sur ${input.addressSource}. ${STOP_LINE}`,
  ].join("\n");

  return {
    subject: PROSPECT_SUBJECT,
    html,
    text,
    // Désinscription en un clic côté messagerie : un mail « STOP » à la boîte du propriétaire.
    headers: { "List-Unsubscribe": `<mailto:${PROSPECT_SENDER_ADDRESS}?subject=STOP>` },
  };
}
