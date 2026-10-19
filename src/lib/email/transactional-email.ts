const EMAIL_TIMEOUT_MS = 10_000;
const EMAIL_IDEMPOTENCY_KEY_MAX = 256;

export type TransactionalEmailMode = "disabled" | "test" | "live";

type EmailEnvironment = Record<string, string | undefined>;

type EmailFetcher = (
  input: string | URL | Request,
  init?: RequestInit
) => Promise<Pick<Response, "ok" | "status">>;

export type TransactionalEmailConfiguration = {
  mode: TransactionalEmailMode;
  enabled: boolean;
  reason:
    | "ready"
    | "disabled"
    | "invalid-mode"
    | "missing-provider"
    | "missing-test-recipient";
};

export type TransactionalEmailInput = {
  to: string;
  subject: string;
  text: string;
  idempotencyKey: string;
};

type SendOptions = {
  env?: EmailEnvironment;
  fetcher?: EmailFetcher;
  signal?: AbortSignal;
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

export async function sendTransactionalEmail(
  input: TransactionalEmailInput,
  options: SendOptions = {}
) {
  const env = options.env ?? process.env;
  const configuration = getTransactionalEmailConfiguration(env);
  if (!configuration.enabled) {
    return { status: "disabled" as const, mode: configuration.mode };
  }

  const from = (env.MAIL_FROM || env.EMAIL_FROM)!.trim();
  const intendedRecipient = input.to.trim().toLowerCase();
  if (!hasAddress(intendedRecipient)) throw new Error("EMAIL_RECIPIENT_INVALID");

  const testMode = configuration.mode === "test";
  const recipient = testMode
    ? env.EMAIL_TEST_RECIPIENT!.trim().toLowerCase()
    : intendedRecipient;
  const subject = safeHeader(
    testMode ? `[TEST → ${intendedRecipient}] ${input.subject}` : input.subject,
    180
  );
  const text = testMode
    ? `Message de recette TutelLiv destiné à ${intendedRecipient}.\n\n${input.text}`
    : input.text;
  const idempotencyKey = safeHeader(
    input.idempotencyKey,
    EMAIL_IDEMPOTENCY_KEY_MAX
  );
  if (!subject || !text.trim() || !idempotencyKey) {
    throw new Error("EMAIL_CONTENT_INVALID");
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
      }),
      signal: options.signal ?? AbortSignal.timeout(EMAIL_TIMEOUT_MS),
    }
  );
  if (!response.ok) {
    throw new Error(`EMAIL_PROVIDER_HTTP_${response.status}`);
  }
  return {
    status: "sent" as const,
    mode: configuration.mode,
    recipient,
  };
}
