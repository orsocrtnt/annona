import { createHmac } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { prisma } from "../../src/services/prisma/client";
import { analyzeInboundEmailJob, ingestInboundEmail } from "../../src/domains/order-intake/inbound-email.service";
import { buildOrderIntakeDraft } from "../../src/domains/order-intake/order-intake.draft";
import type { OrderIntakeExtraction } from "../../src/domains/order-intake/order-intake.schema";

/** Commande et suivi sans connexion, e-mails reçus : base de développement, données E2E supprimées à la fin. */
const field = (value: string | null) => ({ value, confidence: "high" as const, source: value });
const none = () => ({ value: null, confidence: "low" as const, source: null });
const stop = (address: string, city: string, postalCode: string) => ({
  address: field(address), city: field(city), postalCode: field(postalCode), contactName: none(), phone: none(), instructions: none(),
});
const EXTRACTION: OrderIntakeExtraction = {
  pickup: stop("12 rue de Rivoli", "Paris", "75001"),
  deliveries: [{ ...stop("5 place de la Défense", "Courbevoie", "92400"), packages: { description: none(), quantity: { value: null, confidence: "low", source: null } } }],
  deadline: { mode: "before", dayOffset: 1, date: null, time: "15:00", endTime: null, confidence: "high", source: "avant 15h" },
  urgency: { value: "urgent", confidence: "high", source: "urgent" },
  packages: { description: field("plis"), quantity: { value: 2, confidence: "high", source: "2 plis" } },
  instructions: none(),
  customer: { name: none(), email: none(), phone: none() },
};

async function loginAdmin(page: Page) {
  const login = await page.request.post("/api/auth/login", {
    data: { email: "demo@tutelliv.fr", password: "Demo2026!", demoTestSession: true, accountType: "company" },
  });
  expect(login.status()).toBe(200);
  expect((await page.request.post("/api/demo/persona", { data: { persona: "admin" } })).status()).toBe(200);
  const me = await page.request.get("/api/company/intake-channels");
  expect(me.status()).toBe(200);
}

const tomorrow = () => new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
const BODY = (key: string, overrides: Record<string, unknown> = {}) => ({
  idempotencyKey: key,
  name: "E2E Demandeur",
  email: "e2e-public-order@tutelliv.fr",
  phone: "0612345678",
  pickup: { address: "12 rue de Rivoli", city: "Paris", postalCode: "75001" },
  delivery: { address: "5 place de la Défense", city: "Courbevoie", postalCode: "92400" },
  quantity: 2,
  requestedDeliveryDate: tomorrow(),
  ...overrides,
});

test("LIEN : commander sans compte, suivre, plafond, lien coupé", async ({ page, browser }) => {
  test.setTimeout(240_000);
  const orderIds: string[] = [];
  let companyId = "";
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  try {
    await loginAdmin(page);
    await page.goto("/dashboard/orders/intake");
    const row = page.getByTestId("channel-orderLink");
    await expect(row.getByRole("button", { name: /^(Activer|Désactiver)$/ })).toBeVisible({ timeout: 60_000 });
    if (await row.getByRole("button", { name: "Activer" }).isVisible()) await row.getByRole("button", { name: "Activer" }).click();
    await expect(row.getByRole("button", { name: "Copier" })).toBeVisible();
    const url = (await (await page.request.get("/api/company/intake-channels")).json()).data.orderLink.url as string;
    const token = url.split("/").pop()!;
    companyId = (await prisma.companyIntakeChannel.findUniqueOrThrow({ where: { orderLinkToken: token } })).companyId;

    // Visiteur sans session.
    const anon = await browser.newContext({ baseURL: page.url().split("/dashboard")[0] });
    const visitor = await anon.newPage();
    visitor.on("pageerror", (error) => errors.push(error.message));
    await visitor.goto(`/commander/${token}`);
    await expect(visitor.getByRole("heading", { name: /Commander chez/ })).toBeVisible();

    await visitor.getByRole("button", { name: "Envoyer la commande" }).click();
    await expect(visitor.getByText("Commande non envoyée")).toBeVisible();

    await visitor.getByLabel(/Nom ou société/).fill("E2E Demandeur");
    await visitor.getByLabel(/E-mail/).fill("e2e-public-order@tutelliv.fr");
    await visitor.getByLabel(/Téléphone/).fill("0612345678");
    await visitor.getByLabel(/Adresse/).nth(0).fill("12 rue de Rivoli");
    await visitor.getByLabel(/Code postal/).nth(0).fill("75001");
    await visitor.getByLabel(/Ville/).nth(0).fill("Paris");
    await visitor.getByLabel(/Adresse/).nth(1).fill("5 place de la Défense");
    await visitor.getByLabel(/Code postal/).nth(1).fill("92400");
    await visitor.getByLabel(/Ville/).nth(1).fill("Courbevoie");
    await visitor.getByLabel(/Date de livraison/).fill(tomorrow());
    const slot = visitor.getByLabel(/Créneau/);
    if (await slot.count()) await slot.selectOption({ index: 1 });
    await visitor.getByRole("button", { name: "Envoyer la commande" }).dblclick();
    await expect(visitor.getByText(/Commande envoyée/)).toBeVisible({ timeout: 60_000 });

    const links = await prisma.orderTrackingLink.findMany({ where: { companyId, guestEmail: "e2e-public-order@tutelliv.fr" }, select: { orderId: true, token: true } });
    expect(links, "double clic : une seule commande").toHaveLength(1);
    orderIds.push(links[0]!.orderId);
    const order = await prisma.order.findUniqueOrThrow({ where: { id: links[0]!.orderId }, include: { deliveries: true } });
    expect(order.source).toBe("PUBLIC_LINK");
    expect(order.customerId).toBeNull();
    expect(order.customerEmail, "aucun rattachement à un compte par e-mail saisi").toBeNull();
    expect(order.notes).toContain("non vérifié");
    expect(order.deliveries[0]?.driverId ?? null).toBeNull();
    expect(await prisma.operationJob.count({ where: { type: "AUTO_DISPATCH", jobKey: { contains: order.deliveries[0]!.id } } }), "pas d'affectation automatique").toBe(0);
    expect(await prisma.operationJob.count({ where: { jobKey: { startsWith: "guest-tracking:" }, companyId, payload: { path: ["kind"], equals: "GUEST_TRACKING_LINK" } } })).toBeGreaterThan(0);

    // Suivi sans session.
    await visitor.getByRole("link", { name: "Suivre ma livraison" }).click();
    await expect(visitor).toHaveURL(new RegExp(`/suivi/${links[0]!.token}`));
    await expect(visitor.getByText(order.reference)).toBeVisible();
    await expect(visitor.getByText("Paris → Courbevoie")).toBeVisible();
    const html = await visitor.content();
    expect(html).not.toContain("12 rue de Rivoli");
    expect(html).not.toContain("0612345678");
    expect((await visitor.request.get("/suivi/jeton-qui-n-existe-pas-du-tout")).status()).toBe(404);

    // Le dispatcher voit le demandeur et peut copier le lien de n'importe quelle commande.
    await page.goto(`/dashboard/orders/${order.id}`);
    await expect(page.getByText(/E2E Demandeur/)).toBeVisible();
    const copied = await page.request.post(`/api/orders/${order.id}/tracking-link`);
    expect((await copied.json()).data.url).toContain(links[0]!.token);
    expect((await visitor.request.post(`/api/orders/${order.id}/tracking-link`)).status(), "sans session").toBe(401);

    // Champ forcé refusé, pot de miel silencieux, plafond par source.
    const api = visitor.request;
    const source = { "x-forwarded-for": "203.0.113.77" };
    expect((await api.post(`/api/public/orders/${token}`, { headers: source, data: BODY("public-e2e-forced", { companyId: "autre" }) })).status()).toBe(400);
    const before = await prisma.order.count({ where: { companyId } });
    expect((await api.post(`/api/public/orders/${token}`, { headers: source, data: BODY("public-e2e-honey", { website: "http://spam" }) })).status()).toBe(201);
    expect(await prisma.order.count({ where: { companyId } })).toBe(before);
    const statuses: number[] = [];
    for (let index = 0; index < 6; index += 1) {
      statuses.push((await api.post(`/api/public/orders/${token}`, { headers: source, data: BODY(`public-e2e-limit-${index}`) })).status());
    }
    expect(statuses).toEqual([201, 201, 201, 201, 201, 429]);
    orderIds.push(...(await prisma.order.findMany({ where: { companyId, idempotencyKey: { startsWith: "public-e2e-limit-" } }, select: { id: true } })).map(({ id }) => id));

    // Lien coupé : plus rien pour le visiteur.
    expect((await page.request.patch("/api/company/intake-channels", { data: { channel: "orderLink", enabled: false } })).status()).toBe(200);
    expect((await api.get(`/commander/${token}`)).status()).toBe(404);
    expect((await api.post(`/api/public/orders/${token}`, { data: BODY("public-e2e-off") })).status()).toBe(404);
    // Le suivi d'une commande déjà passée reste lisible.
    expect((await api.get(`/suivi/${links[0]!.token}`)).status()).toBe(200);
    expect(errors).toEqual([]);
    await anon.close();
  } finally {
    if (orderIds.length) {
      const deliveries = await prisma.delivery.findMany({ where: { orderId: { in: orderIds } }, select: { id: true } });
      await prisma.operationJob.deleteMany({ where: { OR: deliveries.map(({ id }) => ({ jobKey: { contains: id } })) } }).catch(() => undefined);
      const links = await prisma.orderTrackingLink.findMany({ where: { orderId: { in: orderIds } }, select: { id: true } });
      await prisma.operationJob.deleteMany({ where: { jobKey: { in: links.map(({ id }) => `guest-tracking:${id}`) } } });
      await prisma.saasUsageEvent.deleteMany({ where: { orderId: { in: orderIds } } }).catch(() => undefined);
      await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
    }
    if (companyId) await prisma.companyIntakeChannel.deleteMany({ where: { companyId } });
    await page.request.post("/api/auth/logout").catch(() => undefined);
  }
});

test("E-MAIL : réception signée, doublon, brouillon validé en une commande, classement", async ({ page, request }) => {
  test.setTimeout(180_000);
  const emailIds: string[] = [];
  let companyId = "";
  let orderId: string | null = null;
  try {
    // Webhook sans signature valide : refusé par la route, sans dépendre des variables du serveur.
    const refused = await request.post("/api/webhooks/inbound-email", { data: { type: "email.received" } });
    expect(refused.status()).toBe(400);
    const ts = String(Math.floor(Date.now() / 1000));
    const forged = createHmac("sha256", Buffer.from("autre")).update(`m.${ts}.{}`).digest("base64");
    expect((await request.post("/api/webhooks/inbound-email", { data: "{}", headers: { "svix-id": "m", "svix-timestamp": ts, "svix-signature": `v1,${forged}` } })).status()).toBe(400);

    await loginAdmin(page);
    const channels = await page.request.patch("/api/company/intake-channels", { data: { channel: "inboundEmail", enabled: true } });
    expect(channels.status()).toBe(200);
    const admin = await prisma.companyIntakeChannel.findFirstOrThrow({ where: { inboundEmailEnabled: true }, orderBy: { updatedAt: "desc" } });
    companyId = admin.companyId;
    const token = admin.inboundEmailToken!;
    const env = { INBOUND_EMAIL_DOMAIN: "commandes.e2e.test", RESEND_API_KEY: "fausse-cle-de-test" };
    const emailId = `e2e-inbound-${Date.now()}`;
    const event = { type: "email.received", data: { email_id: emailId, to: [`${token}@commandes.e2e.test`] } };
    const fetcher = (async () => new Response(JSON.stringify({
      from: "E2E Client <e2e-client@tutelliv.fr>", subject: "E2E commande urgente", html: "<p>2 plis de Rivoli à la Défense</p>", attachments: [{ id: "a" }],
    }), { status: 200 })) as typeof fetch;

    expect(await ingestInboundEmail({ type: "autre" }, { env, fetcher })).toBe("ignored");
    expect(await ingestInboundEmail({ type: "email.received", data: { email_id: "x", to: ["0123456789abcdef0123456789abcdef@commandes.e2e.test"] } }, { env, fetcher }), "adresse inconnue").toBe("ignored");
    expect(await ingestInboundEmail(event, { env, fetcher })).toBe("stored");
    expect(await ingestInboundEmail(event, { env, fetcher }), "webhook rejoué").toBe("duplicate");
    const stored = await prisma.inboundOrderEmail.findUniqueOrThrow({ where: { providerEmailId: emailId } });
    emailIds.push(stored.id);
    expect(stored.companyId).toBe(companyId);
    expect(stored.bodyText).toContain("2 plis de Rivoli");
    expect(stored.bodyText).not.toContain("<p>");
    expect(stored.fromAddress).toBe("e2e-client@tutelliv.fr");
    expect(stored.attachmentCount).toBe(1);
    expect(await prisma.order.count({ where: { companyId, notes: { contains: "E2E commande urgente" } } }), "jamais de commande créée seule").toBe(0);

    // Analyse simulée : aucun appel réel au modèle, la clé n'est pas requise.
    // La tâche lancée à la réception tourne en parallèle dans ce processus : attendre sa fin.
    await expect.poll(async () => (await prisma.inboundOrderEmail.findUniqueOrThrow({ where: { id: stored.id } })).status, { timeout: 30_000 }).not.toBe("RECEIVED");
    const draft = buildOrderIntakeDraft(EXTRACTION, stored.bodyText, new Date());
    await prisma.inboundOrderEmail.updateMany({ where: { id: stored.id }, data: { status: "RECEIVED" } });
    await analyzeInboundEmailJob({ inboundEmailId: stored.id }, { analyze: async () => ({ status: "ok", draft }) });
    expect((await prisma.inboundOrderEmail.findUniqueOrThrow({ where: { id: stored.id } })).status).toBe("ANALYZED");

    const second = await prisma.inboundOrderEmail.create({ data: { companyId, providerEmailId: `${emailId}-b`, fromAddress: "e2e-spam@tutelliv.fr", subject: "E2E à classer", bodyText: "texte", status: "ANALYSIS_FAILED", analysisError: "not_configured" } });
    emailIds.push(second.id);

    // Le dispatcher relit et valide.
    await page.request.patch("/api/orders/intake", { data: { enabled: true } });
    await page.goto("/dashboard/orders/intake");
    const card = page.getByRole("listitem").filter({ hasText: "E2E commande urgente" });
    await expect(card.getByText("Brouillon prêt")).toBeVisible();
    await expect(card.getByText(/pièce\(s\) jointe\(s\)/)).toBeVisible();
    await card.getByRole("button", { name: "Relire le brouillon" }).click();
    await expect(page.getByLabel(/^Client/)).toBeVisible();

    const spam = page.getByRole("listitem").filter({ hasText: "E2E à classer" });
    await spam.getByRole("button", { name: "Classer sans commande" }).click();
    await expect(spam).toHaveCount(0);
    const dismissed = await prisma.inboundOrderEmail.findUniqueOrThrow({ where: { id: second.id } });
    expect(dismissed.status).toBe("DISMISSED");
    expect(dismissed.bodyText, "contenu effacé dès le classement").toBe("");

    // Vrai clic : le double clic ne crée qu'une commande et l'e-mail se classe seul.
    await page.getByLabel(/^Client/).selectOption({ index: 1 });
    await page.getByRole("button", { name: "Créer la commande" }).dblclick();
    await expect(page.getByText(/Commande créée/).first()).toBeVisible({ timeout: 60_000 });
    await expect.poll(async () => (await prisma.inboundOrderEmail.findUniqueOrThrow({ where: { id: stored.id } })).status, { timeout: 30_000 }).toBe("CONVERTED");
    const key = `inbound-${stored.id}-0`;
    const createdOrders = await prisma.order.findMany({ where: { companyId, idempotencyKey: key }, select: { id: true } });
    expect(createdOrders, "une seule commande").toHaveLength(1);
    orderId = createdOrders[0]!.id;
    const converted = await prisma.inboundOrderEmail.findUniqueOrThrow({ where: { id: stored.id } });
    expect(converted.status).toBe("CONVERTED");
    expect(converted.orderId).toBe(orderId);
    expect(converted.bodyText).toBe("");
    expect(converted.draft).toBeNull();
    const list = (await (await page.request.get("/api/orders/intake/inbox")).json()).data as { id: string }[];
    expect(list.some(({ id }) => emailIds.includes(id)), "traités : hors de la liste").toBe(false);
    expect((await page.request.patch("/api/orders/intake/inbox/inconnu", { data: { status: "DISMISSED" } })).status()).toBe(404);
  } finally {
    await prisma.operationJob.deleteMany({ where: { jobKey: { in: emailIds.map((id) => `inbound-email:${id}`) } } });
    await prisma.inboundOrderEmail.deleteMany({ where: { id: { in: emailIds } } });
    if (orderId) {
      await prisma.saasUsageEvent.deleteMany({ where: { orderId } }).catch(() => undefined);
      await prisma.order.deleteMany({ where: { id: orderId } });
    }
    if (companyId) await prisma.companyIntakeChannel.deleteMany({ where: { companyId } });
    await page.request.post("/api/auth/logout").catch(() => undefined);
  }
});
