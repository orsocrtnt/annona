import assert from "node:assert/strict";
import test from "node:test";
import {
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

test("un mode désactivé n'appelle jamais le fournisseur", async () => {
  let calls = 0;
  const result = await sendTransactionalEmail(
    {
      to: "client@example.test",
      subject: "Test",
      text: "Test",
      idempotencyKey: "disabled:1",
    },
    {
      env: { ...baseEnv, EMAIL_DELIVERY_MODE: "disabled" },
      fetcher: async () => {
        calls += 1;
        return { ok: true, status: 200 };
      },
    }
  );
  assert.deepEqual(result, { status: "disabled", mode: "disabled" });
  assert.equal(calls, 0);
});
