import { expect, test } from "@playwright/test";
import { prisma } from "../../src/services/prisma/client";
import { buildOrderIntakeDraft } from "../../src/domains/order-intake/order-intake.draft";
import type { OrderIntakeExtraction } from "../../src/domains/order-intake/order-intake.schema";

/**
 * Commande par message : parcours navigateur sur la base de développement.
 * Écrit le 2026-10-28, NON LANCÉ. L'analyse est simulée par interception réseau :
 * aucun appel réel au modèle, aucune clé requise. La création, elle, passe par la vraie route.
 */
const MESSAGE = "urgent, 2 plis de 12 rue de Rivoli 75001 Paris à 5 place de la Défense 92400 Courbevoie avant 15h, demander M. Durand";

const field = (value: string | null, source: string | null = value) => ({ value, confidence: "high" as const, source });
const none = () => ({ value: null, confidence: "low" as const, source: null });
const stop = (address: string, city: string, postalCode: string, contactName: string | null = null) => ({
  address: field(address), city: field(city), postalCode: field(postalCode),
  contactName: contactName ? field(contactName) : none(), phone: none(), instructions: none(),
});
const EXTRACTION: OrderIntakeExtraction = {
  kind: { value: "order", reason: null },
  pickup: stop("12 rue de Rivoli", "Paris", "75001"),
  deliveries: [{ ...stop("5 place de la Défense", "Courbevoie", "92400", "M. Durand"), packages: { description: none(), quantity: { value: null, confidence: "low", source: null } } }],
  // Demain, pour que l'échéance ne soit jamais passée quelle que soit l'heure du test.
  deadline: { mode: "before", dayOffset: 1, date: null, time: "15:00", endTime: null, confidence: "high", source: "avant 15h" },
  urgency: { value: "urgent", confidence: "high", source: "urgent" },
  packages: { description: field("plis"), quantity: { value: 2, confidence: "high", source: "2 plis" } },
  instructions: none(),
  customer: { name: none(), email: none(), phone: none() },
};

test("INTAKE : coller, analyser, relire, créer une seule commande malgré le double clic", async ({ page }) => {
  test.setTimeout(120_000);
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  let createdOrderId: string | null = null;
  let previousEnabled: boolean | null = null;

  try {
    const login = await page.request.post("/api/auth/login", {
      data: { email: "demo@tutelliv.fr", password: "Demo2026!", demoTestSession: true, accountType: "company" },
    });
    expect(login.status()).toBe(200);
    expect((await page.request.post("/api/demo/persona", { data: { persona: "admin" } })).status()).toBe(200);

    const status = await page.request.get("/api/orders/intake");
    expect(status.status()).toBe(200);
    previousEnabled = ((await status.json()) as { data: { enabled: boolean } }).data.enabled;
    expect((await page.request.patch("/api/orders/intake", { data: { enabled: true } })).status()).toBe(200);

    // La clé serveur peut manquer en local : l'état et l'analyse sont simulés.
    await page.route("**/api/orders/intake", async (route) => {
      if (route.request().method() !== "GET") return route.fallback();
      await route.fulfill({ json: { success: true, data: { enabled: true, configured: true, canManage: true, limits: { hourly: 60, daily: 300, maxTextLength: 8000 } } } });
    });
    let analyzeCalls = 0;
    await page.route("**/api/orders/intake/analyze", async (route) => {
      analyzeCalls += 1;
      expect(route.request().postDataJSON()).toMatchObject({ text: MESSAGE });
      await route.fulfill({ json: { success: true, data: buildOrderIntakeDraft(EXTRACTION, MESSAGE, new Date()) } });
    });

    await page.goto("/dashboard/orders");
    await page.getByRole("link", { name: "Depuis un message" }).click();
    await expect(page.getByRole("heading", { name: "Nouvelle commande depuis un message" })).toBeVisible();

    const textarea = page.getByLabel(/Texte du message/);
    await textarea.fill(MESSAGE);
    await textarea.press("Control+Enter");
    await expect(page.getByText("Brouillon à relire")).toBeVisible();
    expect(analyzeCalls).toBe(1);

    await expect(page.getByLabel(/^Adresse/).first()).toHaveValue("12 rue de Rivoli");
    await expect(page.getByText("Urgent", { exact: true }).first()).toBeVisible();
    // Le brouillon simulé est complet (adresse, ville, code postal, échéance, quantité) : aucune alerte d'informations absentes.
    await expect(page.getByText(/Informations absentes du message/)).toHaveCount(0);

    // Sans client choisi, rien n'est envoyé.
    await page.getByRole("button", { name: "Créer la commande" }).click();
    await expect(page.getByText("Choisissez le client de la commande.")).toBeVisible();

    const clientSelect = page.getByLabel(/^Client/);
    await clientSelect.selectOption({ index: 1 });

    const created = page.waitForResponse((response) => response.url().endsWith("/api/orders/intake/orders") && response.request().method() === "POST");
    await page.getByRole("button", { name: "Créer la commande" }).dblclick();
    const response = await created;
    expect(response.status()).toBe(201);
    createdOrderId = ((await response.json()) as { data: { id: string } }).data.id;
    await expect(page.getByText(/Commande créée/).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Commande créée" })).toBeDisabled();

    const order = await prisma.order.findUniqueOrThrow({ where: { id: createdOrderId }, select: { source: true, idempotencyKey: true } });
    expect(order.source).toBe("ADMIN");
    expect(await prisma.order.count({ where: { idempotencyKey: order.idempotencyKey } })).toBe(1);

    // Retour arrière puis rechargement : aucun brouillon fantôme, aucune nouvelle commande.
    await page.goBack();
    await page.goForward();
    await page.reload();
    await expect(page.getByText("Brouillon à relire")).toHaveCount(0);
    expect(pageErrors).toEqual([]);
  } finally {
    if (createdOrderId) await prisma.order.delete({ where: { id: createdOrderId } }).catch(() => undefined);
    if (previousEnabled !== null) await page.request.patch("/api/orders/intake", { data: { enabled: previousEnabled } });
    await page.request.post("/api/auth/logout").catch(() => undefined);
    await prisma.$disconnect();
  }
});

// MAIL-ECARTS défaut 2 : chaque livraison garde sa quantité ; une quantité absente est signalée sur sa livraison.
const MULTI_MESSAGE = "Enlèvement 12 rue de Rivoli 75001 Paris demain. Livrer 1 palette au 5 place de la Défense 92400 Courbevoie et des cartons au 3 av. Foch 75116 Paris.";
const MULTI_EXTRACTION: OrderIntakeExtraction = {
  ...EXTRACTION,
  deliveries: [
    { ...stop("5 place de la Défense", "Courbevoie", "92400"), packages: { description: field("palette"), quantity: { value: 1, confidence: "high", source: "1 palette" } } },
    { ...stop("3 av. Foch", "Paris", "75116"), packages: { description: field("cartons"), quantity: { value: null, confidence: "low", source: null } } },
  ],
  deadline: { mode: "at", dayOffset: 1, date: null, time: null, endTime: null, confidence: "high", source: "demain" },
  urgency: { value: null, confidence: "low", source: null },
  packages: { description: none(), quantity: { value: null, confidence: "low", source: null } },
};

test("INTAKE : deux livraisons, quantité propre à chacune et absente signalée sur la bonne", async ({ page }) => {
  test.setTimeout(120_000);
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  try {
    const login = await page.request.post("/api/auth/login", {
      data: { email: "demo@tutelliv.fr", password: "Demo2026!", demoTestSession: true, accountType: "company" },
    });
    expect(login.status()).toBe(200);
    expect((await page.request.post("/api/demo/persona", { data: { persona: "admin" } })).status()).toBe(200);
    await page.route("**/api/orders/intake", async (route) => {
      if (route.request().method() !== "GET") return route.fallback();
      await route.fulfill({ json: { success: true, data: { enabled: true, configured: true, canManage: true, limits: { hourly: 60, daily: 300, maxTextLength: 8000 } } } });
    });
    await page.route("**/api/orders/intake/analyze", (route) =>
      route.fulfill({ json: { success: true, data: buildOrderIntakeDraft(MULTI_EXTRACTION, MULTI_MESSAGE, new Date()) } })
    );

    await page.goto("/dashboard/orders");
    await page.getByRole("link", { name: "Depuis un message" }).click();
    const textarea = page.getByLabel(/Texte du message/);
    await textarea.fill(MULTI_MESSAGE);
    await textarea.press("Control+Enter");
    await expect(page.getByText("Brouillon à relire")).toBeVisible();
    await expect(page.getByText(/Informations absentes du message/)).toBeVisible();
    await expect(page.getByText(/quantité de colis/)).toBeVisible();

    const quantity = page.getByLabel(/^Quantité/);
    await expect(page.getByLabel(/^Nature des colis/)).toHaveValue("palette");
    await expect(quantity).toHaveValue("1");
    await expect(page.getByText("Absente du message : vérifiez.")).toHaveCount(0);

    await page.getByRole("button", { name: /^Livraison 2/ }).click();
    await expect(page.getByLabel(/^Nature des colis/)).toHaveValue("cartons");
    await expect(page.getByText("Absente du message : vérifiez.")).toBeVisible();
    await quantity.fill("3");
    await page.getByRole("button", { name: /^Livraison 1/ }).click();
    await expect(quantity).toHaveValue("1");
    await page.getByRole("button", { name: /^Livraison 2/ }).click();
    await expect(quantity).toHaveValue("3");
    await page.screenshot({ path: "outputs/recette-agents/mail-ecarts/deux-livraisons.png", fullPage: true });
    expect(pageErrors).toEqual([]);
  } finally {
    await page.request.post("/api/auth/logout").catch(() => undefined);
    await prisma.$disconnect();
  }
});
