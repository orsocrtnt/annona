import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  dbSafeText,
  forwardedSender,
  gmailApprovalLink,
  listForwardingConfirmations,
  gmailForwardingConfirmation,
  htmlToText,
  inboundAnalysisUpdate,
  inboundSkipReason,
  inboundTokenFromRecipients,
  senderAddress,
  verifyInboundWebhook,
} from "../src/domains/order-intake/inbound-email.service";
import { publicOrderSchema } from "../src/domains/public-order/public-order.service";
import { isInboundEmailConfigured } from "../src/domains/public-order/intake-channels.service";
import { isCrossOriginMutation } from "../src/lib/security/origin-check";
import { senderHeader, sendTransactionalEmail } from "../src/lib/email/transactional-email";

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
  const domain = "commandes.annona.fr";
  assert.equal(inboundTokenFromRecipients([`${token}@${domain}`], domain), token);
  assert.equal(inboundTokenFromRecipients([`Commandes <${token.toUpperCase()}@COMMANDES.annona.fr>`], domain), token);
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
  const post = (path: string) => new Request(`https://annona.fr${path}`, { method: "POST", headers: { origin: "https://pirate.example" } });
  assert.equal(isCrossOriginMutation(post("/api/webhooks/inbound-email"), { appUrl: "https://annona.fr" }), false);
  assert.equal(isCrossOriginMutation(post("/api/public/orders/abc"), { appUrl: "https://annona.fr" }), true);
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

test("MAIL-PONT : seul un e-mail reconnu comme commande devient « Brouillon prêt »", () => {
  const base = { referenceDate: "2026-11-03", missingFields: [], uncertainFields: [] } as never;
  const order = inboundAnalysisUpdate({ status: "ok", draft: { ...(base as object), kind: "order" } as never });
  assert.equal(order.status, "ANALYZED");
  assert.equal(order.analysisError, null);
  const other = inboundAnalysisUpdate({ status: "ok", draft: { ...(base as object), kind: "other", kindReason: "Remerciement" } as never });
  assert.equal(other.status, "NOT_ORDER");
  assert.equal(other.analysisError, "not_order");
  assert.ok("draft" in other && other.draft, "brouillon gardé pour « C'est une commande »");
  const legacy = inboundAnalysisUpdate({ status: "ok", draft: base });
  assert.equal(legacy.status, "ANALYZED", "brouillon d'avant le tri : lu comme une commande");
  const failed = inboundAnalysisUpdate({ status: "invalid_output" });
  assert.deepEqual(failed, { status: "ANALYSIS_FAILED", analysisError: "invalid_output" });
});

test("MAIL-PONT : un e-mail sans texte n'est pas envoyé au modèle", () => {
  assert.equal(inboundSkipReason({ subject: "Bon de commande", bodyText: "  ", attachmentCount: 2 }), "attachments_only");
  assert.equal(inboundSkipReason({ subject: "", bodyText: "", attachmentCount: 0 }), "empty");
  assert.equal(inboundSkipReason({ subject: "3 colis rue de Rivoli demain", bodyText: "", attachmentCount: 0 }), null, "objet seul : analysé");
  assert.equal(inboundSkipReason({ subject: "", bodyText: "2 plis", attachmentCount: 1 }), null, "texte et pièce jointe : analysé");
});

test("MAIL-PONT : client retrouvé dans un e-mail transféré à la main (Gmail, Outlook, Apple Mail)", () => {
  const team = "dispatch@transport.test";
  const gmail = "Voir ci-dessous\n\n---------- Forwarded message ---------\nFrom: Sophie Martin <Sophie.Martin@client.test>\nDate: Mon, 3 Nov 2026\nSubject: Livraison\n\n2 palettes demain";
  assert.equal(forwardedSender(gmail, team), "sophie.martin@client.test");
  const outlook = "________________________________\nDe : Cabinet Martin <compta@cabinet-martin.test>\nEnvoyé : lundi 3 novembre 2026 09:12\nÀ : commandes@transport.test";
  assert.equal(forwardedSender(outlook, team), "compta@cabinet-martin.test");
  const apple = "Début du message réexpédité :\n\n> De: achats@boutique.test\n> Objet: course";
  assert.equal(forwardedSender(apple, team), "achats@boutique.test");
  const french = "-------- Message transféré --------\nExpéditeur : Paul <paul@client.test>";
  assert.equal(forwardedSender(french, team), "paul@client.test");
  assert.equal(forwardedSender("De : Dispatch <dispatch@transport.test>", team), null, "l'équipe elle-même");
  assert.equal(forwardedSender("2 plis de Rivoli à la Défense", team), null, "aucun bloc cité");
  assert.equal(forwardedSender("De : Sophie Martin", team), null, "nom sans adresse");
  const twice = "From: Dernier <dernier@client.test>\n...\nFrom: Ancien <ancien@client.test>";
  assert.equal(forwardedSender(twice, team), "dernier@client.test", "premier bloc cité = dernier transfert");
});

test("MAIL-PONT : code de confirmation Gmail reconnu, jamais pour un autre expéditeur", () => {
  const google = "forwarding-noreply@google.com";
  assert.deepEqual(
    gmailForwardingConfirmation(google, "(#123456789) Gmail Forwarding Confirmation - Receive Mail from Commandes.Transport@gmail.com", "Confirmation code: 123456789"),
    { code: "123456789", link: null, requester: "commandes.transport@gmail.com" }
  );
  assert.deepEqual(
    gmailForwardingConfirmation(google, "Confirmation de transfert Gmail", "commandes@transport.test a demandé le transfert. Code de confirmation : 987654321"),
    { code: "987654321", link: null, requester: "commandes@transport.test" }
  );
  assert.equal(gmailForwardingConfirmation("pirate@exemple.test", "(#123456789) Gmail Forwarding Confirmation", ""), null, "autre expéditeur");
  assert.equal(gmailForwardingConfirmation(google, "Gmail Forwarding Confirmation", "pas de code"), null);
});

test("MAIL-PONT : format Gmail de novembre 2026, lien d'approbation sans code, seulement vers Google", () => {
  const google = "forwarding-noreply@google.com";
  // Texte relevé le 4 novembre 2026 sur un vrai renvoi (adresses et jeton remplacés).
  const subject = "(Gmail) Confirmation de transfert – Recevez les messages de commandes.transport@gmail.com";
  const body = [
    "commandes.transport@gmail.com a demandé à transférer automatiquement ses",
    "messages vers votre adresse e-mail",
    "(0123456789abcdef0123456789abcdef@commandes.annona.fr).",
    "",
    "Pour autoriser commandes.transport@gmail.com à transférer ses messages vers",
    "votre adresse e-mail, veuillez cliquer sur le lien ci-dessous pour",
    "approuver la demande :",
    "",
    "https://mail-settings.google.com/mail/vf-%5BJETON-FICTIF_abc-123%5D-3GhXbD",
    "",
    "Si le lien ne fonctionne pas, veuillez le copier et le coller dans une",
    "nouvelle fenêtre de navigateur.",
  ].join("\n");
  assert.deepEqual(gmailForwardingConfirmation(google, subject, body), {
    code: null,
    link: "https://mail-settings.google.com/mail/vf-%5BJETON-FICTIF_abc-123%5D-3GhXbD",
    requester: "commandes.transport@gmail.com",
  });
  const fake = body.replace("https://mail-settings.google.com/mail/", "https://mail-settings.google.com.pirate.test/mail/");
  assert.equal(gmailForwardingConfirmation(google, subject, fake), null, "autre site : ni lien ni code");
  assert.equal(gmailApprovalLink("http://mail.google.com/mail/vf-x"), null, "http refusé");
  assert.equal(gmailApprovalLink("https://user@mail.google.com/mail/vf-x"), null, "identifiants refusés");
  assert.equal(gmailApprovalLink("https://mail.google.com/autre"), null, "autre chemin refusé");
  assert.equal(gmailApprovalLink("https://mail.google.com/mail/vf-x"), "https://mail.google.com/mail/vf-x");
});

test("MAIL-PONT : la confirmation porte « répondre à » vers la boîte de commandes, jamais une valeur invalide", async () => {
  const env = { EMAIL_DELIVERY_MODE: "live", RESEND_API_KEY: "cle-de-test", MAIL_FROM: "Annona <no-reply@example.test>" };
  const bodies: Array<Record<string, unknown>> = [];
  const fetcher = (async (_url: string, init: { body: string }) => {
    bodies.push(JSON.parse(init.body));
    return { ok: true, status: 200, json: async () => ({ id: "email_1" }), text: async () => "{}" };
  }) as unknown as typeof fetch;
  const base = { to: "client@exemple.test", subject: "Commande confirmée", text: "Bonjour", replayWindowStart: null };
  await sendTransactionalEmail({ ...base, idempotencyKey: "k1", replyTo: " Commandes@Transport.test " }, { env, fetcher, now: NOW });
  await sendTransactionalEmail({ ...base, idempotencyKey: "k2", replyTo: "pas une adresse" }, { env, fetcher, now: NOW });
  await sendTransactionalEmail({ ...base, idempotencyKey: "k3" }, { env, fetcher, now: NOW });
  assert.deepEqual(bodies[0]!.reply_to, ["commandes@transport.test"]);
  assert.equal("reply_to" in bodies[1]!, false);
  assert.equal("reply_to" in bodies[2]!, false);
  // Essai réel du 4 novembre : le pied ne doit plus dire « ne pas répondre » quand on peut répondre.
  assert.match(String(bodies[0]!.html), /Votre réponse lui parvient directement/);
  assert.doesNotMatch(String(bodies[0]!.html), /Merci de ne pas répondre/);
  assert.match(String(bodies[2]!.html), /Merci de ne pas répondre/);
  assert.equal(bodies[0]!.from, "Annona <no-reply@example.test>", "sans nom d'entreprise : MAIL_FROM inchangé");
  await sendTransactionalEmail({ ...base, idempotencyKey: "k4", senderName: "LogiExpress Démo" }, { env, fetcher, now: NOW });
  assert.equal(bodies[3]!.from, '"LogiExpress Démo via Annona" <no-reply@example.test>');
});

test("e-mails au nom de Annona : « répondre à » orso@annona.fr, jamais à la place de l'entreprise", async () => {
  const env = { EMAIL_DELIVERY_MODE: "live", RESEND_API_KEY: "cle-de-test", MAIL_FROM: "Annona <no-reply@example.test>" };
  const bodies: Array<Record<string, unknown>> = [];
  const fetcher = (async (_url: string, init: { body: string }) => {
    bodies.push(JSON.parse(init.body));
    return { ok: true, status: 200, json: async () => ({ id: "email_1" }), text: async () => "{}" };
  }) as unknown as typeof fetch;
  const base = { to: "gerant@exemple.test", subject: "Bienvenue sur Annona", text: "Bonjour", replayWindowStart: null };
  await sendTransactionalEmail({ ...base, idempotencyKey: "t1", fromAnnona: true }, { env, fetcher, now: NOW });
  await sendTransactionalEmail({ ...base, idempotencyKey: "t2", fromAnnona: true, replyTo: "commandes@transport.test" }, { env, fetcher, now: NOW });
  assert.deepEqual(bodies[0]!.reply_to, ["orso@annona.fr"]);
  assert.match(String(bodies[0]!.html), /Une question \? Répondez simplement à cet e-mail/);
  assert.doesNotMatch(String(bodies[0]!.html), /Merci de ne pas répondre|pour le compte de l&#39;entreprise/);
  assert.deepEqual(bodies[1]!.reply_to, ["commandes@transport.test"], "une adresse explicite reste prioritaire");
});

test("MAIL-PONT : nom d'expéditeur « Entreprise via Annona » nettoyé, jamais une autre adresse", () => {
  assert.equal(senderHeader("Annona <no-reply@annona.fr>", "Transports \"Rapides\" <pirate@x.test>\r\nBcc: y@x.test"), '"Transports Rapides pirate@x.test Bcc y@x.test via Annona" <no-reply@annona.fr>');
  assert.equal(senderHeader("no-reply@annona.fr", "Durand & Fils"), '"Durand & Fils via Annona" <no-reply@annona.fr>');
  assert.equal(senderHeader("Annona <no-reply@annona.fr>", "  "), "Annona <no-reply@annona.fr>");
  assert.equal(senderHeader("Annona <no-reply@annona.fr>", null), "Annona <no-reply@annona.fr>");
});

test("MAIL-PONT : la demande Gmail n'est plus affichée dès qu'un e-mail ordinaire arrive après elle", async () => {
  const at = (minutes: number) => new Date(Date.UTC(2026, 10, 4, 1, minutes));
  const confirmation = { bodyText: JSON.stringify({ code: null, link: "https://mail.google.com/mail/vf-x", requester: "a@gmail.com" }), createdAt: at(20) };
  const db = (later: Date | null) => ({
    inboundOrderEmail: {
      findMany: async () => [confirmation],
      findFirst: async ({ where }: { where: { createdAt: { gt: Date }; fromAddress: { not: string } } }) => {
        assert.equal(where.fromAddress.not, "forwarding-noreply@google.com");
        return later && later > where.createdAt.gt ? { createdAt: later } : null;
      },
    },
  });
  const now = at(30);
  assert.equal((await listForwardingConfirmations("company-a", now, db(null) as never)).length, 1, "rien reçu depuis");
  assert.equal((await listForwardingConfirmations("company-a", now, db(at(10)) as never)).length, 1, "e-mail plus ancien");
  assert.deepEqual(await listForwardingConfirmations("company-a", now, db(at(25)) as never), [], "renvoi prouvé");
});

