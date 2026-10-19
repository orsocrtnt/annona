import { expect, test } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";

const outputPath = "outputs/test2/browser.json";

type DemoPersona = "admin" | "client" | "driver";

test("TEST-2 : les trois rôles, le suivi, la facture, les refus et une panne réseau", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  const login = await page.request.post("/api/auth/login", {
    data: {
      email: "demo@tutelliv.fr",
      password: "Demo2026!",
      accountType: "company",
    },
  });
  expect(login.ok()).toBeTruthy();

  const selectPersona = async (persona: DemoPersona) => {
    const response = await page.request.post("/api/demo/persona", { data: { persona } });
    expect(response.status()).toBe(200);
  };

  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Tableau de bord", exact: true })).toBeVisible();
  const adminOrders = await page.request.get("/api/orders");
  expect(adminOrders.status()).toBe(200);
  await page.goto("/dispatch");
  await expect(page.getByRole("heading", { name: "Centre de dispatch", exact: true })).toBeVisible();

  await selectPersona("client");
  await page.goto("/portal/orders");
  await expect(page.getByRole("heading", { name: "Mes commandes", exact: true })).toBeVisible();
  const clientOrders = await page.request.get("/api/portal/orders?history=false");
  expect(clientOrders.status()).toBe(200);
  const clientOrdersBody = (await clientOrders.json()) as {
    data?: { items?: Array<{ id: string }> };
  };
  const firstOrder = clientOrdersBody.data?.items?.[0];
  expect(firstOrder?.id).toBeTruthy();
  await page.goto(`/portal/orders/${firstOrder!.id}`);
  await expect(page.locator("main h1")).toBeVisible();
  await expect(page.locator('[aria-label="Suivi partagé"]')).toBeVisible();

  const invoices = await page.request.get("/api/portal/invoices");
  expect(invoices.status()).toBe(200);
  const invoicesBody = (await invoices.json()) as { data?: unknown[] };
  expect(Array.isArray(invoicesBody.data)).toBeTruthy();
  expect(invoicesBody.data!.length).toBeGreaterThan(0);
  await page.goto("/portal/invoices");
  await expect(page.getByRole("heading", { name: "Factures", exact: true })).toBeVisible();
  const clientDeniedStaff = await page.request.get("/api/orders");
  expect(clientDeniedStaff.status()).toBe(403);

  await selectPersona("driver");
  await page.goto("/driver/missions");
  await expect(page.getByRole("heading", { name: "Missions", exact: true })).toBeVisible();
  const missions = await page.request.get("/api/driver/missions");
  expect(missions.status()).toBe(200);
  const missionsBody = (await missions.json()) as {
    data?: { missions?: unknown[]; available?: unknown[] };
  };
  const missionCount =
    (missionsBody.data?.missions?.length ?? 0) + (missionsBody.data?.available?.length ?? 0);
  expect(missionCount).toBeGreaterThan(0);
  const driverDeniedPortal = await page.request.get("/api/portal/orders?history=false");
  expect(driverDeniedPortal.status()).toBe(403);

  const failurePage = await page.context().newPage();
  const failureErrors: string[] = [];
  failurePage.on("pageerror", (error) => failureErrors.push(error.message));
  await failurePage.route("**/api/driver/missions", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: "TEST2_NETWORK_FAILURE" }),
    })
  );
  await failurePage.goto("/driver/missions");
  await expect(
    failurePage.getByRole("heading", { name: "Impossible de charger les missions", exact: true })
  ).toBeVisible();
  await failurePage.close();

  expect(pageErrors).toEqual([]);
  expect(failureErrors).toEqual([]);
  const proof = {
    task: "TEST-2",
    passed: true,
    roles: {
      admin: { dashboard: true, dispatch: true, ordersApi: 200 },
      client: { orders: true, tracking: true, invoices: invoicesBody.data!.length },
      driver: { missions: missionCount },
    },
    accessRefusals: {
      clientToStaffApi: clientDeniedStaff.status(),
      driverToClientApi: driverDeniedPortal.status(),
    },
    failureScenario: {
      endpoint: "driver missions",
      injectedStatus: 503,
      visibleFallback: "Impossible de charger les missions",
    },
    pageErrors,
    fixtureMutation: false,
  };
  mkdirSync("outputs/test2", { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(proof, null, 2)}\n`, "utf8");
});
