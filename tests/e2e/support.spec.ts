import { expect, test } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { prisma } from "../../src/services/prisma/client";

const proofPath = "outputs/support1/browser.json";

test("SUPPORT-1 : ticket client, réponse staff, notification et résolution visibles", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const marker = `SUPPORT-1 navigateur ${crypto.randomUUID()}`;
  const pageErrors: string[] = [];
  let ticketId: string | null = null;
  page.on("pageerror", (error) => pageErrors.push(error.message));

  try {
    const login = await page.request.post("/api/auth/login", {
      data: {
        email: "demo@tutelliv.fr",
        password: "Demo2026!",
        accountType: "company",
      },
    });
    expect(login.status()).toBe(200);

    const persona = async (value: "admin" | "client" | "driver") => {
      const response = await page.request.post("/api/demo/persona", {
        data: { persona: value },
      });
      expect(response.status()).toBe(200);
    };

    await persona("client");
    const created = await page.request.post("/api/portal/support", {
      data: {
        subject: marker,
        message: "Demande fictive SUPPORT-1 créée pour vérifier toute la boucle.",
        contactType: "ADMIN",
      },
    });
    expect(created.status()).toBe(201);
    const createdBody = (await created.json()) as { data?: { id?: string } };
    ticketId = createdBody.data?.id ?? null;
    expect(ticketId).toBeTruthy();

    await page.goto(`/portal/support/${ticketId}`);
    await expect(page.getByRole("heading", { name: marker })).toBeVisible();
    await expect(page.getByText("Demande fictive SUPPORT-1 créée", { exact: false })).toBeVisible();

    const clientDeniedStaff = await page.request.get("/api/support");
    expect(clientDeniedStaff.status()).toBe(403);

    await persona("admin");
    await page.goto("/support");
    await expect(page.getByRole("heading", { name: "Support clients" })).toBeVisible();
    const card = page.locator(`[data-support-ticket="${ticketId}"]`);
    await expect(card).toBeVisible();
    await card.getByLabel("Répondre au client").fill(
      "Réponse fictive : votre demande est maintenant prise en charge."
    );
    await card.getByRole("button", { name: "Envoyer", exact: true }).click();
    await expect(card.getByText("Réponse fictive : votre demande", { exact: false })).toBeVisible();
    await expect(card.getByLabel("Statut")).toBeEnabled();
    await page.getByLabel("Afficher").selectOption("ALL");
    await card.getByLabel("Statut").selectOption("RESOLVED");
    await expect(card.locator('[data-current-status="RESOLVED"]')).toBeVisible();

    await persona("client");
    await page.goto(`/portal/support/${ticketId}`);
    await expect(page.getByText("Réponse fictive : votre demande", { exact: false })).toBeVisible();
    await expect(page.locator('[data-current-status="RESOLVED"]')).toBeVisible();
    const notifications = await page.request.get("/api/portal/notifications");
    expect(notifications.status()).toBe(200);
    const notificationBody = (await notifications.json()) as {
      data?: Array<{ type: string; href: string | null }>;
    };
    const supportNotifications = (notificationBody.data ?? []).filter(
      (item) => item.type === "SUPPORT" && item.href === `/portal/support/${ticketId}`
    );
    expect(supportNotifications.length).toBeGreaterThanOrEqual(2);

    await persona("driver");
    const driverDeniedClient = await page.request.get(`/api/portal/support/${ticketId}`);
    expect(driverDeniedClient.status()).toBe(403);

    expect(pageErrors).toEqual([]);
    mkdirSync("outputs/support1", { recursive: true });
    writeFileSync(
      proofPath,
      `${JSON.stringify(
        {
          task: "SUPPORT-1",
          passed: true,
          clientCreated: true,
          staffReceived: true,
          staffReplied: true,
          notificationVisible: true,
          resolutionVisible: true,
          accessRefusals: { clientToStaff: 403, driverToClient: 403 },
          pageErrors,
        },
        null,
        2
      )}\n`,
      "utf8"
    );
  } finally {
    if (ticketId) {
      await prisma.clientNotification.deleteMany({
        where: { href: `/portal/support/${ticketId}` },
      });
      await prisma.supportTicket.deleteMany({ where: { id: ticketId } });
      const [tickets, notifications] = await Promise.all([
        prisma.supportTicket.count({ where: { id: ticketId } }),
        prisma.clientNotification.count({ where: { href: `/portal/support/${ticketId}` } }),
      ]);
      expect({ tickets, notifications }).toEqual({ tickets: 0, notifications: 0 });
    }
  }
});
