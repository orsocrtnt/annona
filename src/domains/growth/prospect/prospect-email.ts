import { escapeHtml } from "@/lib/email/email-template";
import { PROSPECT_LOGO_CID, PROSPECT_LOGO_PNG_BASE64 } from "@/domains/growth/prospect/prospect-logo";

/**
 * ADMIN-ESPACE lot 5 : mail « Il en est où ? » validé par le propriétaire le 5 novembre 2026
 * (modèle de référence : docs/operations/email/prospection/teaser-il-en-est-ou.html).
 * Aucun pixel de suivi : seuls les deux liens passent par /go/<code>/… pour être comptés.
 */

export const PROSPECT_SENDER_ADDRESS = "orso@tutelliv.fr";
export const PROSPECT_SENDER_NAME = "Orso — TutelLiv";
export const PROSPECT_SUBJECT = "Il en est où ?";
export const PROSPECT_PREHEADER = "Bonjour, mon colis, il en est où ? Ça vous dit quelque chose ?";
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
  attachments: Array<{ filename: string; content: Buffer; cid: string; contentType: string }>;
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

const FONT = "Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
/*
 * Pas de caractères invisibles après l'aperçu : le 5 novembre 2026, Microsoft 365 (Kedge) classait le mail
 * en indésirables alors qu'un mail simple de la même boîte arrivait (mail-tester 10/10). Le texte caché en masse
 * est un signal de spam ; ne pas le remettre.
 */

function stepRow(step: (typeof STEPS)[number], index: number) {
  const border = index === 0 ? "" : ";border-top:1px solid #dfe8e1";
  const padding = index === STEPS.length - 1 ? "0 18px 6px" : "0 18px";
  return `<tr><td style="padding:${padding}"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0${border}"><tr><td width="48" style="padding:14px 0;vertical-align:middle"><span style="display:inline-block;background:#ffffff;border:1px solid #dfe8e1;border-radius:12px;width:36px;line-height:36px;text-align:center;font-size:17px">${step.icon}</span></td><td style="padding:14px 0;font:600 15px Arial;color:#0e1310">${step.title}<br><span style="display:inline-block;padding-top:4px;font:13px Arial;color:#68726b">${escapeHtml(step.detail)}</span></td></tr></table></td></tr>`;
}

export function renderProspectEmail(input: ProspectEmailInput): ProspectEmail {
  const city = escapeHtml(input.city);
  const source = escapeHtml(input.addressSource);
  const links = prospectLinks(input.baseUrl, input.linkCode);
  const html = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<title>${PROSPECT_SUBJECT}</title>
<style>@media only screen and (max-width:480px){.email-padding{padding:24px !important}}</style>
</head>
<body style="margin:0;padding:0;background:#f5f8f6;font-family:${FONT}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#f5f8f6">${escapeHtml(PROSPECT_PREHEADER)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f5f8f6">
<tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px">
<tr><td style="background:#ffffff;border:1px solid #e4e8e5;border-radius:20px;overflow:hidden">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td align="center" bgcolor="#ffffff" style="padding:0;text-align:center;background-color:#ffffff;border-bottom:1px solid #e4e8e5;border-radius:20px 20px 0 0"><img src="cid:${PROSPECT_LOGO_CID}" width="558" height="99" alt="TutelLiv" style="display:block;width:100%;max-width:558px;height:auto;border:0;border-radius:20px 20px 0 0;color:#0e1310;font-family:Arial,Helvetica,sans-serif;font-size:26px;font-weight:700;text-align:center;line-height:99px"></td></tr>
<tr><td class="email-padding" style="padding:32px;font-family:${FONT}">
<h1 style="margin:0 0 14px;font-size:29px;line-height:1.2;letter-spacing:-0.8px;font-weight:600;color:#0e1310">${PROSPECT_SUBJECT}</h1>
<p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#4f5953">Bonjour,</p>
<p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#4f5953">Vous en avez marre de ce genre de question ?<br>Quelque chose arrive pour les entreprises de coursiers de ${city}.</p>
<div style="margin:4px 0 0"><span style="display:inline-block;padding:7px 11px;border-radius:999px;background:#e9f9ef;color:#08783f;font-size:11px;line-height:1.4;font-weight:700;letter-spacing:0.3px">BIENTÔT À ${escapeHtml(input.city.toLocaleUpperCase("fr-FR"))}</span></div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0 26px;background:#f3f8f4;border:1px solid #e4e8e5;border-radius:16px">
<tr><td style="padding:18px 20px 8px;font:11px Arial;letter-spacing:1.2px;color:#68726b">DE A À Z, TOUT EST SUIVI</td></tr>
${STEPS.map(stepRow).join("\n")}
</table>
<p style="margin:0 0 18px;font-size:15px;line-height:1.7;color:#4f5953">Envie d'être parmi les premiers informés ?</p>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 14px"><tr><td style="border-radius:999px;background:#0e1310"><a href="${escapeHtml(links.join)}" style="display:inline-block;padding:15px 26px;font-family:${FONT};font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:999px">Je veux en être</a></td></tr></table>
<p style="margin:0 0 26px;font-size:13px;line-height:1.5;color:#68726b">Ou découvrez TutelLiv sur <a href="${escapeHtml(links.site)}" style="color:#08783f;text-decoration:underline">tutelliv.fr</a></p>
<p style="margin:0;font-size:15px;line-height:1.6;color:#0e1310"><strong>Carotenuto-Marchetti Orso</strong><br><span style="color:#68726b;font-size:13px">Fondateur, TutelLiv · ${PROSPECT_SENDER_ADDRESS}</span></p>
</td></tr>
</table>
</td></tr>
<tr><td style="padding:20px 4px 0;font-size:11px;line-height:1.6;color:#68726b">${escapeHtml(PROSPECT_SENDER_IDENTITY)}<br>Adresse trouvée sur ${source}. Pour ne plus recevoir de message, répondez STOP : je retire votre adresse aussitôt.</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

  const text = [
    PROSPECT_PREHEADER,
    "",
    PROSPECT_SUBJECT,
    "",
    "Bonjour,",
    "",
    "Vous en avez marre de ce genre de question ?",
    `Quelque chose arrive pour les entreprises de coursiers de ${input.city}.`,
    "",
    "DE A À Z, TOUT EST SUIVI",
    ...STEPS.map((step) => `${step.icon} ${step.title} : ${step.detail}`),
    "",
    `Envie d'être parmi les premiers informés ? Je veux en être : ${links.join}`,
    `Découvrir TutelLiv : ${links.site}`,
    "",
    "Carotenuto-Marchetti Orso",
    `Fondateur, TutelLiv · ${PROSPECT_SENDER_ADDRESS}`,
    "",
    "--",
    PROSPECT_SENDER_IDENTITY,
    `Adresse trouvée sur ${input.addressSource}. Pour ne plus recevoir de message, répondez STOP : je retire votre adresse aussitôt.`,
  ].join("\n");

  return {
    subject: PROSPECT_SUBJECT,
    html,
    text,
    // Désinscription en un clic côté messagerie : un mail « STOP » à la boîte du propriétaire.
    headers: { "List-Unsubscribe": `<mailto:${PROSPECT_SENDER_ADDRESS}?subject=STOP>` },
    attachments: [
      {
        filename: "logo-tutelliv.png",
        content: Buffer.from(PROSPECT_LOGO_PNG_BASE64, "base64"),
        cid: PROSPECT_LOGO_CID,
        contentType: "image/png",
      },
    ],
  };
}
