import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

test("UX-03 : fiche livraison canonique, référence de livraison en titre et commande en informations techniques", async ({ page }) => {
  const login = await page.request.post("/api/auth/login", {
    data: { email: "demo@tutelliv.fr", password: "Demo2026!", demoTestSession: true, accountType: "company" },
  });
  expect(login.status()).toBe(200);
  try {
    const list = await page.request.get("/api/deliveries");
    expect(list.status()).toBe(200);
    const deliveries = (await list.json()).data as Array<{ id: string; reference: string; order: { reference: string } }>;
    expect(deliveries.length).toBeGreaterThan(0);
    const delivery = deliveries[0]!;

    await page.goto(`/dashboard/deliveries/${delivery.id}`);
    await expect(page.getByRole("heading", { level: 1, name: delivery.reference })).toBeVisible();
    await expect(page.locator("[data-delivery-summary=true]")).toContainText("Livreur");
    await expect(page.locator("[data-delivery-summary=true]")).toContainText("Échéance");
    const detail = (await (await page.request.get(`/api/deliveries/${delivery.id}`)).json()).data as { timing: { nextAction: { label: string } | null } };
    if (detail.timing.nextAction) await expect(page.getByRole("status").filter({ hasText: detail.timing.nextAction.label })).toBeVisible();
    const technical = page.locator("[data-delivery-technical=true]");
    const orderLink = technical.getByRole("link", { name: delivery.order.reference });
    await expect(orderLink).toBeHidden();
    await technical.locator("summary").click();
    await expect(orderLink).toHaveAttribute("href", /^\/dashboard\/orders\//);

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole("heading", { level: 1, name: delivery.reference })).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

    await page.getByRole("link", { name: "Retour au dispatch", exact: true }).click();
    await expect(page).toHaveURL(/\/dispatch$/);
    // Depuis la file de dispatch, la ligne ouvre la fiche livraison, plus la commande.
    const rowLink = page.locator('a[href^="/dashboard/deliveries/"]').first();
    await expect(rowLink).toBeVisible();
    expect(await page.locator('main a[href^="/dashboard/orders/"]').count()).toBe(0);
    await rowLink.click();
    await expect(page).toHaveURL(/\/dashboard\/deliveries\//);
    await expect(page.getByText("Livraison", { exact: true })).toBeVisible();

    // Identifiant inconnu ou d'une autre entreprise : même réponse, sans fuite.
    await page.goto("/dashboard/deliveries/livraison-inexistante-ux03");
    await expect(page.getByText("Livraison introuvable")).toBeVisible();
  } finally {
    await page.request.post("/api/auth/logout").catch(() => undefined);
  }
});

const login = async (page: import("@playwright/test").Page) => {
  const response = await page.request.post("/api/auth/login", {
    data: { email: "demo@tutelliv.fr", password: "Demo2026!", demoTestSession: true, accountType: "company" },
  });
  expect(response.status()).toBe(200);
};
const persona = async (page: import("@playwright/test").Page, value: "admin" | "client" | "driver") => {
  expect((await page.request.post("/api/demo/persona", { data: { persona: value } })).status()).toBe(200);
};

test("UX-03 : une fiche par statut présent dans la démo, avec la prochaine action du serveur, et les alertes y mènent", async ({ page }) => {
  test.setTimeout(180_000);
  await login(page);
  try {
    const deliveries = (await (await page.request.get("/api/deliveries")).json()).data as Array<{ id: string; reference: string; status: string }>;
    const byStatus = new Map<string, { id: string; reference: string }>();
    for (const delivery of deliveries) if (!byStatus.has(delivery.status)) byStatus.set(delivery.status, delivery);
    expect(byStatus.size).toBeGreaterThan(1);
    for (const [status, delivery] of byStatus) {
      const detail = (await (await page.request.get(`/api/deliveries/${delivery.id}`)).json()).data as { timing: { nextAction: { label: string } | null; late: boolean } };
      await page.goto(`/dashboard/deliveries/${delivery.id}`);
      await expect(page.getByRole("heading", { level: 1, name: delivery.reference }), status).toBeVisible();
      if (detail.timing.nextAction) await expect(page.getByRole("status").filter({ hasText: detail.timing.nextAction.label }), status).toBeVisible();
      if (detail.timing.late) await expect(page.getByRole("status").filter({ hasText: "En retard de" }), status).toBeVisible();
    }

    // Les alertes liées à une livraison ouvrent sa fiche.
    await page.goto("/dashboard");
    // Le bandeau d'alertes est compact : le détail se déplie avec « Voir ».
    const alertToggle = page.getByRole("button", { name: "Voir", exact: true });
    if (await alertToggle.count()) await alertToggle.first().click();
    const alertLinks = page.locator('section[aria-label$="alertes à suivre"] a, section[aria-label$="alerte à suivre"] a');
    if (await alertLinks.count()) {
      await expect(alertLinks.first()).toHaveAttribute("href", /^\/dashboard\/deliveries\//);
      await alertLinks.first().click();
      await expect(page).toHaveURL(/\/dashboard\/deliveries\//);
      await expect(page.getByText("Livraison", { exact: true })).toBeVisible();
    }
  } finally {
    await page.request.post("/api/auth/logout").catch(() => undefined);
  }
});

test("UX-03 : variante client, échéance et retard sans consigne interne, livraison d'équipe refusée", async ({ page }) => {
  test.setTimeout(120_000);
  await login(page);
  try {
    const staffDeliveries = (await (await page.request.get("/api/deliveries")).json()).data as Array<{ id: string }>;
    await persona(page, "client");
    const list = await page.request.get("/api/portal/deliveries");
    expect(list.status()).toBe(200);
    const body = await list.json();
    const items = (Array.isArray(body.data) ? body.data : body.data?.items ?? []) as Array<{ id: string; reference: string }>;
    expect(items.length).toBeGreaterThan(0);
    const mine = items[0]!;
    const detail = await (await page.request.get(`/api/portal/deliveries/${mine.id}`)).json();
    expect(detail.data.timing).toBeTruthy();
    expect("nextAction" in detail.data.timing).toBe(false);
    await page.goto(`/portal/deliveries/${mine.id}`);
    await expect(page.getByRole("heading", { level: 1, name: mine.reference })).toBeVisible();
    if (detail.data.timing.dueAt) await expect(page.locator("[data-delivery-due=true]")).toContainText("Prévue le");
    expect((await page.request.get(`/api/deliveries/${mine.id}`)).status()).toBe(403);
    const foreign = staffDeliveries.find((delivery) => !items.some((item) => item.id === delivery.id));
    if (foreign) expect((await page.request.get(`/api/portal/deliveries/${foreign.id}`)).status()).toBe(404);
  } finally {
    await page.request.post("/api/auth/logout").catch(() => undefined);
  }
});

test("UX-03 : variante livreur, échéance sur la carte de mission et mission d'un autre refusée", async ({ page }) => {
  test.setTimeout(120_000);
  await login(page);
  try {
    const staffDeliveries = (await (await page.request.get("/api/deliveries")).json()).data as Array<{ id: string }>;
    await persona(page, "driver");
    const body = (await (await page.request.get("/api/driver/missions")).json()).data as { missions: Array<{ id: string; status: string; timing?: { dueAt: string | null } }> };
    expect(body.missions.length).toBeGreaterThan(0);
    for (const mission of body.missions) {
      expect(mission.timing).toBeTruthy();
      expect("nextAction" in mission.timing!).toBe(false);
    }
    await page.goto("/driver/missions");
    if (body.missions.some((mission) => mission.timing?.dueAt && !["DELIVERED", "FAILED"].includes(mission.status))) {
      await expect(page.locator("[data-mission-due=true]").first()).toContainText("À livrer avant");
    }
    const foreign = staffDeliveries.find((delivery) => !body.missions.some((mission) => mission.id === delivery.id));
    if (foreign) expect((await page.request.get(`/api/driver/missions/${foreign.id}`)).status()).toBe(404);
  } finally {
    await page.request.post("/api/auth/logout").catch(() => undefined);
  }
});

// Comptes de recette par rôle créés sur la base de développement par `npm run e2e:role-accounts -- setup`.
type RoleAccounts = Record<"dispatcher" | "miniAdminDispatch" | "miniAdminSupport", { email: string; password: string }>;
const roleAccounts = (): RoleAccounts | null => {
  try {
    return JSON.parse(readFileSync(resolve("outputs/e2e-role-accounts.json"), "utf8")) as RoleAccounts;
  } catch {
    return null;
  }
};
const loginAs = async (page: import("@playwright/test").Page, account: { email: string; password: string }) => {
  expect((await page.request.post("/api/auth/login", { data: { ...account, accountType: "company" } })).status()).toBe(200);
};
const foreignDeliveryId = async (page: import("@playwright/test").Page) => {
  await login(page);
  try {
    return ((await (await page.request.get("/api/deliveries")).json()).data as Array<{ id: string }>)[0]?.id;
  } finally {
    await page.request.post("/api/auth/logout").catch(() => undefined);
  }
};

for (const key of ["dispatcher", "miniAdminDispatch"] as const) {
  test(`UX-03 : ${key} ouvre la fiche depuis le dispatch, sans accès à une livraison d'une autre entreprise`, async ({ page }) => {
    test.setTimeout(120_000);
    const accounts = roleAccounts();
    test.skip(!accounts, "comptes de rôle absents : npm run e2e:role-accounts -- setup");
    const foreign = await foreignDeliveryId(page);
    await loginAs(page, accounts![key]);
    try {
      const deliveries = (await (await page.request.get("/api/deliveries")).json()).data as Array<{ id: string; reference: string; status: string }>;
      expect(deliveries.length).toBeGreaterThan(0);
      await page.goto("/dispatch");
      const rowLink = page.locator('a[href^="/dashboard/deliveries/"]').first();
      await expect(rowLink).toBeVisible();
      await rowLink.click();
      await expect(page).toHaveURL(/\/dashboard\/deliveries\//);
      const id = page.url().split("/dashboard/deliveries/")[1]!;
      const delivery = deliveries.find((entry) => entry.id === id)!;
      await expect(page.getByRole("heading", { level: 1, name: delivery.reference })).toBeVisible();
      await expect(page.locator("[data-delivery-summary=true]")).toContainText("Échéance");
      const terminal = ["DELIVERED", "FAILED", "CANCELLED"].includes(delivery.status);
      await expect(page.getByText("Assigner à un chauffeur")).toHaveCount(terminal ? 0 : 1);

      if (foreign) {
        expect((await page.request.get(`/api/deliveries/${foreign}`)).status()).toBe(404);
        await page.goto(`/dashboard/deliveries/${foreign}`);
        await expect(page.getByText("Livraison introuvable")).toBeVisible();
      }
    } finally {
      await page.request.post("/api/auth/logout").catch(() => undefined);
    }
  });
}

test("UX-03 : un mini-admin sans module de livraison ne lit pas la fiche", async ({ page }) => {
  test.setTimeout(120_000);
  const accounts = roleAccounts();
  test.skip(!accounts, "comptes de rôle absents : npm run e2e:role-accounts -- setup");
  await loginAs(page, accounts!.miniAdminDispatch);
  let id: string | undefined;
  try {
    id = ((await (await page.request.get("/api/deliveries")).json()).data as Array<{ id: string }>)[0]?.id;
  } finally {
    await page.request.post("/api/auth/logout").catch(() => undefined);
  }
  expect(id).toBeTruthy();
  await loginAs(page, accounts!.miniAdminSupport);
  try {
    expect((await page.request.get(`/api/deliveries/${id}`)).status()).toBe(403);
    await page.goto(`/dashboard/deliveries/${id}`);
    await expect(page.getByText("Livraison introuvable")).toBeVisible();
    await expect(page.locator("[data-delivery-summary=true]")).toHaveCount(0);
  } finally {
    await page.request.post("/api/auth/logout").catch(() => undefined);
  }
});

test("UX-03 : parcours au clavier, de la file de dispatch aux informations techniques", async ({ page }) => {
  test.setTimeout(120_000);
  const accounts = roleAccounts();
  test.skip(!accounts, "comptes de rôle absents : npm run e2e:role-accounts -- setup");
  await loginAs(page, accounts!.dispatcher);
  try {
    await page.goto("/dispatch");
    const rowLink = page.locator('a[href^="/dashboard/deliveries/"]').first();
    await expect(rowLink).toBeVisible();
    await rowLink.focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/dashboard\/deliveries\//);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    const focused = () => page.evaluate(() => {
      const element = document.activeElement as HTMLElement | null;
      if (!element || element === document.body) return null;
      const style = getComputedStyle(element);
      return {
        text: (element.textContent ?? "").trim().slice(0, 60),
        tag: element.tagName,
        technical: Boolean(element.closest("[data-delivery-technical=true]")),
        visible: style.outlineStyle !== "none" || style.boxShadow !== "none",
      };
    });
    // Tab jusqu'au retour au dispatch puis jusqu'aux informations techniques, focus toujours visible.
    const reached: string[] = [];
    let summary = false;
    for (let step = 0; step < 80 && !summary; step++) {
      await page.keyboard.press("Tab");
      const current = await focused();
      if (!current) continue;
      reached.push(current.text);
      if (current.text === "Retour au dispatch" || current.technical) expect(current.visible, current.text).toBe(true);
      summary = current.tag === "SUMMARY" && current.technical;
    }
    expect(reached).toContain("Retour au dispatch");
    expect(summary).toBe(true);
    await page.keyboard.press("Enter");
    await page.keyboard.press("Tab");
    const link = await focused();
    expect(link?.technical).toBe(true);
    expect(link?.tag).toBe("A");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/dashboard\/orders\//);
  } finally {
    await page.request.post("/api/auth/logout").catch(() => undefined);
  }
});
