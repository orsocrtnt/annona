import { expect, test } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { prisma } from "../../src/services/prisma/client";

/**
 * DISPATCH-4 tranche 1 : suggestions de livreurs et affectation en un clic, sur annona-dev.
 * Livraison E2E sans client
 * (aucune notification), supprimée en fin de test. Aucune position de livreur n'est créée :
 * le trajet est « inconnu » et aucun appel au service de trajet n'est fait.
 */
test("DISPATCH-4 : 3 suggestions expliquées, double clic sur « Affecter » = une seule affectation", async ({ page }) => {
  test.setTimeout(120_000);
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  let orderId: string | null = null;
  let driverId: string | null = null;
  try {
    const login = await page.request.post("/api/auth/login", {
      data: { email: "demo@annona.fr", password: "Demo2026!", demoTestSession: true, accountType: "company" },
    });
    expect(login.status()).toBe(200);
    expect((await page.request.post("/api/demo/persona", { data: { persona: "admin" } })).status()).toBe(200);

    // La session de test réserve une entreprise du pool de démo : la livraison doit être créée dans celle-ci.
    const session = (await (await page.request.get("/api/auth/session")).json()) as { user: { companyId: string } };
    const companyId = session.user.companyId;
    const tag = randomUUID().slice(0, 8);
    const order = await prisma.order.create({
      data: { reference: `E2E-D4-UI-${tag}`, totalAmount: 10, companyId, shippingAddress: "1 rue E2E", shippingCity: "Paris", shippingPostalCode: "75011" },
    });
    orderId = order.id;
    // Un livreur E2E libre garantit au moins une suggestion, quel que soit l'état de la démo.
    const driverRole = await prisma.role.findFirstOrThrow({ where: { systemRole: "DRIVER" }, select: { id: true } });
    const driver = await prisma.user.create({
      data: { authId: `e2e-d4-ui-${tag}`, email: `livreur-${tag}@e2e-d4.invalid`, firstName: "E2E", lastName: `D4 ${tag}`, status: "ACTIVE", roleId: driverRole.id, companyId },
    });
    driverId = driver.id;
    const delivery = await prisma.delivery.create({
      data: { reference: `E2E-LIV-D4-UI-${tag}`, address: "1 rue E2E", city: "Paris", postalCode: "75011", companyId, orderId: order.id, pickupLatitude: 48.8566, pickupLongitude: 2.3522 },
    });

    const api = await page.request.get(`/api/dispatch/suggestions?deliveryId=${delivery.id}`);
    await page.goto(`/dashboard/deliveries/${delivery.id}`);
    await expect(page.getByRole("heading", { name: "Livreurs suggérés" })).toBeVisible();

    if (api.status() === 403) {
      // Offre sans l'option : l'écran le dit clairement, aucun bouton d'affectation.
      await expect(page.getByText(/option « Dispatch intelligent »/)).toBeVisible();
      await expect(page.getByRole("button", { name: /^Affecter à / })).toHaveCount(0);
      return;
    }
    expect(api.status()).toBe(200);
    const body = (await api.json()).data as { suggestions: Array<{ driverId: string; explanation: string }> };
    expect(JSON.stringify(body)).not.toMatch(/latitude|longitude|email|phone/);
    expect(body.suggestions.length).toBeLessThanOrEqual(3);
    expect(body.suggestions.length).toBeGreaterThan(0);

    const firstRow = page.locator(`section[aria-labelledby="suggestions-${delivery.id}"] ol > li`).first();
    await expect(firstRow).toContainText(body.suggestions[0]!.explanation);
    await expect(firstRow).toContainText(`Score ${(body.suggestions[0] as { score?: number }).score}/100`);
    const first = firstRow.getByRole("button", { name: /^Affecter à / });
    const posted = page.waitForResponse((r) => r.url().includes("/api/dispatch/suggestions") && r.request().method() === "POST");
    await first.dblclick();
    expect((await posted).status()).toBe(200);
    // La fiche se recharge après la réponse : le panneau disparaît (livraison affectée).
    await expect(page.getByRole("heading", { name: "Livreurs suggérés" })).toBeHidden();

    await expect.poll(async () => (await prisma.delivery.findUniqueOrThrow({ where: { id: delivery.id } })).driverId).toBe(body.suggestions[0]!.driverId);
    expect(await prisma.trackingEvent.count({ where: { deliveryId: delivery.id } })).toBe(1);

    // Client : refusé, sans fuite.
    expect((await page.request.post("/api/demo/persona", { data: { persona: "client" } })).status()).toBe(200);
    expect((await page.request.get(`/api/dispatch/suggestions?deliveryId=${delivery.id}`)).status()).toBe(403);
    expect(pageErrors).toEqual([]);
  } finally {
    if (orderId) await prisma.order.deleteMany({ where: { id: orderId } });
    if (driverId) await prisma.user.deleteMany({ where: { id: driverId } });
    await page.request.post("/api/auth/logout").catch(() => undefined);
    await prisma.$disconnect();
  }
});
