import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyProviderResponse,
  emailSendOutcome,
  isIdempotentReplaySafe,
  getTransactionalEmailConfiguration,
  sendTransactionalEmail,
} from "../src/lib/email/transactional-email";

const baseEnv = {
  EMAIL_DELIVERY_MODE: "test",
  EMAIL_TEST_RECIPIENT: "owner@example.test",
  RESEND_API_KEY: "test-key",
  MAIL_FROM: "TutelLiv <no-reply@example.test>",
  EMAIL_FROM: undefined,
};

test("le transport reste désactivé par défaut et refuse les configurations partielles", () => {
  assert.deepEqual(getTransactionalEmailConfiguration({}), {
    mode: "disabled",
    enabled: false,
    reason: "disabled",
  });
  assert.equal(
    getTransactionalEmailConfiguration({
      ...baseEnv,
      EMAIL_DELIVERY_MODE: "unexpected",
    }).reason,
    "invalid-mode"
  );
  assert.equal(
    getTransactionalEmailConfiguration({
      ...baseEnv,
      RESEND_API_KEY: "",
    }).reason,
    "missing-provider"
  );
  assert.equal(
    getTransactionalEmailConfiguration({
      ...baseEnv,
      EMAIL_TEST_RECIPIENT: "",
    }).reason,
    "missing-test-recipient"
  );
});

test("le mode test redirige vers une seule boîte sans perdre le destinataire prévu", async () => {
  const calls: Array<{ headers: HeadersInit; body: string }> = [];
  const result = await sendTransactionalEmail(
    {
      to: "Client@Example.test",
      subject: "Livraison effectuée\r\nBcc: hidden@example.test",
      text: "La livraison est terminée.",
      idempotencyKey: "delivery:test:1",
      replayWindowStart: null,
    },
    {
      env: baseEnv,
      signal: new AbortController().signal,
      fetcher: async (_url, init) => {
        calls.push({
          headers: init?.headers ?? {},
          body: String(init?.body),
        });
        return { ok: true, status: 200 };
      },
    }
  );

  assert.deepEqual(result, {
    status: "sent",
    mode: "test",
    recipient: "owner@example.test",
  });
  assert.equal(calls.length, 1);
  const body = JSON.parse(calls[0]!.body);
  assert.deepEqual(body.to, ["owner@example.test"]);
  assert.match(body.subject, /^\[TEST → client@example\.test\]/);
  assert.ok(!body.subject.includes("\n"));
  assert.match(body.text, /destiné à client@example\.test/);
  assert.equal(
    (calls[0]!.headers as Record<string, string>)["Idempotency-Key"],
    "delivery:test:1"
  );
});

test("le mode live conserve le destinataire et remonte un échec rejouable sans contenu", async () => {
  const env = { ...baseEnv, EMAIL_DELIVERY_MODE: "live" };
  let sentBody = "";
  await assert.rejects(
    sendTransactionalEmail(
      {
        to: "client@example.test",
        subject: "Facture disponible",
        text: "Contenu sensible non journalisé",
        idempotencyKey: "invoice:test:1",
        replayWindowStart: null,
      },
      {
        env,
        signal: new AbortController().signal,
        fetcher: async (_url, init) => {
          sentBody = String(init?.body);
          return { ok: false, status: 503 };
        },
      }
    ),
    (error: unknown) => {
      assert.equal((error as Error).message, "EMAIL_PROVIDER_HTTP_503");
      assert.ok(!(error as Error).message.includes("sensible"));
      return true;
    }
  );
  assert.deepEqual(JSON.parse(sentBody).to, ["client@example.test"]);
});

test("une panne fournisseur est visible, puis la reprise conserve la même clé", async () => {
  const calls: Array<Record<string, string>> = [];
  const input = {
    to: "client@example.test",
    subject: "Livraison effectuée",
    text: "La livraison est terminée.",
    idempotencyKey: "delivery:test:provider-retry",
    replayWindowStart: null,
  };
  let attempts = 0;
  const fetcher = async (_url: string | URL | Request, init?: RequestInit) => {
    attempts += 1;
    calls.push(init?.headers as Record<string, string>);
    return { ok: attempts > 1, status: attempts > 1 ? 200 : 503 };
  };

  await assert.rejects(
    sendTransactionalEmail(input, { env: baseEnv, fetcher }),
    /EMAIL_PROVIDER_HTTP_503/
  );
  assert.deepEqual(await sendTransactionalEmail(input, { env: baseEnv, fetcher }), {
    status: "sent",
    mode: "test",
    recipient: "owner@example.test",
  });
  assert.equal(calls.length, 2);
  assert.deepEqual(
    [...new Set(calls.map((headers) => headers["Idempotency-Key"]))],
    [input.idempotencyKey]
  );
});

test("un mode désactivé n'appelle jamais le fournisseur, même au rejeu", async () => {
  let calls = 0;
  const input = {
    to: "client@example.test",
    subject: "Test",
    text: "Test",
    idempotencyKey: "disabled:1",
    replayWindowStart: null,
  };
  const options = {
    env: { ...baseEnv, EMAIL_DELIVERY_MODE: "disabled" },
    fetcher: async () => {
      calls += 1;
      return { ok: true, status: 200 };
    },
  };
  assert.deepEqual(await sendTransactionalEmail(input, options), { status: "disabled", mode: "disabled" });
  assert.deepEqual(await sendTransactionalEmail(input, options), { status: "disabled", mode: "disabled" });
  assert.equal(calls, 0);
});

// C5 : table des issues, d'après https://resend.com/docs/api-reference/errors et
// https://resend.com/docs/dashboard/emails/idempotency-keys.
const resendError = (status: number, name?: string) => async () => ({
  ok: false,
  status,
  text: async () => (name ? JSON.stringify({ statusCode: status, message: "x", name }) : "<html>passerelle</html>"),
});

async function failureOf(fetcher: () => Promise<{ ok: boolean; status: number; text?: () => Promise<string> }>, extra: { replayWindowStart?: Date | null; now?: Date } = {}) {
  const input = { to: "client@example.test", subject: "Rappel", text: "Texte", idempotencyKey: "invoice-reminder:r1", replayWindowStart: extra.replayWindowStart ?? null };
  return sendTransactionalEmail(input, { env: baseEnv, fetcher, now: extra.now }).then(() => assert.fail("doit échouer"), (error: unknown) => error);
}

test("C5 : table code HTTP + name Resend → issue (rejected / unknown / unconfirmed)", async () => {
  const table: Array<[number, string | undefined, "rejected" | "unknown" | "unconfirmed", string]> = [
    [400, "validation_error", "rejected", "EMAIL_PROVIDER_HTTP_400:validation_error"],
    [400, "invalid_idempotency_key", "rejected", "EMAIL_PROVIDER_HTTP_400:invalid_idempotency_key"],
    [401, "missing_api_key", "rejected", "EMAIL_PROVIDER_HTTP_401:missing_api_key"],
    [403, "validation_error", "rejected", "EMAIL_PROVIDER_HTTP_403:validation_error"],
    [404, "not_found", "rejected", "EMAIL_PROVIDER_HTTP_404:not_found"],
    [405, "method_not_allowed", "rejected", "EMAIL_PROVIDER_HTTP_405:method_not_allowed"],
    [422, "missing_required_field", "rejected", "EMAIL_PROVIDER_HTTP_422:missing_required_field"],
    [429, "rate_limit_exceeded", "rejected", "EMAIL_PROVIDER_HTTP_429:rate_limit_exceeded"],
    [429, "daily_quota_exceeded", "rejected", "EMAIL_PROVIDER_HTTP_429:daily_quota_exceeded"],
    [409, "concurrent_idempotent_requests", "unknown", "EMAIL_PROVIDER_HTTP_409:concurrent_idempotent_requests"],
    [409, "invalid_idempotent_request", "unconfirmed", "EMAIL_PROVIDER_HTTP_409:invalid_idempotent_request"],
    [409, "resource_locked", "unknown", "EMAIL_PROVIDER_HTTP_409:resource_locked"],
    [409, undefined, "unknown", "EMAIL_PROVIDER_HTTP_409"],
    [500, "application_error", "unknown", "EMAIL_PROVIDER_HTTP_500:application_error"],
    [503, "service_unavailable", "unknown", "EMAIL_PROVIDER_HTTP_503:service_unavailable"],
    [502, undefined, "unknown", "EMAIL_PROVIDER_HTTP_502"],
    [451, "inattendu", "unknown", "EMAIL_PROVIDER_HTTP_451:inattendu"],
  ];
  for (const [status, name, outcome, message] of table) {
    const error = await failureOf(resendError(status, name));
    assert.equal((error as Error).message, message);
    assert.equal(emailSendOutcome(error), outcome, message);
    assert.equal(classifyProviderResponse(status, name ?? null), outcome, message);
    // Seule l'issue non confirmée est permanente pour une tâche durable (aucun nouvel essai).
    assert.equal((error as { permanent?: boolean }).permanent === true, outcome === "unconfirmed", message);
  }
  // Corps illisible ou `name` hors format : le code seul décide, jamais d'injection dans le message.
  const odd = await failureOf(async () => ({ ok: false, status: 409, text: async () => JSON.stringify({ name: "Bcc: x\r\n" }) }));
  assert.equal((odd as Error).message, "EMAIL_PROVIDER_HTTP_409");
  assert.equal(emailSendOutcome(odd), "unknown");
  const broken = await failureOf(async () => ({ ok: false, status: 500, text: async () => { throw new Error("flux coupé"); } }));
  assert.equal(emailSendOutcome(broken), "unknown");
});

test("C4/C5 : expiration, réseau ou erreur non qualifiée = issue inconnue ; le message seul ne vaut pas refus", async () => {
  const timeout = Object.assign(new Error("The operation was aborted due to timeout"), { name: "TimeoutError" });
  for (const thrown of [timeout, new TypeError("fetch failed")]) {
    const error = await failureOf(async () => { throw thrown; });
    assert.equal(emailSendOutcome(error), "unknown", (thrown as Error).name);
  }
  assert.equal(emailSendOutcome(new Error("inattendue")), "unknown");
  assert.equal(emailSendOutcome(new Error("EMAIL_PROVIDER_HTTP_422")), "unknown", "un message imité n'est pas un refus qualifié");
  assert.equal(emailSendOutcome({ emailOutcome: "rejected" }), "unknown", "seule une Error qualifiée compte");
  assert.equal(emailSendOutcome("texte"), "unknown");
});

test("C5 : fenêtre de déduplication — une reprise après 23 h n'appelle jamais le fournisseur", async () => {
  const start = new Date("2026-10-28T10:00:00.000Z");
  let calls = 0;
  const ok = async () => { calls += 1; return { ok: true, status: 200 }; };
  const input = { to: "client@example.test", subject: "Rappel", text: "Texte", idempotencyKey: "k", replayWindowStart: start };
  await sendTransactionalEmail(input, { env: baseEnv, fetcher: ok, now: new Date(start.getTime() + 22 * 3_600_000) });
  assert.equal(calls, 1, "dans la fenêtre : reprise permise");
  const expired = await sendTransactionalEmail(input, { env: baseEnv, fetcher: ok, now: new Date(start.getTime() + 23 * 3_600_000) })
    .then(() => assert.fail("doit refuser"), (error: unknown) => error);
  assert.equal((expired as Error).message, "EMAIL_IDEMPOTENCY_WINDOW_EXPIRED");
  assert.equal(emailSendOutcome(expired), "unconfirmed");
  assert.equal((expired as { permanent?: boolean }).permanent, true);
  assert.equal(calls, 1, "aucun appel au-delà");
  assert.equal(isIdempotentReplaySafe(null, new Date(start.getTime() + 1000 * 3_600_000)), true, "première tentative : pas de borne");
});

test("C5 : contrôles locaux avant tout appel = refus certain", async () => {
  const error = await sendTransactionalEmail(
    { to: "sans-arobase", subject: "S", text: "T", idempotencyKey: "k", replayWindowStart: null },
    { env: baseEnv, fetcher: async () => assert.fail("aucun appel") }
  ).then(() => assert.fail("doit échouer"), (e: unknown) => e);
  assert.equal(emailSendOutcome(error), "rejected");
});
