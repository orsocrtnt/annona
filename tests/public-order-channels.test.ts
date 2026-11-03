import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  dbSafeText,
  htmlToText,
  inboundTokenFromRecipients,
  senderAddress,
  verifyInboundWebhook,
} from "../src/domains/order-intake/inbound-email.service";
import { publicOrderSchema } from "../src/domains/public-order/public-order.service";
import { isInboundEmailConfigured } from "../src/domains/public-order/intake-channels.service";
import { isCrossOriginMutation } from "../src/lib/security/origin-check";

const SECRET = `whsec_${Buffer.from("secret-de-test").toString("base64")}`;
const NOW = new Date("2026-10-30T12:00:00Z");
const TS = String(Math.floor(NOW.getTime() / 1000));

function sign(body: string, id = "msg_1", timestamp = TS) {
  const value = createHmac("sha256", Buffer.from("secret-de-test")).update(`${id}.${timestamp}.${body}`).digest("base64");
  return `v1,${value}`;
}

test("webhook : seule une signature exacte et récente est acceptée", () => {
  const body = '{"type":"email.received"}';
  const ok = { id: "msg_1", timestamp: TS, signature: sign(body) };
  assert.equal(verifyInboundWebhook(body, ok, SECRET, NOW), true);
  assert.equal(verifyInboundWebhook(`${body} `, ok, SECRET, NOW), false, "corps modifié");
  assert.equal(verifyInboundWebhook(body, { ...ok, id: "msg_2" }, SECRET, NOW), false, "autre identifiant");
  assert.equal(verifyInboundWebhook(body, ok, "whsec_YXV0cmU=", NOW), false, "autre secret");
  assert.equal(verifyInboundWebhook(body, ok, "", NOW), false, "secret absent : tout est refusé");
  assert.equal(verifyInboundWebhook(body, { ...ok, signature: null }, SECRET, NOW), false);
  assert.equal(verifyInboundWebhook(body, ok, SECRET, new Date(NOW.getTime() + 6 * 60_000)), false, "rejeu tardif");
  assert.equal(verifyInboundWebhook(body, { ...ok, signature: `v1,abc ${ok.signature}` }, SECRET, NOW), true, "plusieurs signatures");
});

test("réception : le jeton vient de l'adresse du bon domaine, sans confusion", () => {
  const token = "0123456789abcdef0123456789abcdef";
  const domain = "commandes.tutelliv.fr";
  assert.equal(inboundTokenFromRecipients([`${token}@${domain}`], domain), token);
  assert.equal(inboundTokenFromRecipients([`Commandes <${token.toUpperCase()}@COMMANDES.tutelliv.fr>`], domain), token);
  assert.equal(inboundTokenFromRecipients([`${token}@ailleurs.fr`], domain), null, "autre domaine");
  assert.equal(inboundTokenFromRecipients([`court@${domain}`], domain), null, "jeton mal formé");
  assert.equal(inboundTokenFromRecipients([42, null], domain), null);
  assert.equal(senderAddress("Mme Durand <Contact@Client.fr>"), "contact@client.fr");
});

test("réception : le HTML devient du texte, scripts et styles retirés", () => {
  const text = htmlToText("<style>p{}</style><p>2 plis &amp; 1 carton</p><script>alert(1)</script><div>avant 15h</div>");
  assert.match(text, /2 plis & 1 carton/);
  assert.match(text, /avant 15h/);
  assert.doesNotMatch(text, /alert|<|p\{/);
});

test("réception : caractère nul et émoji coupé nettoyés avant l'écriture en base (Postgres 22021)", () => {
  assert.equal(dbSafeText("2 plis\u0000 avant 15h", 100), "2 plis avant 15h");
  assert.equal(dbSafeText("colis \uD83D fragile", 100), "colis \uFFFD fragile", "moitié haute isolée");
  assert.equal(dbSafeText("colis \uDCE6", 100), "colis \uFFFD", "moitié basse isolée");
  assert.equal(dbSafeText("ok 📦", 100), "ok 📦", "émoji entier gardé");
  assert.equal(dbSafeText("abc📦", 4), "abc\uFFFD", "coupe au milieu d'un émoji");
  assert.equal(senderAddress("Client\u0000 <a\u0000@client.fr>"), "a@client.fr");
  for (const value of [dbSafeText("x\uD800y\u0000", 100), dbSafeText("📦".repeat(5), 7)]) {
    assert.doesNotMatch(value, /\u0000|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/);
  }
});

test("réception : non configurée tant qu'il manque domaine, secret ou clé", () => {
  const env = { INBOUND_EMAIL_DOMAIN: "c.fr", RESEND_INBOUND_WEBHOOK_SECRET: "s", RESEND_API_KEY: "k" };
  assert.equal(isInboundEmailConfigured(env), true);
  for (const key of Object.keys(env)) assert.equal(isInboundEmailConfigured({ ...env, [key]: " " }), false, key);
});

test("le webhook échappe seul au contrôle d'origine", () => {
  const post = (path: string) => new Request(`https://tutelliv.fr${path}`, { method: "POST", headers: { origin: "https://pirate.example" } });
  assert.equal(isCrossOriginMutation(post("/api/webhooks/inbound-email"), { appUrl: "https://tutelliv.fr" }), false);
  assert.equal(isCrossOriginMutation(post("/api/public/orders/abc"), { appUrl: "https://tutelliv.fr" }), true);
});

const VALID = {
  idempotencyKey: "public-12345678",
  name: "Mme Durand",
  email: "Contact@Client.fr",
  phone: "06 12 34 56 78",
  pickup: { address: "1 rue de Rivoli", city: "Paris", postalCode: "75001" },
  delivery: { address: "2 place de la Défense", city: "Puteaux", postalCode: "92800" },
  quantity: 2,
  requestedDeliveryDate: "2026-11-03",
};

test("commande publique : champs stricts, le client ne choisit ni entreprise ni statut", () => {
  const parsed = publicOrderSchema.safeParse(VALID);
  assert.equal(parsed.success, true);
  assert.equal(parsed.data?.email, "contact@client.fr");
  for (const extra of [{ companyId: "x" }, { customerId: "x" }, { source: "ADMIN" }, { totalAmount: 0 }]) {
    assert.equal(publicOrderSchema.safeParse({ ...VALID, ...extra }).success, false, JSON.stringify(extra));
  }
  assert.equal(publicOrderSchema.safeParse({ ...VALID, email: "pas-un-mail" }).success, false);
  assert.equal(publicOrderSchema.safeParse({ ...VALID, quantity: 0 }).success, false);
  assert.equal(publicOrderSchema.safeParse({ ...VALID, requestedDeliveryDate: "demain" }).success, false);
});

test("sources : anonyme sans identité ni auto-dispatch, suivi sans données sensibles", () => {
  const service = readFileSync("src/domains/public-order/public-order.service.ts", "utf8");
  assert.match(service, /createOrder\(\s*null,\s*companyId,\s*null,/, "ni client ni customerEmail");
  assert.match(service, /skipAutoDispatch: true/);
  const tracking = service.slice(service.indexOf("export async function getPublicTracking"), service.indexOf("export async function getOrCreateTrackingLink"));
  for (const forbidden of ["driver", "shippingAddress", "pickupAddress", "notes", "proof", "guestEmail", "totalAmount"]) {
    assert.equal(tracking.includes(forbidden), false, forbidden);
  }
  assert.match(tracking, /\.map\(\(\{ id, label, occurredAt \}\)/, "le détail des étapes n'est pas exposé");
});
