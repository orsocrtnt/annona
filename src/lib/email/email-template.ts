/** Mails TutelLiv : direction « Menthe soignée », logo officiel et texte brut de secours. */
import { emailPresentation, type EmailPresentation } from "./email-presentation";

const COLORS = {
  background: "#f5f8f6",
  card: "#ffffff",
  border: "#e4e8e5",
  ink: "#0e1310",
  secondary: "#4f5953",
  muted: "#68726b",
  primary: "#00d46a",
  link: "#08783f",
  warning: "#b45309",
  warningSubtle: "#fffbeb",
};

const FONT = "Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

export type EmailAction = { label: string; url: string };

export type EmailLayoutInput = {
  heading: string;
  badge?: string;
  tone?: EmailPresentation["tone"];
  details?: EmailPresentation["details"];
  paragraphs: string[];
  action?: EmailAction;
  /** Paragraphe discret sous le bouton (sécurité, lien à usage unique…). */
  note?: string;
  /** Bandeau du mode recette : rappelle le destinataire initialement visé. */
  testRecipient?: string;
};

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const URL_PATTERN = /https?:\/\/[^\s<>"']+/g;

/** Échappe le texte puis transforme les seules URL http(s) en liens. */
function linkify(value: string) {
  let html = "";
  let last = 0;
  for (const match of value.matchAll(URL_PATTERN)) {
    const url = match[0].replace(/[.,;:!?)]+$/, "");
    const start = match.index!;
    html += escapeHtml(value.slice(last, start));
    html += `<a href="${escapeHtml(url)}" style="color:${COLORS.link};text-decoration:underline">${escapeHtml(url)}</a>`;
    last = start + url.length;
  }
  return html + escapeHtml(value.slice(last));
}

function paragraph(lines: string, style = `margin:0 0 16px;font-size:15px;line-height:1.7;color:${COLORS.secondary}`) {
  return `<p style="${style}">${lines.split("\n").map(linkify).join("<br>")}</p>`;
}

function button(action: EmailAction) {
  const href = escapeHtml(action.url);
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px"><tr><td style="border-radius:999px;background:${COLORS.ink}"><a href="${href}" style="display:inline-block;padding:15px 23px;font-family:${FONT};font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:999px">${escapeHtml(action.label)}</a></td></tr></table>`
    + `<p style="margin:0 0 16px;font-size:13px;line-height:1.5;color:${COLORS.muted}">Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :<br><a href="${href}" style="color:${COLORS.link};text-decoration:underline;word-break:break-all">${href}</a></p>`;
}

export function renderEmailLayout(input: EmailLayoutInput) {
  const banner = input.testRecipient
    ? `<tr><td style="padding:12px 16px;background:${COLORS.warningSubtle};border-bottom:1px solid ${COLORS.border};font-size:13px;line-height:1.5;color:${COLORS.warning}">Message de recette TutelLiv destiné à ${escapeHtml(input.testRecipient)}.</td></tr>`
    : "";
  const badgeColor = input.tone === "danger" ? "#a12c2c" : input.tone === "warning" ? "#775716" : COLORS.link;
  const badgeBackground = input.tone === "danger" ? "#fceeee" : input.tone === "warning" ? "#fff5df" : "#e9f9ef";
  const details = input.details?.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px;background:#f7f9f7;border:1px solid ${COLORS.border};border-radius:12px"><tbody>${input.details.map((row) => `<tr><td style="padding:12px 16px;font-size:13px;color:${COLORS.muted};vertical-align:top">${escapeHtml(row.label)}</td><td style="padding:12px 16px;font-size:13px;font-weight:600;color:${COLORS.ink};text-align:right;overflow-wrap:anywhere">${escapeHtml(row.value)}</td></tr>`).join("")}</tbody></table>`
    : "";
  const body = [
    input.badge ? `<span style="display:inline-block;padding:7px 11px;border-radius:999px;background:${badgeBackground};color:${badgeColor};font-size:11px;line-height:1.4;font-weight:700;letter-spacing:0.3px">${escapeHtml(input.badge)}</span>` : "",
    `<h1 style="margin:20px 0 18px;font-size:29px;line-height:1.2;letter-spacing:-0.8px;font-weight:600;color:${COLORS.ink};overflow-wrap:anywhere">${escapeHtml(input.heading)}</h1>`,
    ...input.paragraphs.map((text) => paragraph(text)),
    details,
    input.action ? button(input.action) : "",
    input.note ? `<div style="border-left:2px solid ${COLORS.primary};padding-left:14px">${paragraph(input.note, `margin:0;font-size:12px;line-height:1.7;color:${COLORS.secondary}`)}</div>` : "",
  ].join("");

  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<title>${escapeHtml(input.heading)}</title>
<style>@media only screen and (max-width:480px){.email-padding{padding:24px !important}} a{overflow-wrap:anywhere}</style>
</head>
<body style="margin:0;padding:0;background:${COLORS.background};font-family:${FONT}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${COLORS.background}">
<tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px">
<tr><td style="background:${COLORS.card};border:1px solid ${COLORS.border};border-radius:20px;overflow:hidden">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
${banner}<tr><td class="email-logo-header" align="center" bgcolor="#ffffff" style="padding:28px 24px;text-align:center;background-color:#ffffff;background-image:linear-gradient(#ffffff,#ffffff);border-radius:20px 20px 0 0"><img src="https://tutelliv.fr/brand/logo-horizontal-fond-clair.png" width="146" height="43" alt="TutelLiv" style="display:block;margin:0 auto;width:146px;height:auto;border:0;color:${COLORS.ink};font-size:20px;font-weight:700"></td></tr>
<tr><td class="email-padding" style="padding:32px;font-family:${FONT}">${body}</td></tr>
</table>
</td></tr>
<tr><td style="padding:20px 4px 0;font-size:12px;line-height:1.5;color:${COLORS.muted}">E-mail automatique envoyé par TutelLiv, plateforme de suivi des livraisons. Merci de ne pas répondre à ce message.</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

/** Ligne « Libellé : https://… » : devient le bouton principal de l'e-mail. */
const ACTION_LINE = /^(.{2,80}?)\s*:\s*(https?:\/\/\S+)$/;

/**
 * Habille un e-mail métier rédigé en texte brut : sujet en titre, paragraphes séparés par une ligne
 * vide, et la première ligne « Libellé : URL » transformée en bouton. Fonction pure : le même texte
 * figé (reprise sous la même clé d'idempotence) donne toujours le même HTML.
 */
export function renderTextEmailHtml(input: { subject: string; text: string; testRecipient?: string }) {
  let action: EmailAction | undefined;
  const paragraphs = input.text
    .split(/\n\s*\n/)
    .map((block) =>
      block
        .split("\n")
        .filter((line) => {
          const match = action ? null : ACTION_LINE.exec(line.trim());
          if (!match) return true;
          action = { label: match[1]!, url: match[2]! };
          return false;
        })
        .join("\n")
        .trim()
    )
    .filter(Boolean);
  const presentation = emailPresentation(input.subject, input.text);
  return renderEmailLayout({ heading: input.subject, ...presentation, paragraphs, action, testRecipient: input.testRecipient });
}

export type SupabaseAuthEmailType = "signup" | "invite" | "recovery";

const AUTH_EMAILS: Record<SupabaseAuthEmailType, { subject: string; heading: string; paragraphs: string[]; label: string; note: string }> = {
  signup: {
    subject: "Confirmez votre adresse e-mail TutelLiv",
    heading: "Un premier pas. Votre espace vous attend.",
    paragraphs: ["Merci pour votre inscription. Confirmez votre adresse pour créer votre espace entreprise ; vous vous connecterez ensuite avec le mot de passe choisi lors de l’inscription."],
    label: "Confirmer mon adresse",
    note: "Ce lien est personnel, temporaire et à usage unique. Si vous n’êtes pas à l’origine de cette inscription, ignorez cet e-mail.",
  },
  invite: {
    subject: "Votre invitation TutelLiv",
    heading: "Bienvenue dans votre équipe.",
    paragraphs: ["Un accès à votre espace TutelLiv vient d’être créé. Choisissez votre mot de passe pour l’activer."],
    label: "Choisir mon mot de passe",
    note: "Ce lien est personnel, temporaire et à usage unique. Si vous n’attendiez pas cette invitation, ignorez cet e-mail.",
  },
  recovery: {
    subject: "Réinitialisez votre mot de passe TutelLiv",
    heading: "Un nouveau mot de passe.",
    paragraphs: ["Une demande de nouveau mot de passe a été faite pour votre compte TutelLiv."],
    label: "Choisir un nouveau mot de passe",
    note: "Ce lien est personnel, temporaire et à usage unique. Si vous n’avez rien demandé, ignorez cet e-mail : votre mot de passe actuel reste valable.",
  },
};

/**
 * Modèles à coller dans Supabase (Authentication → Emails). Les variables Go `{{ .SiteURL }}` et
 * `{{ .TokenHash }}` sont laissées intactes : Supabase les remplace à l'envoi.
 */
export function renderSupabaseAuthTemplate(type: SupabaseAuthEmailType) {
  const copy = AUTH_EMAILS[type];
  return {
    subject: copy.subject,
    html: renderEmailLayout({
      heading: copy.heading,
      badge: type === "signup" ? "CONFIRMATION" : type === "invite" ? "VOTRE ESPACE TUTELLIV" : "SÉCURITÉ DU COMPTE",
      paragraphs: copy.paragraphs,
      action: { label: copy.label, url: `{{ .SiteURL }}/reset-password#token_hash={{ .TokenHash }}&type=${type}` },
      note: copy.note,
    }),
  };
}
