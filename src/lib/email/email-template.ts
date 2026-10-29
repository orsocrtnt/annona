/**
 * Mise en page HTML des e-mails TutelLiv (DA « Menthe » Light, jetons de `globals.css`).
 * Aucune image distante ni pixel de suivi : le logo est un mot-symbole en texte, le rendu reste
 * lisible sans chargement d'images et le texte brut reste toujours envoyé à côté.
 */

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

function paragraph(lines: string, style = `margin:0 0 16px;font-size:15px;line-height:1.6;color:${COLORS.ink}`) {
  return `<p style="${style}">${lines.split("\n").map(linkify).join("<br>")}</p>`;
}

function button(action: EmailAction) {
  const href = escapeHtml(action.url);
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px"><tr><td style="border-radius:10px;background:${COLORS.primary}"><a href="${href}" style="display:inline-block;padding:13px 22px;font-family:${FONT};font-size:15px;font-weight:600;color:${COLORS.ink};text-decoration:none;border-radius:10px">${escapeHtml(action.label)}</a></td></tr></table>`
    + `<p style="margin:0 0 16px;font-size:13px;line-height:1.5;color:${COLORS.muted}">Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :<br><a href="${href}" style="color:${COLORS.link};text-decoration:underline;word-break:break-all">${href}</a></p>`;
}

export function renderEmailLayout(input: EmailLayoutInput) {
  const banner = input.testRecipient
    ? `<tr><td style="padding:12px 16px;background:${COLORS.warningSubtle};border-bottom:1px solid ${COLORS.border};font-size:13px;line-height:1.5;color:${COLORS.warning}">Message de recette TutelLiv destiné à ${escapeHtml(input.testRecipient)}.</td></tr>`
    : "";
  const body = [
    `<h1 style="margin:0 0 16px;font-size:20px;line-height:1.3;font-weight:600;color:${COLORS.ink}">${escapeHtml(input.heading)}</h1>`,
    ...input.paragraphs.map((text) => paragraph(text)),
    input.action ? button(input.action) : "",
    input.note ? paragraph(input.note, `margin:0;font-size:13px;line-height:1.5;color:${COLORS.secondary}`) : "",
  ].join("");

  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<title>${escapeHtml(input.heading)}</title>
</head>
<body style="margin:0;padding:0;background:${COLORS.background};font-family:${FONT}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${COLORS.background}">
<tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px">
<tr><td style="padding:0 4px 20px;font-size:20px;font-weight:700;letter-spacing:-0.02em;color:${COLORS.ink}">TutelLiv<span style="color:${COLORS.primary}">.</span></td></tr>
<tr><td style="background:${COLORS.card};border:1px solid ${COLORS.border};border-radius:16px;overflow:hidden">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
${banner}<tr><td style="padding:28px 28px 24px;font-family:${FONT}">${body}</td></tr>
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
  return renderEmailLayout({ heading: input.subject, paragraphs, action, testRecipient: input.testRecipient });
}

export type SupabaseAuthEmailType = "signup" | "invite" | "recovery";

const AUTH_EMAILS: Record<SupabaseAuthEmailType, { subject: string; heading: string; paragraphs: string[]; label: string; note: string }> = {
  signup: {
    subject: "Confirmez votre adresse e-mail TutelLiv",
    heading: "Confirmez votre adresse e-mail",
    paragraphs: ["Merci pour votre inscription. Confirmez votre adresse pour créer votre espace entreprise ; vous vous connecterez ensuite avec le mot de passe choisi lors de l’inscription."],
    label: "Confirmer mon adresse",
    note: "Ce lien est personnel, temporaire et à usage unique. Si vous n’êtes pas à l’origine de cette inscription, ignorez cet e-mail.",
  },
  invite: {
    subject: "Votre invitation TutelLiv",
    heading: "Vous êtes invité sur TutelLiv",
    paragraphs: ["Un accès à votre espace TutelLiv vient d’être créé. Choisissez votre mot de passe pour l’activer."],
    label: "Choisir mon mot de passe",
    note: "Ce lien est personnel, temporaire et à usage unique. Si vous n’attendiez pas cette invitation, ignorez cet e-mail.",
  },
  recovery: {
    subject: "Réinitialisez votre mot de passe TutelLiv",
    heading: "Réinitialisez votre mot de passe",
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
      paragraphs: copy.paragraphs,
      action: { label: copy.label, url: `{{ .SiteURL }}/reset-password#token_hash={{ .TokenHash }}&type=${type}` },
      note: copy.note,
    }),
  };
}
