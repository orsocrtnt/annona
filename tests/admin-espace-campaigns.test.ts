import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  FUNNEL_CAMPAIGN_PATTERN,
  createFunnelSourceLimiter,
  isMailLinkTarget,
  mailLinkDestination,
  recordMailLinkClick,
  summarizeFunnel,
} from "../src/domains/growth/waitlist-funnel.service";
import {
  PROSPECT_CODE_PREFIX,
  PROSPECT_MIN_INTERVAL_MS,
  PROSPECT_SEND_PACE_MS,
  PROSPECT_TEST_CODE,
  createProspectCampaignSchema,
  parseProspectAddresses,
  prospectAddressesSchema,
  prospectCampaignCode,
  prospectLinkBaseUrl,
  prospectRepliesSchema,
  prospectSendSchema,
  sendNextProspectEmail,
  sendProspectTestEmail,
  type ProspectSendRepository,
} from "../src/domains/growth/prospect/prospect-campaign.service";
import { PROSPECT_PREHEADER, prospectLinks, renderProspectEmail } from "../src/domains/growth/prospect/prospect-email";
import { describeMailerError, readProspectMailerConfig, type ProspectMailer } from "../src/domains/growth/prospect/prospect-mailer";
import { PROSPECT_LOGO_CID, PROSPECT_LOGO_PNG_BASE64 } from "../src/domains/growth/prospect/prospect-logo";
import { isProtectedPagePath } from "../src/lib/permissions/page-access";
import { adminNavItems } from "../src/features/navigation/nav-config";

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15";

test("lot 5 : code de campagne dérivé de la ville, accepté par le compteur", () => {
  assert.equal(prospectCampaignCode("Paris"), "il-en-est-ou-paris");
  assert.equal(prospectCampaignCode("Aix-en-Provence"), "il-en-est-ou-aix-en-provence");
  assert.equal(prospectCampaignCode("  Île-de-France  "), "il-en-est-ou-ile-de-france");
  assert.equal(prospectCampaignCode("!!!"), "il-en-est-ou-ville");
  const long = prospectCampaignCode("Saint-Rémy-de-Provence et toute la région alentour");
  assert.ok(long.startsWith(PROSPECT_CODE_PREFIX));
  // Place gardée pour un suffixe « -99 » en cas de doublon, toujours dans le format du compteur.
  assert.ok(`${long}-99`.length <= 40, long);
  assert.match(`${long}-99`, FUNNEL_CAMPAIGN_PATTERN);
});

test("lot 5 : adresses collées nettoyées, dédoublonnées, invalides à part", () => {
  const { valid, invalid } = parseProspectAddresses(
    "Contact@Exemple.fr, contact@exemple.fr;\n<dispatch@coursiers.fr>  pas-une-adresse\n\n exploitation@livraison.fr"
  );
  assert.deepEqual(valid, ["contact@exemple.fr", "dispatch@coursiers.fr", "exploitation@livraison.fr"]);
  assert.deepEqual(invalid, ["pas-une-adresse"]);
});

test("lot 5 : corps stricts (champ inconnu refusé)", () => {
  assert.equal(createProspectCampaignSchema.safeParse({ name: "Il en est où ?", city: "Paris", addressSource: "Google Maps" }).success, true);
  assert.equal(createProspectCampaignSchema.safeParse({ name: "X", city: "Paris", addressSource: "Google Maps" }).success, false);
  assert.equal(createProspectCampaignSchema.safeParse({ name: "Nom", city: "Paris", addressSource: "Maps", extra: 1 }).success, false);
  assert.equal(prospectAddressesSchema.safeParse({ addresses: "a@b.fr", other: true }).success, false);
  assert.equal(prospectRepliesSchema.safeParse({ delta: 2 }).success, false);
  assert.equal(prospectSendSchema.safeParse({ mode: "all" }).success, false);
});

test("lot 5 : mail fidèle au modèle validé, liens comptés, logo joint, pas de pixel", () => {
  const email = renderProspectEmail({
    city: "Paris",
    linkCode: "il-en-est-ou-paris",
    addressSource: "Google Maps <script>",
    baseUrl: "https://tutelliv.fr/",
  });
  assert.equal(email.subject, "Il en est où ?");
  assert.ok(email.html.includes(PROSPECT_PREHEADER));
  assert.ok(email.html.includes("https://tutelliv.fr/go/il-en-est-ou-paris/rejoindre"));
  assert.ok(email.html.includes("https://tutelliv.fr/go/il-en-est-ou-paris/site"));
  assert.ok(email.html.includes(`src="cid:${PROSPECT_LOGO_CID}"`));
  assert.ok(email.html.includes("BIENTÔT À PARIS"));
  assert.ok(email.html.includes("Carotenuto-Marchetti Orso"));
  assert.ok(email.html.includes("répondez STOP"));
  assert.ok(email.html.includes("Google Maps &lt;script&gt;"), "origine échappée");
  assert.equal(email.html.includes("«"), false, "aucun guillemet français demandé par le propriétaire");
  assert.equal(/\[[A-Za-z]+\]/.test(email.html), false, "aucun crochet à remplir");
  // Seule image : le logo joint ; aucune image distante (donc aucun pixel de suivi).
  assert.deepEqual(email.html.match(/<img\b[^>]*src="([^"]+)"/g)?.map((tag) => tag.match(/src="([^"]+)"/)![1]), [`cid:${PROSPECT_LOGO_CID}`]);
  assert.ok(email.text.includes("https://tutelliv.fr/go/il-en-est-ou-paris/rejoindre"));
  assert.ok(email.text.startsWith(PROSPECT_PREHEADER), "aperçu aussi dans la version texte");
  // Le texte caché en masse envoyait le mail en indésirables chez Microsoft 365 (5 novembre 2026).
  assert.equal(/[\u034f\u200c\u2007\ufeff\u00ad]/.test(email.text), false, "aucun caractère invisible dans la version texte");
  assert.equal(/&#847;|&zwnj;|&#8199;|&#65279;|&shy;/.test(email.html), false, "aucun caractère invisible dans la version HTML");
  assert.equal(email.headers["List-Unsubscribe"], "<mailto:orso@tutelliv.fr?subject=STOP>");
  assert.equal(email.attachments.length, 1);
  assert.equal(email.attachments[0]!.cid, PROSPECT_LOGO_CID);
  assert.deepEqual(email.attachments[0]!.content, readFileSync("public/brand/email-bandeau-logo.png"));
  assert.equal(Buffer.from(PROSPECT_LOGO_PNG_BASE64, "base64").subarray(1, 4).toString(), "PNG");
  assert.deepEqual(prospectLinks("https://tutelliv.fr", "a-b"), {
    join: "https://tutelliv.fr/go/a-b/rejoindre",
    site: "https://tutelliv.fr/go/a-b/site",
  });
});

test("lot 5 : réglages OVH lus sans jamais exposer le mot de passe", () => {
  assert.equal(readProspectMailerConfig({}), null);
  assert.equal(readProspectMailerConfig({ PROSPECT_SMTP_PASSWORD: "  " }), null);
  assert.deepEqual(readProspectMailerConfig({ PROSPECT_SMTP_PASSWORD: "secret-pass" }), {
    host: "smtp.mail.ovh.net",
    port: 465,
    user: "orso@tutelliv.fr",
    password: "secret-pass",
  });
  const auth = describeMailerError(Object.assign(new Error("535 auth failed for secret-pass"), { code: "EAUTH" }));
  assert.match(auth, /mot de passe/);
  assert.equal(auth.includes("secret-pass"), false);
  assert.equal(describeMailerError(Object.assign(new Error("x"), { responseCode: 550 })), "Refus du serveur mail (code 550).");
  assert.equal(describeMailerError("boom"), "Envoi impossible (erreur inconnue).");
});

test("lot 5 : origine des liens, variable prioritaire si elle est une origine propre", () => {
  assert.equal(prospectLinkBaseUrl("https://tutelliv.fr/api/admin/campaigns/x/send", {}), "https://tutelliv.fr");
  assert.equal(prospectLinkBaseUrl("http://localhost:3000/api", { PROSPECT_LINK_BASE_URL: "https://tutelliv.fr/" }), "https://tutelliv.fr");
  assert.equal(prospectLinkBaseUrl("http://localhost:3000/api", { PROSPECT_LINK_BASE_URL: "javascript:alert(1)" }), "http://localhost:3000");
  assert.equal(prospectLinkBaseUrl("http://localhost:3000/api", { PROSPECT_LINK_BASE_URL: "https://tutelliv.fr/x" }), "http://localhost:3000");
});

type FakeState = {
  queue: Array<{ id: string; email: string }>;
  optOuts: Set<string>;
  finished: Array<{ id: string; status: string; detail: string | null }>;
  wait?: number;
};

function fakeRepository(state: FakeState, campaign = { id: "c1", code: "il-en-est-ou-paris", city: "Paris", addressSource: "Google Maps" }): ProspectSendRepository {
  return {
    findCampaign: async (id) => (id === campaign.id ? campaign : null),
    claimNext: async () => {
      if (state.wait) return { kind: "wait", waitMs: state.wait };
      const next = state.queue.shift();
      return next ? { kind: "claimed", recipient: next } : { kind: "empty" };
    },
    isOptedOut: async (email) => state.optOuts.has(email),
    finish: async (id, outcome) => { state.finished.push({ id, status: outcome.status, detail: outcome.detail }); },
    remaining: async () => state.queue.length,
  };
}

function fakeMailer(sent: Array<{ to: string; subject: string; html: string }>, fail?: unknown): ProspectMailer {
  return {
    send: async (to, email) => {
      if (fail) throw fail;
      sent.push({ to, subject: email.subject, html: email.html });
    },
  };
}

test("lot 5 : envoi un par un — envoyé, STOP, échec, attente, fin, non configuré", async () => {
  const state: FakeState = {
    queue: [{ id: "r1", email: "a@exemple.fr" }, { id: "r2", email: "stop@exemple.fr" }, { id: "r3", email: "c@exemple.fr" }],
    optOuts: new Set(["stop@exemple.fr"]),
    finished: [],
  };
  const sent: Array<{ to: string; subject: string; html: string }> = [];
  const deps = { repository: fakeRepository(state), mailer: fakeMailer(sent) };

  assert.deepEqual(await sendNextProspectEmail("absent", "https://tutelliv.fr", deps), { status: "not_found" });
  assert.deepEqual(
    await sendNextProspectEmail("c1", "https://tutelliv.fr", { repository: fakeRepository(state), mailer: null }),
    { status: "not_configured" }
  );

  const first = await sendNextProspectEmail("c1", "https://tutelliv.fr", deps);
  assert.deepEqual(first, { status: "sent", email: "a@exemple.fr", remaining: 2, waitMs: PROSPECT_SEND_PACE_MS });
  assert.equal(sent[0]!.to, "a@exemple.fr");
  assert.ok(sent[0]!.html.includes("/go/il-en-est-ou-paris/rejoindre"));

  const second = await sendNextProspectEmail("c1", "https://tutelliv.fr", deps);
  assert.equal(second.status, "skipped");
  assert.equal(sent.length, 1, "aucun mail à une adresse STOP");

  const failing = { repository: fakeRepository(state), mailer: fakeMailer(sent, Object.assign(new Error("pw"), { code: "EAUTH" })) };
  const third = await sendNextProspectEmail("c1", "https://tutelliv.fr", failing);
  assert.equal(third.status, "failed");
  assert.deepEqual(state.finished.map((entry) => entry.status), ["SENT", "SKIPPED", "FAILED"]);
  assert.match(state.finished[2]!.detail!, /mot de passe/);

  assert.deepEqual(await sendNextProspectEmail("c1", "https://tutelliv.fr", deps), { status: "done", remaining: 0 });

  state.queue.push({ id: "r4", email: "d@exemple.fr" });
  state.wait = 12_000;
  assert.deepEqual(await sendNextProspectEmail("c1", "https://tutelliv.fr", deps), { status: "wait", waitMs: 12_000, remaining: 1 });
  assert.ok(PROSPECT_MIN_INTERVAL_MS < PROSPECT_SEND_PACE_MS, "le serveur laisse passer le rythme du navigateur");
});

test("lot 5 : essai envoyé à l'admin, liens au code « test », campagne inchangée", async () => {
  const state: FakeState = { queue: [{ id: "r1", email: "a@exemple.fr" }], optOuts: new Set(), finished: [] };
  const sent: Array<{ to: string; subject: string; html: string }> = [];
  const result = await sendProspectTestEmail("c1", "orso@tutelliv.fr", "https://tutelliv.fr", {
    repository: fakeRepository(state),
    mailer: fakeMailer(sent),
  });
  assert.deepEqual(result, { status: "sent", to: "orso@tutelliv.fr" });
  assert.equal(sent[0]!.subject, "[Essai] Il en est où ?");
  assert.ok(sent[0]!.html.includes(`/go/${PROSPECT_TEST_CODE}/rejoindre`));
  assert.equal(sent[0]!.html.includes("il-en-est-ou-paris"), false);
  assert.equal(state.queue.length, 1);
  assert.deepEqual(state.finished, []);
});

test("lot 5 : clics des mails comptés hors robots, codes invalides et plafond", async () => {
  const writes: unknown[][] = [];
  const db = { $executeRaw: async (...args: unknown[]) => { writes.push(args); return 1; } } as never;
  const now = new Date("2026-11-05T15:00:00.000Z");
  const limiter = createFunnelSourceLimiter({ limit: 1 });
  const request = { userAgent: UA, source: "203.0.113.1" };

  assert.equal(await recordMailLinkClick("il-en-est-ou-paris", "rejoindre", request, { now, db, limiter, secret: "s" }), "recorded");
  assert.equal(await recordMailLinkClick("il-en-est-ou-paris", "site", request, { now, db, limiter, secret: "s" }), "limited");
  assert.equal(await recordMailLinkClick("Bad Code", "site", request, { now, db, secret: "s" }), "ignored");
  assert.equal(await recordMailLinkClick("direct", "site", request, { now, db, secret: "s" }), "ignored");
  assert.equal(await recordMailLinkClick("il-en-est-ou-paris", "site", { userAgent: "Microsoft Office/16.0 (Windows; preview)", source: "x" }, { now, db, secret: "s" }), "ignored");
  assert.equal(writes.length, 1);
  assert.ok(writes[0]!.includes("MAIL_JOIN"));
  assert.ok(writes[0]!.includes("il-en-est-ou-paris"));

  assert.equal(isMailLinkTarget("rejoindre"), true);
  assert.equal(isMailLinkTarget("toString"), false);
  assert.equal(mailLinkDestination("il-en-est-ou-paris", "rejoindre"), "/tarifs?c=il-en-est-ou-paris");
  assert.equal(mailLinkDestination("il-en-est-ou-paris", "site"), "/?c=il-en-est-ou-paris");
});

test("lot 5 : l'entonnoir de /tarifs ignore les clics des mails", () => {
  const now = new Date("2026-11-05T15:00:00.000Z");
  const day = new Date("2026-11-05T00:00:00.000Z");
  const funnel = summarizeFunnel(
    [
      { day, campaignCode: "il-en-est-ou-paris", event: "VISIT", count: 3 },
      { day, campaignCode: "il-en-est-ou-paris", event: "MAIL_JOIN", count: 9 },
      { day, campaignCode: "il-en-est-ou-paris", event: "MAIL_SITE", count: 4 },
    ],
    7,
    now
  );
  assert.deepEqual(funnel.totals, { visits: 3, clicks: 0, signups: 0 });
});

test("lot 5 : route /go publique, GET compté et redirigé, HEAD jamais compté", () => {
  assert.equal(isProtectedPagePath("/go/il-en-est-ou-paris/rejoindre"), false);
  const source = readFileSync("src/app/go/[code]/[target]/route.ts", "utf8");
  const head = source.slice(source.indexOf("export async function HEAD"));
  assert.ok(source.includes("recordMailLinkClick"));
  assert.equal(head.includes("recordMailLinkClick"), false);
  assert.ok(source.includes("status: 302"));
  assert.equal(/cookies|set-cookie/i.test(source), false);
});

test("lot 5 : routes admin protégées et entrée Campagnes du menu Commercial", () => {
  for (const file of [
    "src/app/api/admin/campaigns/route.ts",
    "src/app/api/admin/campaigns/[id]/route.ts",
    "src/app/api/admin/campaigns/[id]/recipients/route.ts",
    "src/app/api/admin/campaigns/[id]/send/route.ts",
    "src/app/api/admin/campaigns/opt-outs/route.ts",
  ]) {
    const source = readFileSync(file, "utf8");
    assert.match(source, /requireStaffRole\("dashboard:admin"\)/, file);
    assert.match(source, /requireRole\(auth\.context, \["SUPER_ADMIN"\]\)/, file);
    assert.match(source, /"PROSPECT_CAMPAIGNS"/, file);
    for (const method of source.matchAll(/export async function (POST|PATCH)/g)) {
      assert.ok(source.includes(`gatePlatformWrite(auth.context, denied, "PROSPECT_CAMPAIGNS", "${method[1]}")`), `${file} ${method[1]}`);
    }
  }
  const entry = adminNavItems.find((item) => item.href === "/admin/campaigns");
  assert.equal(entry?.title, "Campagnes");
  assert.equal(entry?.group, "Commercial");
  const send = readFileSync("src/domains/growth/prospect/prospect-mailer.ts", "utf8");
  assert.equal(/resend/i.test(send.replace(/Jamais par Resend[^\n]*/, "")), false, "jamais par Resend");
});
