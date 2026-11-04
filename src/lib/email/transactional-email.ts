import { renderTextEmailHtml } from "./email-template";

const EMAIL_TIMEOUT_MS = 10_000;
const EMAIL_IDEMPOTENCY_KEY_MAX = 256;

export type TransactionalEmailMode = "disabled" | "test" | "live";

type EmailEnvironment = Record<string, string | undefined>;

type EmailFetcher = (
  input: string | URL | Request,
  init?: RequestInit
) => Promise<Pick<Response, "ok" | "status"> & { text?: () => Promise<string> }>;

export type TransactionalEmailConfiguration = {
  mode: TransactionalEmailMode;
  enabled: boolean;
  reason:
    | "ready"
    /** EMAIL_DELIVERY_MODE explicitement à "disabled" (choix délibéré, ex. développement). */
    | "disabled"
    /** EMAIL_DELIVERY_MODE absent : désactivé aussi, mais un oubli possible (jamais traité comme un choix). */
    | "unset"
    | "invalid-mode"
    | "missing-provider"
    | "missing-test-recipient";
};

/**
 * Début de la fenêtre de déduplication : une date, `null` (aucune tentative antérieure possible), ou
 * un résolveur appelé juste avant l'appel au fournisseur, qui enregistre cette tentative et renvoie
 * l'instant de la première tentative antérieure (null si c'est la première).
 */
export type ReplayWindowStart = Date | null | (() => Promise<Date | null>);

/** Rendu d'un e-mail (avant la redirection du mode test). */
export type EmailContent = { to: string; subject: string; text: string };

/**
 * Fige le rendu sous une clé : `freeze` enregistre `content` s'il n'existe encore aucun instantané et
 * renvoie l'instantané enregistré, à envoyer tel quel (même clé = même corps) ; `release` l'efface
 * après un refus certain d'une première tentative (rien n'est parti : une correction pourra s'appliquer).
 */
export type EmailContentFreezer = {
  freeze: (content: EmailContent) => Promise<{ content: EmailContent; created: boolean }>;
  release: () => Promise<void>;
};

export type TransactionalEmailInput = {
  to: string;
  subject: string;
  text: string;
  /** MAIL-PONT : « répondre à » (boîte de commandes de l'entreprise) ; ignoré s'il n'est pas une adresse. */
  replyTo?: string | null;
  /** MAIL-PONT : nom de l'entreprise, affiché « Entreprise via TutelLiv » devant l'adresse d'envoi. */
  senderName?: string | null;
  idempotencyKey: string;
  /**
   * Instant le plus ancien auquel une tentative précédente sous cette clé a pu atteindre le
   * fournisseur (création de la relance ou de la tâche durable) ; `null` quand aucune tentative
   * antérieure n'a pu être acceptée. Obligatoire : chaque appelant doit se prononcer.
   */
  replayWindowStart: ReplayWindowStart;
  /** Tâches durables : instantané du rendu dans le payload (C5, contenu stable par clé). */
  freezeContent?: EmailContentFreezer;
};

type SendOptions = {
  env?: EmailEnvironment;
  fetcher?: EmailFetcher;
  signal?: AbortSignal;
  now?: Date;
};

function parseMode(value: string | undefined): TransactionalEmailMode | null {
  if (!value || value === "disabled") return "disabled";
  if (value === "test" || value === "live") return value;
  return null;
}

function hasAddress(value: string | undefined) {
  return Boolean(value?.trim() && /@[^@]+$/.test(value.trim()));
}

export function getTransactionalEmailConfiguration(
  env: EmailEnvironment = process.env
): TransactionalEmailConfiguration {
  if (!env.EMAIL_DELIVERY_MODE?.trim()) return { mode: "disabled", enabled: false, reason: "unset" };
  const mode = parseMode(env.EMAIL_DELIVERY_MODE);
  if (!mode) return { mode: "disabled", enabled: false, reason: "invalid-mode" };
  if (mode === "disabled") {
    return { mode, enabled: false, reason: "disabled" };
  }

  const from = env.MAIL_FROM || env.EMAIL_FROM;
  if (!env.RESEND_API_KEY?.trim() || !hasAddress(from)) {
    return { mode, enabled: false, reason: "missing-provider" };
  }
  if (mode === "test" && !hasAddress(env.EMAIL_TEST_RECIPIENT)) {
    return { mode, enabled: false, reason: "missing-test-recipient" };
  }
  return { mode, enabled: true, reason: "ready" };
}

function safeHeader(value: string, max: number) {
  return value.replace(/[\r\n]+/g, " ").trim().slice(0, max);
}

/**
 * Expéditeur affiché « Entreprise via TutelLiv » avec l'adresse de MAIL_FROM (jamais une autre) :
 * nom nettoyé des caractères d'en-tête, entre guillemets ; sans nom utilisable, MAIL_FROM tel quel.
 */
export function senderHeader(mailFrom: string, senderName: string | null | undefined) {
  const address = /<([^<>]+)>\s*$/.exec(mailFrom)?.[1]?.trim() ?? mailFrom.trim();
  const name = (senderName ?? "").replace(/["<>\\\r\n,;:]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 60).trim();
  if (!name || !hasAddress(address)) return mailFrom;
  return `"${name} via TutelLiv" <${address}>`;
}

/**
 * Déduplication Resend : une clé d'idempotence est conservée 24 h ; même clé + même contenu
 * renvoie la réponse d'origine sans renvoyer l'e-mail.
 * Source : https://resend.com/docs/dashboard/emails/idempotency-keys
 */
export const EMAIL_PROVIDER_IDEMPOTENCY_WINDOW_HOURS = 24;
/** Reprise automatique sous la même clé : 23 h après le début de fenêtre, 1 h de marge (horloges, durée de requête). */
export const EMAIL_SAFE_REPLAY_HOURS = 23;
const SAFE_REPLAY_MS = EMAIL_SAFE_REPLAY_HOURS * 60 * 60 * 1000;

/**
 * Issue d'un envoi en échec (C4, C5) :
 * - "rejected" : refus certain de CETTE requête, rien n'est parti avec elle ; elle peut être rejouée
 *   (une tentative antérieure à l'issue inconnue reste, elle, possiblement acceptée : c'est à
 *   l'appelant de ne pas l'oublier) ;
 * - "unknown" : peut-être parti (expiration, réseau, 5xx, 409 requête concurrente, code non
 *   documenté, réponse illisible) ; seule une reprise avec la même clé ET le même contenu, dans la
 *   fenêtre de déduplication, est sûre ;
 * - "unconfirmed" : état terminal, jamais de reprise automatique (ni même clé, ni nouvelle clé) :
 *   409 `invalid_idempotent_request` (la clé a déjà servi avec un autre contenu : un envoi a pu
 *   avoir lieu) ou fenêtre de déduplication dépassée pour une reprise.
 */
export type EmailSendOutcome = "rejected" | "unknown" | "unconfirmed";

/**
 * Codes Resend qui prouvent que la requête n'a pas été traitée (https://resend.com/docs/api-reference/errors) :
 * 400 validation / clé invalide, 401 clé API, 403 domaine ou clé, 404, 405, 422 champ manquant,
 * 429 débit ou quota. Tout autre code reste une issue inconnue (409 concurrent, 500, 503, passerelle…).
 */
const REJECTED_HTTP_STATUSES = new Set([400, 401, 403, 404, 405, 422, 429]);

export function classifyProviderResponse(status: number, errorName: string | null): EmailSendOutcome {
  if (status === 409 && errorName === "invalid_idempotent_request") return "unconfirmed";
  if (REJECTED_HTTP_STATUSES.has(status)) return "rejected";
  return "unknown";
}

/** Vrai si une reprise sous la même clé est encore dédupliquée par le fournisseur. */
export function isIdempotentReplaySafe(replayWindowStart: Date | null, now: Date): boolean {
  return replayWindowStart === null || now.getTime() < replayWindowStart.getTime() + SAFE_REPLAY_MS;
}

/** Erreur qualifiée ; "unconfirmed" est aussi une erreur permanente pour les tâches durables. */
function emailError(message: string, outcome: EmailSendOutcome) {
  return Object.assign(new Error(message), {
    emailOutcome: outcome,
    ...(outcome === "unconfirmed" ? { permanent: true } : {}),
  });
}

/** Seule une erreur qualifiée par ce module est un refus certain ; tout le reste est inconnu. */
export function emailSendOutcome(error: unknown): EmailSendOutcome {
  const outcome = error instanceof Error ? (error as { emailOutcome?: unknown }).emailOutcome : undefined;
  return outcome === "rejected" || outcome === "unconfirmed" ? outcome : "unknown";
}

/** Champ `name` du corps d'erreur Resend ({ statusCode, message, name }) ; null si illisible. */
async function providerErrorName(response: { text?: () => Promise<string> }): Promise<string | null> {
  try {
    if (typeof response.text !== "function") return null;
    const parsed: unknown = JSON.parse((await response.text()).slice(0, 4096));
    const name = parsed && typeof parsed === "object" ? (parsed as { name?: unknown }).name : null;
    return typeof name === "string" && /^[a-z_]{1,64}$/.test(name) ? name : null;
  } catch {
    return null;
  }
}

export async function sendTransactionalEmail(
  input: TransactionalEmailInput,
  options: SendOptions = {}
) {
  const env = options.env ?? process.env;
  const configuration = getTransactionalEmailConfiguration(env);
  if (!configuration.enabled) {
    return { status: "disabled" as const, mode: configuration.mode, reason: configuration.reason };
  }

  const from = senderHeader((env.MAIL_FROM || env.EMAIL_FROM)!.trim(), input.senderName);
  // Rendu figé à la première tentative émise : une reprise envoie exactement le même corps.
  const frozen = input.freezeContent
    ? await input.freezeContent.freeze({ to: input.to, subject: input.subject, text: input.text })
    : null;
  const content = frozen?.content ?? input;
  // Refus certain d'une première tentative : l'instantané est effacé pour qu'une correction s'applique.
  const rejectFirst = async (message: string, first: boolean) => {
    if (first && frozen?.created) await input.freezeContent!.release().catch(() => undefined);
    return emailError(message, "rejected");
  };
  const intendedRecipient = content.to.trim().toLowerCase();
  if (!hasAddress(intendedRecipient)) throw await rejectFirst("EMAIL_RECIPIENT_INVALID", true);

  const testMode = configuration.mode === "test";
  const recipient = testMode
    ? env.EMAIL_TEST_RECIPIENT!.trim().toLowerCase()
    : intendedRecipient;
  const subject = safeHeader(
    testMode ? `[TEST → ${intendedRecipient}] ${content.subject}` : content.subject,
    180
  );
  const text = testMode
    ? `Message de recette TutelLiv destiné à ${intendedRecipient}.\n\n${content.text}`
    : content.text;
  // Dérivé du rendu figé par une fonction pure : une reprise sous la même clé envoie le même HTML.
  const html = renderTextEmailHtml({
    subject: safeHeader(content.subject, 180),
    text: content.text,
    testRecipient: testMode ? intendedRecipient : undefined,
    replyAllowed: Boolean(input.replyTo && hasAddress(input.replyTo.trim())),
  });
  const idempotencyKey = safeHeader(
    input.idempotencyKey,
    EMAIL_IDEMPOTENCY_KEY_MAX
  );
  if (!subject || !text.trim() || !idempotencyKey) {
    throw await rejectFirst("EMAIL_CONTENT_INVALID", true);
  }
  // Au-delà de la fenêtre, le fournisseur ne déduplique plus : une reprise pourrait doubler l'e-mail.
  const replayWindowStart = typeof input.replayWindowStart === "function"
    ? await input.replayWindowStart()
    : input.replayWindowStart;
  if (!isIdempotentReplaySafe(replayWindowStart, options.now ?? new Date())) {
    throw emailError("EMAIL_IDEMPOTENCY_WINDOW_EXPIRED", "unconfirmed");
  }

  const response = await (options.fetcher ?? fetch)(
    "https://api.resend.com/emails",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify({
        from,
        to: [recipient],
        subject,
        text,
        html,
        ...(input.replyTo && hasAddress(input.replyTo.trim()) ? { reply_to: [input.replyTo.trim().toLowerCase()] } : {}),
      }),
      signal: options.signal ?? AbortSignal.timeout(EMAIL_TIMEOUT_MS),
    }
  );
  if (!response.ok) {
    // Le code HTTP seul ne prouve pas « rien n'est parti » (409, 5xx) : classement par code et `name`.
    const name = await providerErrorName(response);
    const message = `EMAIL_PROVIDER_HTTP_${response.status}${name ? `:${name}` : ""}`;
    const outcome = classifyProviderResponse(response.status, name);
    // Première tentative (aucune antérieure possible) refusée avec certitude : instantané effacé.
    if (outcome === "rejected") throw await rejectFirst(message, replayWindowStart === null);
    throw emailError(message, outcome);
  }
  return {
    status: "sent" as const,
    mode: configuration.mode,
    recipient,
  };
}
