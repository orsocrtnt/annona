import assert from "node:assert/strict";
import test from "node:test";
import {
  emailSendOutcome,
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

test("C4 : refus HTTP explicite du fournisseur = certain ; expiration, réseau ou erreur inconnue = issue inconnue", async () => {
  const input = { to: "client@example.test", subject: "Rappel", text: "Texte", idempotencyKey: "invoice-reminder:r1" };
  const failure = async (fetcher: Parameters<typeof sendTransactionalEmail>[1] extends infer O ? O extends { fetcher?: infer F } ? F : never : never) =>
    sendTransactionalEmail(input, { env: baseEnv, fetcher }).then(() => assert.fail("doit échouer"), (error: unknown) => error);

  for (const status of [400, 422, 429, 500, 503]) {
    const error = await failure(async () => ({ ok: false, status }));
    assert.equal((error as Error).message, `EMAIL_PROVIDER_HTTP_${status}`);
    assert.equal(emailSendOutcome(error), "rejected", String(status));
  }
  const timeout = Object.assign(new Error("The operation was aborted due to timeout"), { name: "TimeoutError" });
  for (const thrown of [timeout, new TypeError("fetch failed")]) {
    const error = await failure(async () => { throw thrown; });
    assert.equal(emailSendOutcome(error), "unknown", (thrown as Error).name);
  }
  // Toute erreur non qualifiée (réponse illisible, bogue) reste une issue inconnue : jamais libérée.
  assert.equal(emailSendOutcome(new Error("inattendue")), "unknown");
  assert.equal(emailSendOutcome("texte"), "unknown");
});

