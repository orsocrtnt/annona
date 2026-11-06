import nodemailer from "nodemailer";
import { PROSPECT_SENDER_ADDRESS, PROSPECT_SENDER_NAME, type ProspectEmail } from "@/domains/growth/prospect/prospect-email";

/**
 * ADMIN-ESPACE lot 5 : envoi depuis la boîte OVH du propriétaire (Zimbra, SMTP smtp.mail.ovh.net:465 SSL).
 * Jamais par Resend : ses règles interdisent l'envoi non sollicité et il porte les mails de connexion.
 * Le mot de passe vient de `PROSPECT_SMTP_PASSWORD` (Vercel) ; il n'est jamais renvoyé ni journalisé.
 */

export type ProspectMailerConfig = { host: string; port: number; user: string; password: string };

export type ProspectMailer = {
  send: (to: string, email: ProspectEmail) => Promise<void>;
};

export function readProspectMailerConfig(env: Record<string, string | undefined> = process.env): ProspectMailerConfig | null {
  const password = env.PROSPECT_SMTP_PASSWORD?.trim();
  if (!password) return null;
  const port = Number(env.PROSPECT_SMTP_PORT ?? "465");
  return {
    host: env.PROSPECT_SMTP_HOST?.trim() || "smtp.mail.ovh.net",
    port: Number.isInteger(port) && port > 0 ? port : 465,
    user: env.PROSPECT_SMTP_USER?.trim() || PROSPECT_SENDER_ADDRESS,
    password,
  };
}

/** Motif d'échec lisible et sans secret (code SMTP ou type d'erreur réseau), borné à 160 caractères. */
export function describeMailerError(error: unknown): string {
  if (error && typeof error === "object") {
    const { code, responseCode } = error as { code?: unknown; responseCode?: unknown };
    if (code === "EAUTH") return "Connexion refusée par OVH : vérifier le mot de passe de la boîte.";
    if (typeof responseCode === "number") return `Refus du serveur mail (code ${responseCode}).`;
    if (code === "ETIMEDOUT" || code === "ECONNECTION" || code === "ESOCKET") return "Serveur mail OVH injoignable.";
    if (code === "EENVELOPE") return "Adresse refusée par le serveur mail.";
  }
  return "Envoi impossible (erreur inconnue).";
}

export function createProspectMailer(config: ProspectMailerConfig): ProspectMailer {
  const transport = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.port === 465,
    auth: { user: config.user, pass: config.password },
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 20_000,
  });
  return {
    async send(to, email) {
      await transport.sendMail({
        from: { name: PROSPECT_SENDER_NAME, address: config.user },
        replyTo: config.user,
        to,
        subject: email.subject,
        html: email.html,
        text: email.text,
        headers: email.headers,
      });
    },
  };
}
