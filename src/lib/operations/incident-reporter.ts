import { sendTransactionalEmail } from "@/lib/email/transactional-email";

type IncidentSeverity = "warning" | "error" | "critical";

export type OperationalIncident = {
  source: string;
  summary: string;
  fingerprint: string;
  severity?: IncidentSeverity;
  context?: Record<string, string | number | boolean | null | undefined>;
};

type IncidentReporterOptions = {
  env?: NodeJS.ProcessEnv;
  fetcher?: typeof fetch;
  now?: Date;
  log?: Pick<Console, "error" | "warn">;
  sendEmail?: typeof sendTransactionalEmail;
};

const MAX_TEXT_LENGTH = 500;
const ALERT_EMAIL_TIMEOUT_MS = 3_000;
const ALLOWED_CONTEXT_KEY = /^[a-zA-Z][a-zA-Z0-9_.-]{0,63}$/;

function sanitizeText(value: unknown, maxLength = MAX_TEXT_LENGTH) {
  return String(value ?? "")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\bBearer\s+[A-Za-z0-9._~+\/-]+=*/gi, "Bearer [REDACTED]")
    .replace(/postgres(?:ql)?:\/\/[^\s]+/gi, "postgresql://[REDACTED]")
    .replace(/\b(?:sk|sbp|eyJ)[-_A-Za-z0-9.]{12,}\b/g, "[REDACTED]")
    .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, "[EMAIL]")
    .trim()
    .slice(0, maxLength);
}

function sanitizeContext(context: OperationalIncident["context"]) {
  const safe: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of Object.entries(context ?? {}).slice(0, 20)) {
    if (!ALLOWED_CONTEXT_KEY.test(key) || value === undefined) continue;
    safe[key] = typeof value === "string" ? sanitizeText(value, 200) : value;
  }
  return safe;
}

function safeWebhookUrl(value: string | undefined, nodeEnv: string | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    if (nodeEnv === "production" && url.protocol !== "https:") return null;
    url.username = "";
    url.password = "";
    return url;
  } catch {
    return null;
  }
}

type SanitizedIncident = {
  occurredAt: string;
  severity: IncidentSeverity;
  source: string;
  fingerprint: string;
  summary: string;
};

/**
 * Un e-mail par empreinte et par jour UTC : la clé porte le jour, et le fournisseur ne renvoie rien
 * pour une clé déjà vue. Le corps reste donc identique toute la journée (aucun compteur ni heure).
 * Une alerte ratée ne doit jamais faire échouer l'appelant.
 */
async function sendIncidentEmail(
  event: SanitizedIncident,
  env: NodeJS.ProcessEnv,
  logger: Pick<Console, "warn">,
  send: typeof sendTransactionalEmail
): Promise<"disabled" | "sent" | "failed"> {
  const to = env.OPS_ALERT_RECIPIENT?.trim() || env.EMAIL_TEST_RECIPIENT?.trim();
  if (!to) return "disabled";
  const day = event.occurredAt.slice(0, 10);
  try {
    const result = await send(
      {
        to,
        subject: `Alerte TutelLiv : ${event.summary}`,
        text: [
          event.summary,
          "",
          `Gravité : ${event.severity}`,
          `Source : ${event.source}`,
          `Empreinte : ${event.fingerprint}`,
          `Jour (UTC) : ${day}`,
          "",
          "Une seule alerte par jour pour cette empreinte : d'autres occurrences ont pu suivre.",
          "Détail dans les journaux Vercel ; réaction : docs/operations/ops03b/README.md.",
        ].join("\n"),
        idempotencyKey: `ops-alert:${event.fingerprint}:${day}`,
        // La clé change chaque jour : une tentative antérieure a moins de 24 h, toujours dédupliquée.
        replayWindowStart: null,
      },
      { env, signal: AbortSignal.timeout(ALERT_EMAIL_TIMEOUT_MS) }
    );
    return result.status === "disabled" ? "disabled" : "sent";
  } catch (error) {
    logger.warn(JSON.stringify({
      event: "tutelliv.alert_email_failed",
      source: event.source,
      fingerprint: event.fingerprint,
      reason: sanitizeText(error instanceof Error ? error.message : "UNKNOWN", 100),
    }));
    return "failed";
  }
}

export async function reportOperationalIncident(
  incident: OperationalIncident,
  options: IncidentReporterOptions = {}
) {
  const env = options.env ?? process.env;
  const logger = options.log ?? console;
  const event = {
    event: "tutelliv.operational_incident",
    occurredAt: (options.now ?? new Date()).toISOString(),
    severity: incident.severity ?? "error",
    source: sanitizeText(incident.source, 100),
    fingerprint: sanitizeText(incident.fingerprint, 120),
    summary: sanitizeText(incident.summary),
    context: sanitizeContext(incident.context),
  } as const;

  logger.error(JSON.stringify(event));

  const email = await sendIncidentEmail(event, env, logger, options.sendEmail ?? sendTransactionalEmail);

  const webhook = safeWebhookUrl(env.OPS_ALERT_WEBHOOK_URL, env.NODE_ENV);
  if (!webhook) return { logged: true, email, webhook: "disabled" as const };

  try {
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (env.OPS_ALERT_WEBHOOK_TOKEN) {
      headers.authorization = `Bearer ${env.OPS_ALERT_WEBHOOK_TOKEN}`;
    }
    const response = await (options.fetcher ?? fetch)(webhook, {
      method: "POST",
      headers,
      body: JSON.stringify(event),
      signal: AbortSignal.timeout(3_000),
    });
    if (!response.ok) throw new Error(`HTTP_${response.status}`);
    return { logged: true, email, webhook: "sent" as const };
  } catch (error) {
    logger.warn(JSON.stringify({
      event: "tutelliv.alert_delivery_failed",
      source: event.source,
      fingerprint: event.fingerprint,
      reason: sanitizeText(error instanceof Error ? error.message : "UNKNOWN", 100),
    }));
    return { logged: true, email, webhook: "failed" as const };
  }
}

export const incidentReporterInternals = { sanitizeText, sanitizeContext, safeWebhookUrl };
