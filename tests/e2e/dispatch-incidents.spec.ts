import { expect, test } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { prisma } from "../../src/services/prisma/client";

/**
 * DISPATCH-5 : imprévus de la file et remplacement validé par le dispatcher, sur tutelliv-dev.
 * Données E2E sans client, supprimées en fin de test. Aucune position de livreur n'est créée.
 */
test("DISPATCH-5 : un livreur désactivé est signalé et remplacé après validation, un client n'y a pas accès", async ({ page }) => {
  test.setTimeout(150_000);
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  const orderIds: string[] = [];
  const driverIds: string[] = [];
  try {
    const login = await page.request.post("/api/auth/login", {
      data: { email: "demo@tutelliv.fr", password: "Demo2026!", demoTestSession: true, accountType: "company" },
    });
    expect(login.status()).toBe(200);
    expect((await page.request.post("/api/demo/persona", { data: { persona: "admin" } })).status()).toBe(200);
    const session = (await (await page.request.get("/api/auth/session")).json()) as { user: { companyId: string } };
    const companyId = session.user.companyId;
    const tag = randomUUID().slice(0, 8);
    const role = await prisma.role.findFirstOrThrow({ where: { systemRole: "DRIVER" }, select: { id: true } });
    const makeDriver = async (name: string, status: "ACTIVE" | "INACTIVE") => {
      const driver = await prisma.user.create({
        data: { authId: `e2e-d5-${name}-${tag}`, email: `${name}-${tag}@e2e-d5.invalid`, firstName: "E2E", lastName: `${name} ${tag}`, status, roleId: role.id, companyId },
      });
      driverIds.push(driver.id);
      return driver;
    };
    const absent = await makeDriver("absent", "ACTIVE");
    const free = await makeDriver("libre", "ACTIVE");
    const order = await prisma.order.create({
      data: { reference: `E2E-D5-${tag}`, totalAmount: 10, companyId, shippingAddress: "1 rue E2E", shippingCity: "Paris", shippingPostalCode: "75011", status: "ASSIGNED" },
    });
    orderIds.push(order.id);
    const delivery = await prisma.delivery.create({
      data: { reference: `E2E-LIV-D5-${tag}`, address: "1 rue E2E", city: "Paris", postalCode: "75011", companyId, orderId: order.id, status: "ASSIGNED", driverId: absent.id, driverName: "E2E absent", pickupLatitude: 48.8566, pickupLongitude: 2.3522 },
    });
    await prisma.user.update({ where: { id: absent.id }, data: { status: "SUSPENDED" } });

    const api = await page.request.get("/api/dispatch/incidents");
    expect(api.status()).toBe(200);
    const raw = await api.text();
    expect(raw).not.toMatch(/latitude|longitude|settings/);
    const listed = (JSON.parse(raw).data as Array<{ deliveryId: string; kind: string; replacesDriverId: string | null }>).find((row) => row.deliveryId === delivery.id);
    expect(listed?.kind).toBe("DRIVER_UNAVAILABLE");
    expect(listed?.replacesDriverId).toBe(absent.id);

    await page.goto("/dispatch");
    const panel = page.getByTestId("dispatch-incidents");
    const row = panel.locator("div.rounded-xl", { hasText: delivery.reference });
    await expect(row).toContainText("Livreur indisponible");
    await page.screenshot({ path: "/private/tmp/claude-501/-Users-orso-Developer-TutelLiv-GPT/0b96e538-7432-4425-8719-54fa38c29d80/scratchpad/incidents-clair.png" });

    const suggestions = await page.request.get(`/api/dispatch/suggestions?deliveryId=${delivery.id}&replacesDriverId=${absent.id}`);
    if (suggestions.status() === 403) {
      await row.getByRole("button", { name: "Proposer un livreur" }).click();
      await expect(row.getByText(/option « Dispatch intelligent »/)).toBeVisible();
      return;
    }
    expect(suggestions.status()).toBe(200);
    const proposed = (await suggestions.json()).data as { assignable: boolean; suggestions: Array<{ driverId: string }> };
    expect(proposed.assignable).toBe(true);
    expect(proposed.suggestions.map((s) => s.driverId)).not.toContain(absent.id);

    // Sans le livreur attendu, ou avec un autre, l'affectation existante n'est jamais remplacée en silence.
    const refused = await page.request.post("/api/dispatch/suggestions", { data: { deliveryId: delivery.id, driverId: free.id, replacesDriverId: free.id } });
    expect(refused.status()).toBe(409);
    expect((await prisma.delivery.findUniqueOrThrow({ where: { id: delivery.id } })).driverId).toBe(absent.id);

    await row.getByRole("button", { name: "Proposer un livreur" }).click();
    const first = row.getByRole("button", { name: /^Affecter à / }).first();
    await expect(first).toBeVisible();
    const posted = page.waitForResponse((r) => r.url().includes("/api/dispatch/suggestions") && r.request().method() === "POST");
    await first.click();
    expect((await posted).status()).toBe(200);
    await expect.poll(async () => (await prisma.delivery.findUniqueOrThrow({ where: { id: delivery.id } })).driverId).toBe(proposed.suggestions[0]!.driverId);
    await expect(panel.getByText(delivery.reference)).toHaveCount(0);

    expect((await page.request.post("/api/demo/persona", { data: { persona: "client" } })).status()).toBe(200);
    expect((await page.request.get("/api/dispatch/incidents")).status()).toBe(403);
    expect(pageErrors).toEqual([]);
  } finally {
    await prisma.operationJob.deleteMany({ where: { jobKey: { startsWith: "driver-push:mission:" }, status: { in: ["SUCCEEDED", "PENDING", "FAILED"] }, payload: { path: ["driverId"], equals: driverIds[0] ?? "" } } }).catch(() => undefined);
    if (orderIds.length) await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
    if (driverIds.length) await prisma.user.deleteMany({ where: { id: { in: driverIds } } });
    await page.request.post("/api/auth/logout").catch(() => undefined);
    await prisma.$disconnect();
  }
});
