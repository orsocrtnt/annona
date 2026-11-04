import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  ingestWhatsAppWebhook,
  isWhatsAppConfigured,
  verifyWhatsAppSignature,
  whatsappMessages,
  whatsappPhone,
  whatsappSubscribeChallenge,
} from "../src/domains/order-intake/whatsapp.service";

const ENV = {
  WHATSAPP_APP_SECRET: "app-secret",
  WHATSAPP_VERIFY_TOKEN: "verify-me",
  WHATSAPP_PHONE_NUMBER_ID: "111",
  WHATSAPP_DISPLAY_NUMBER: "+33 1 00 00 00 00",
};
const NOW = new Date("2026-11-04T10:00:00.000Z");

function event(messages: unknown[], phoneNumberId = "111", extra: Record<string, unknown> = {}) {
  return {
    object: "whatsapp_business_account",
    entry: [{ id: "waba", changes: [{ field: "messages", value: { messaging_product: "whatsapp", metadata: { phone_number_id: phoneNumberId }, messages, ...extra } }] }],
  };
}
const text = (id: string, from: string, body: string, forwarded = true) =>
  ({ id, from, type: "text", text: { body }, ...(forwarded ? { context: { forwarded: true } } : {}) });

/** Base factice : membres de l'équipe (numéro normalisé → entreprise) et réglage WhatsApp par entreprise. */
function fakeDb(members: Array<{ id: string; company_id: string; phone: string }>, enabled: Record<string, boolean>) {
  return {
    $queryRaw: async (_strings: TemplateStringsArray, phone: string) => members.filter((member) => member.phone === phone),
    companyIntakeChannel: {
      findUnique: async ({ where }: { where: { companyId: string } }) =>
        where.companyId in enabled ? { whatsappEnabled: enabled[where.companyId] } : null,
    },
  };
}

test("WHATSAPP-1 : signature Meta vérifiée sur le corps brut", () => {
  const body = JSON.stringify(event([text("m1", "33612345678", "2 colis")]));
  const good = `sha256=${createHmac("sha256", "app-secret").update(body).digest("hex")}`;
  assert.equal(verifyWhatsAppSignature(body, good, "app-secret"), true);
  assert.equal(verifyWhatsAppSignature(`${body} `, good, "app-secret"), false);
  assert.equal(verifyWhatsAppSignature(body, good, "autre"), false);
  assert.equal(verifyWhatsAppSignature(body, good, ""), false);
  assert.equal(verifyWhatsAppSignature(body, null, "app-secret"), false);
  assert.equal(verifyWhatsAppSignature(body, "sha256=zz", "app-secret"), false);
  assert.equal(verifyWhatsAppSignature(body, good.replace("sha256=", "sha1="), "app-secret"), false);
});

test("WHATSAPP-1 : abonnement du webhook seulement avec le bon jeton", () => {
  const params = (token: string, challenge = "1158201444") =>
    new URLSearchParams({ "hub.mode": "subscribe", "hub.verify_token": token, "hub.challenge": challenge });
  assert.equal(whatsappSubscribeChallenge(params("verify-me"), "verify-me"), "1158201444");
  assert.equal(whatsappSubscribeChallenge(params("mauvais"), "verify-me"), null);
  assert.equal(whatsappSubscribeChallenge(params(""), ""), null);
  assert.equal(whatsappSubscribeChallenge(params("verify-me", "<script>"), "verify-me"), null);
  assert.equal(whatsappSubscribeChallenge(new URLSearchParams({ "hub.verify_token": "verify-me", "hub.challenge": "1" }), "verify-me"), null);
});

test("WHATSAPP-1 : configuration complète exigée", () => {
  assert.equal(isWhatsAppConfigured(ENV), true);
  assert.equal(isWhatsAppConfigured({ ...ENV, WHATSAPP_APP_SECRET: " " }), false);
  assert.equal(isWhatsAppConfigured({ ...ENV, WHATSAPP_DISPLAY_NUMBER: undefined }), false);
});

test("WHATSAPP-1 : numéro WhatsApp ramené au format des profils", () => {
  assert.equal(whatsappPhone("33612345678"), "0612345678");
  assert.equal(whatsappPhone("447911123456"), "447911123456");
  assert.equal(whatsappPhone("123"), null);
});

test("WHATSAPP-1 : lecture des messages, accusés et réactions écartés, légende d'une photo gardée", () => {
  const messages = whatsappMessages(event([
    text("m1", "33612345678", "  3 colis demain  "),
    { id: "m2", from: "33612345678", type: "image", image: { id: "media", caption: "Pour Rivoli" } },
    { id: "m3", from: "33612345678", type: "audio", audio: { id: "media" } },
    { id: "m4", from: "33612345678", type: "reaction", reaction: { emoji: "👍" } },
    { id: "", from: "33612345678", type: "text", text: { body: "sans id" } },
  ], "111", { statuses: [{ id: "s1", status: "read" }] }));
  assert.deepEqual(messages.map((message) => [message.messageId, message.text, message.hasMedia, message.forwarded]), [
    ["m1", "3 colis demain", false, true],
    ["m2", "Pour Rivoli", true, false],
    ["m3", "", true, false],
  ]);
  assert.deepEqual(whatsappMessages({ object: "page", entry: [] }), []);
  assert.deepEqual(whatsappMessages(null), []);
  assert.deepEqual(whatsappMessages(event([text("m5", "33612345678", "x")]).entry[0]), []);
});

test("WHATSAPP-1 : rangé dans l'entreprise du membre qui transfère, si elle a activé WhatsApp", async () => {
  const queued: Array<{ companyId: string; message: Record<string, unknown> }> = [];
  const queue = async (companyId: string, message: Record<string, unknown>) => {
    queued.push({ companyId, message });
    return "stored" as const;
  };
  const db = fakeDb([
    { id: "dispatch-a", company_id: "company-a", phone: "0612345678" },
    { id: "dispatch-b", company_id: "company-b", phone: "0699999999" },
    { id: "twin-a", company_id: "company-a", phone: "0700000000" },
    { id: "twin-c", company_id: "company-c", phone: "0700000000" },
  ], { "company-a": true, "company-b": false });

  const summary = await ingestWhatsAppWebhook(event([
    text("m1", "33612345678", "2 colis rue de Rivoli demain"),
    text("m2", "33699999999", "Entreprise B, WhatsApp désactivé"),
    text("m3", "33611111111", "Numéro inconnu"),
    text("m4", "33700000000", "Numéro inscrit dans deux entreprises"),
  ]), { env: ENV, now: NOW, db: db as never, queue: queue as never });

  assert.deepEqual(summary, { stored: 1, duplicate: 0, ignored: 3, over_limit: 0 });
  assert.deepEqual(queued, [{
    companyId: "company-a",
    message: {
      providerEmailId: "whatsapp:m1",
      channel: "WHATSAPP",
      fromAddress: "+33612345678",
      subject: "",
      bodyText: "2 colis rue de Rivoli demain",
      attachmentCount: 0,
    },
  }]);

  // Option B pas encore branchée : un autre numéro Meta que celui de TutelLiv est ignoré.
  const other = await ingestWhatsAppWebhook(event([text("m5", "33612345678", "x")], "222"), { env: ENV, now: NOW, db: db as never, queue: queue as never });
  assert.equal(other.ignored, 1);
  // Sans configuration, rien n'est rangé.
  const off = await ingestWhatsAppWebhook(event([text("m6", "33612345678", "x")]), { env: {}, now: NOW, db: db as never, queue: queue as never });
  assert.equal(off.ignored, 1);
  assert.equal(queued.length, 1);
});

test("WHATSAPP-1 : le numéro de l'équipe n'est jamais pris pour le client ni pour le destinataire de la confirmation", () => {
  const source = readFileSync("src/domains/order-intake/inbound-email.service.ts", "utf8");
  assert.match(source, /matchCustomerFromText: true/);
  assert.match(source, /email\.channel === "WHATSAPP"\) return null;/);
  const ui = readFileSync("src/features/back-office/order-intake/order-intake-content.tsx", "utf8");
  assert.match(ui, /teamForward \? null : email\.fromAddress/);
  const route = readFileSync("src/app/api/webhooks/whatsapp/route.ts", "utf8");
  assert.match(route, /verifyWhatsAppSignature\(body, request\.headers\.get\("x-hub-signature-256"\)/);
});
