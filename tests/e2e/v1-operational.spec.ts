import { expect, test, type Locator, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { prisma } from "../../src/services/prisma/client";
import { cleanupPodPhotoOrphans, deletePodPhoto } from "../../src/lib/storage/pod";
import { DEMO_PERSONA_COOKIE, demoPersonaAuthId } from "../../src/lib/demo/constants";

const outputDirectory = "outputs/v1-go";
const outputPath = `${outputDirectory}/browser-operational.json`;

type DemoPersona = "admin" | "client" | "driver";

type LoginBody = {
  user?: { companyId?: string | null };
};

type OrderRecord = {
  id: string;
  companyId: string;
  reference: string;
  deliveries: Array<{
    id: string;
    reference: string;
    podPhotoPath: string | null;
  }>;
};

function tomorrowDate() {
  const value = new Date(Date.now() + 24 * 60 * 60 * 1_000);
  return value.toISOString().slice(0, 10);
}

function isOrderDetailUrl(url: URL) {
  return /^\/portal\/orders\/[^/]+$/.test(url.pathname) && url.pathname !== "/portal/orders/new";
}

function missionCard(page: Page, reference: string): Locator {
  return page
    .getByText(reference, { exact: true })
    .locator("xpath=ancestor::div[contains(@class,'rounded-xl') and contains(@class,'border')][1]");
}

async function selectPersona(page: Page, persona: DemoPersona) {
  const cookie = (await page.context().cookies()).find(
    (candidate) => candidate.name === DEMO_PERSONA_COOKIE
  );
  expect(cookie, "Cookie de persona de la session démo absent").toBeTruthy();
  await page.context().addCookies([{ ...cookie!, value: persona }]);
}

async function submitPodWithLocationRetry(
  page: Page,
  dialog: Locator,
  submitLabel: "Valider la livraison" | "Enregistrer l’échec",
  deliveryId: string
) {
  const submit = dialog.getByRole("button", { name: submitLabel, exact: true });
  const confirm = page.getByRole("button", { name: "Confirmer quand même", exact: true });
  const feedback = dialog.getByRole("alert");

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    await expect(submit).toBeVisible();
    const responsePromise = page
      .waitForResponse(
        (response) =>
          new URL(response.url()).pathname === `/api/driver/missions/${deliveryId}` &&
          response.request().method() === "PATCH",
        { timeout: 45_000 }
      )
      .catch(() => null);
    await submit.click();
    for (let tick = 0; tick < 15; tick += 1) {
      if (await confirm.isVisible()) {
        await confirm.click();
        break;
      }
      if (await feedback.isVisible()) break;
      await page.waitForTimeout(1_000);
    }
    const response = await responsePromise;
    if (response?.ok()) {
      await expect(dialog).toBeHidden({ timeout: 30_000 });
      return;
    }
  }

  throw new Error(
    `La preuve n'a pas été envoyée après trois essais : ${
      (await feedback.textContent().catch(() => null)) ?? "retour absent"
    }`
  );
}

async function fillStandardOrder(page: Page, marker: string) {
  await page.goto("/portal/orders/new");
  await expect(page.getByRole("heading", { name: "Nouvelle commande", exact: true })).toBeVisible();
  await page.getByLabel("Nom", { exact: true }).fill(`Colis ${marker}`);
  await page.getByPlaceholder("Numéro et rue…").fill("1 place de la Concorde");
  await page.getByLabel(/^Ville/).fill("Paris");
  await page.getByLabel(/^Code postal/).fill("75008");
  await page.getByLabel(/^Date de livraison souhaitée/).fill(tomorrowDate());
  await chooseDeliverySlotIfAsked(page);
  await page.getByLabel("Notes", { exact: true }).fill(`${marker}:standard`);
}

/** Créneau demandé quand l'entreprise travaille par créneaux (réglage de la démo pour les courses). */
async function chooseDeliverySlotIfAsked(page: Page) {
  const slot = page.getByRole("combobox", { name: "Créneau de livraison" });
  if (!(await slot.isVisible().catch(() => false))) return;
  await slot.click();
  await page.getByRole("option").first().click();
}

async function fillCourierOrder(page: Page, marker: string) {
  await page.goto("/portal/orders/new");
  await expect(page.getByRole("heading", { name: "Nouvelle commande", exact: true })).toBeVisible();
  await page.getByRole("button", { name: /Course/ }).click();
  await page.getByLabel("Libellé", { exact: true }).fill("Collecte recette V1");
  await page.getByPlaceholder("Où récupérer l'élément…").fill("5 rue de Rivoli");
  await page.getByLabel(/^Ville/).nth(0).fill("Paris");
  await page.getByLabel(/^Code postal/).nth(0).fill("75001");
  await page.getByLabel("Article", { exact: true }).fill(`Dossier ${marker}`);
  await page.getByPlaceholder("Où livrer l'élément…").fill("10 boulevard Voltaire");
  await page.getByLabel(/^Ville/).nth(1).fill("Paris");
  await page.getByLabel(/^Code postal/).nth(1).fill("75011");
  await page.getByLabel(/^Date de livraison souhaitée/).fill(tomorrowDate());
  await chooseDeliverySlotIfAsked(page);
  await page.getByLabel("Notes", { exact: true }).fill(`${marker}:courier`);
}

async function orderByMarker(marker: string, suffix: "standard" | "courier") {
  return prisma.order.findFirstOrThrow({
    where: { notes: `${marker}:${suffix}` },
    select: {
      id: true,
      companyId: true,
      reference: true,
      deliveries: {
        select: { id: true, reference: true, podPhotoPath: true },
      },
    },
  });
}

async function assignOrder(page: Page, order: OrderRecord) {
  const driverPersona = await prisma.user.findFirstOrThrow({
    where: {
      companyId: order.companyId,
      authId: demoPersonaAuthId("driver", order.companyId),
    },
    select: { id: true },
  });
  await selectPersona(page, "admin");

  const optionsResponse = await page.request.get(
    `/api/dispatch/eligible-drivers?deliveryId=${order.deliveries[0]!.id}`
  );
  expect(optionsResponse.status()).toBe(200);
  const optionsBody = (await optionsResponse.json()) as {
    data?: Array<{
      driver: { id: string };
      eligible: boolean;
      reasons: string[];
    }>;
  };
  const selected = optionsBody.data?.find(
    (option) => option.driver.id === driverPersona.id
  );
  const onlySoftReasons =
    selected != null &&
    selected.reasons.length > 0 &&
    selected.reasons.every((reason) =>
      ["MAX_LOAD_REACHED", "MAX_CATEGORY_LOAD_REACHED"].includes(reason)
    );
  expect(
    selected && (selected.eligible || onlySoftReasons),
    "La persona livreur n'est pas compatible avec cette mission"
  ).toBeTruthy();
  const response = await page.request.patch(
    `/api/deliveries/${order.deliveries[0]!.id}/assign`,
    { data: { driverId: selected!.driver.id, force: onlySoftReasons } }
  );
  expect(response.status()).toBe(200);
}

async function acknowledgeAndStart(page: Page, deliveryReference: string) {
  await selectPersona(page, "driver");
  await page.goto("/driver/missions");
  let card = missionCard(page, deliveryReference);
  await expect(card.getByRole("button", { name: "Prendre en charge", exact: true })).toBeVisible();
  await card.getByRole("button", { name: "Prendre en charge", exact: true }).click();
  await expect(card.getByRole("button", { name: "Commencer la mission", exact: true })).toBeVisible();
  await card.getByRole("button", { name: "Commencer la mission", exact: true }).click();
  card = missionCard(page, deliveryReference);
  await expect(card.getByText("Mission en cours", { exact: true })).toBeVisible();
  return card;
}

test("V1-GO : double clic, course complète et échec motivé concordant", async ({ page }) => {
  test.setTimeout(900_000);
  page.setDefaultTimeout(30_000);
  page.setDefaultNavigationTimeout(60_000);
  mkdirSync(outputDirectory, { recursive: true });
  const marker = `V1-BROWSER-${randomUUID()}`;
  const pageErrors: string[] = [];
  const orderResponses: number[] = [];
  const proximityResponses: number[] = [];
  const browserPosition = { latitude: 48.8566, longitude: 2.3522 };
  let pickupOutOfRangeConfirmed = false;
  const screenshotPaths = {
    standard: `${outputDirectory}/r01-standard-reference.png`,
    courierClient: `${outputDirectory}/r06-courier-client.png`,
    courierAdmin: `${outputDirectory}/r06-courier-admin.png`,
    failureClient: `${outputDirectory}/r10-failure-client.png`,
    failureAdmin: `${outputDirectory}/r10-failure-admin.png`,
  };
  let companyId: string | null = null;
  let courier: OrderRecord | null = null;
  let standard: OrderRecord | null = null;
  let uploadedProofPath: string | null = null;
  let output: Record<string, unknown> = {
    task: "V1-GO-browser-operational",
    executedAt: new Date().toISOString(),
    fixture: "Session de démonstration isolée et marqueur aléatoire non exporté",
  };

  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("response", (response) => {
    if (response.url().endsWith("/api/portal/orders") && response.request().method() === "POST") {
      orderResponses.push(response.status());
    }
    if (/\/api\/driver\/missions\/[^/?]+\/proximity\?/.test(response.url())) {
      proximityResponses.push(response.status());
    }
  });

  let scenarioError: unknown;
  let clean = false;
  try {
    const login = await page.request.post("/api/auth/login", {
      data: {
        email: "demo@annona.fr",
        password: "Demo2026!",
        demoTestSession: true,
        accountType: "company",
      },
    });
    expect(login.ok()).toBeTruthy();
    const loginBody = (await login.json()) as LoginBody;
    companyId = loginBody.user?.companyId ?? null;
    expect(companyId).toBeTruthy();

    await selectPersona(page, "client");
    await fillStandardOrder(page, marker);
    const submit = page.getByRole("button", { name: "Créer la commande", exact: true });
    await expect(submit).toBeEnabled();
    await submit.evaluate((element) => {
      const button = element as HTMLButtonElement;
      button.click();
      button.click();
    });
    await page.waitForURL(isOrderDetailUrl, { timeout: 60_000 });
    standard = await orderByMarker(marker, "standard");
    expect(
      await prisma.order.count({ where: { notes: `${marker}:standard` } })
    ).toBe(1);
    await expect(page.getByRole("heading", { name: standard.reference, exact: true })).toBeVisible();
    await expect(page.locator('[aria-label="Suivi partagé"]')).toContainText(standard.reference);
    await page.locator("main").screenshot({ path: screenshotPaths.standard });
    console.log("[V1-GO] R01 validé");

    await fillCourierOrder(page, marker);
    await page.getByRole("button", { name: "Créer la commande", exact: true }).click();
    await page.waitForURL(isOrderDetailUrl, { timeout: 60_000 });
    courier = await orderByMarker(marker, "courier");
    expect(courier.deliveries).toHaveLength(1);

    // Les cibles de ces seules fixtures partagent une position déterministe :
    // Chromium et le serveur exercent ainsi le vrai contrôle de proximité,
    // sans dépendre d'un GPS physique ni d'un géocodeur externe.
    await Promise.all([
      prisma.delivery.update({
        where: { id: courier.deliveries[0]!.id },
        data: {
          pickupLatitude: browserPosition.latitude,
          pickupLongitude: browserPosition.longitude,
          latitude: browserPosition.latitude,
          longitude: browserPosition.longitude,
        },
      }),
      prisma.delivery.update({
        where: { id: standard.deliveries[0]!.id },
        data: {
          latitude: browserPosition.latitude,
          longitude: browserPosition.longitude,
        },
      }),
      prisma.orderStop.updateMany({
        where: { orderId: courier.id },
        data: {
          latitude: browserPosition.latitude,
          longitude: browserPosition.longitude,
        },
      }),
    ]);
    await page.context().grantPermissions(["geolocation"], {
      origin: new URL(page.url()).origin,
    });
    await page.context().setGeolocation(browserPosition);

    await selectPersona(page, "admin");
    await assignOrder(page, courier);
    const assignedDriver = await prisma.delivery.findUniqueOrThrow({
      where: { id: courier.deliveries[0]!.id },
      select: { driverId: true, driverName: true },
    });
    expect(assignedDriver.driverId).toBeTruthy();
    const missionPreparedAt = new Date();
    await prisma.$transaction([
      prisma.delivery.update({
        where: { id: standard.deliveries[0]!.id },
        data: {
          driverId: assignedDriver.driverId,
          driverName: assignedDriver.driverName,
          status: "IN_DELIVERY",
          missionAcceptedAt: missionPreparedAt,
          missionStartedAt: missionPreparedAt,
        },
      }),
      prisma.order.update({
        where: { id: standard.id },
        data: { status: "IN_DELIVERY" },
      }),
    ]);
    await prisma.$disconnect();
    let courierCard = await acknowledgeAndStart(page, courier.deliveries[0]!.reference);

    const skippedPickup = await page.request.patch(
      `/api/driver/missions/${courier.deliveries[0]!.id}`,
      { data: { status: "IN_DELIVERY" } }
    );
    expect(skippedPickup.status()).toBe(409);

    await courierCard.getByRole("button", { name: "Colis récupéré", exact: true }).click();
    courierCard = missionCard(page, courier.deliveries[0]!.reference);
    const leaveForDelivery = courierCard.getByRole("button", {
      name: "Partir en livraison",
      exact: true,
    });
    const confirmOutOfRange = page.getByRole("button", {
      name: "Confirmer quand même",
      exact: true,
    });
    await Promise.race([
      leaveForDelivery.waitFor({ state: "visible", timeout: 30_000 }),
      confirmOutOfRange.waitFor({ state: "visible", timeout: 30_000 }),
    ]);
    if (await confirmOutOfRange.isVisible()) {
      pickupOutOfRangeConfirmed = true;
      await confirmOutOfRange.click();
    }
    await expect(leaveForDelivery).toBeVisible();
    await leaveForDelivery.click();
    await expect(courierCard.getByRole("button", { name: "Confirmer la livraison", exact: true })).toBeVisible();
    await courierCard.getByRole("button", { name: "Confirmer la livraison", exact: true }).click();
    const proofDialog = page.getByRole("dialog", { name: "Preuve de livraison" });
    await proofDialog.locator('input[type="file"]').setInputFiles({
      name: "preuve-v1.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
        "base64"
      ),
    });
    await proofDialog.getByLabel("Note", { exact: true }).fill("Course livrée — recette navigateur V1");
    await submitPodWithLocationRetry(
      page,
      proofDialog,
      "Valider la livraison",
      courier.deliveries[0]!.id
    );
    await prisma.$disconnect();
    const deliveredCourier = await prisma.delivery.findUniqueOrThrow({
      where: { id: courier.deliveries[0]!.id },
      select: { status: true, podPhotoPath: true },
    });
    expect(deliveredCourier.status).toBe("DELIVERED");
    uploadedProofPath = deliveredCourier.podPhotoPath;
    expect(uploadedProofPath).toBeTruthy();
    console.log("[V1-GO] R02/R06 course livreur validée");

    await selectPersona(page, "client");
    await page.goto(`/portal/deliveries/${courier.deliveries[0]!.id}`);
    await expect(page.getByText("Preuve de livraison", { exact: true })).toBeVisible();
    await expect(page.getByText("Course livrée — recette navigateur V1", { exact: true })).toBeVisible();
    await expect(page.getByRole("img", { name: "Preuve de livraison", exact: true })).toBeVisible();
    await page.locator("main").screenshot({ path: screenshotPaths.courierClient });

    await selectPersona(page, "admin");
    await page.goto(`/dashboard/orders/${courier.id}`);
    await expect(page.getByText("Preuve de livraison", { exact: true })).toBeVisible();
    await expect(page.getByText("Course livrée — recette navigateur V1", { exact: true })).toBeVisible();
    await page.locator("main").screenshot({ path: screenshotPaths.courierAdmin });
    console.log("[V1-GO] R06 projections client/admin validées");

    await selectPersona(page, "driver");
    const context = page.context();
    await page.close();
    page = await context.newPage();
    page.setDefaultTimeout(30_000);
    page.setDefaultNavigationTimeout(60_000);
    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("response", (response) => {
      if (/\/api\/driver\/missions\/[^/?]+\/proximity\?/.test(response.url())) {
        proximityResponses.push(response.status());
      }
    });

    await page.goto("/driver/missions", { waitUntil: "domcontentloaded" });
    const standardCard = missionCard(page, standard.deliveries[0]!.reference);
    await expect(standardCard.getByRole("button", { name: "Échec de livraison", exact: true })).toBeVisible();
    await standardCard.getByRole("button", { name: "Échec de livraison", exact: true }).click();
    const failureDialog = page.getByRole("dialog").filter({
      has: page.getByRole("heading", { name: "Échec de livraison", exact: true }),
    });
    await failureDialog.getByRole("combobox", { name: "Motif", exact: true }).selectOption("ABSENT");
    const failureNote = failureDialog.getByRole("textbox", { name: "Note", exact: true });
    await failureNote.fill("Destinataire absent — recette navigateur V1");
    await expect(failureNote).toHaveValue("Destinataire absent — recette navigateur V1");
    await submitPodWithLocationRetry(
      page,
      failureDialog,
      "Enregistrer l’échec",
      standard.deliveries[0]!.id
    );
    await prisma.$disconnect();
    const failedStandard = await prisma.delivery.findUniqueOrThrow({
      where: { id: standard.deliveries[0]!.id },
      select: { status: true, podFailureCode: true },
    });
    expect(failedStandard).toEqual({ status: "FAILED", podFailureCode: "ABSENT" });
    console.log("[V1-GO] R10 échec motivé enregistré");

    await selectPersona(page, "client");
    await page.goto(`/portal/deliveries/${standard.deliveries[0]!.id}`);
    await expect(page.getByRole("heading", { name: standard.deliveries[0]!.reference, exact: true })).toBeVisible();
    await expect(page.getByText("Échec de livraison", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Destinataire absent", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Destinataire absent — recette navigateur V1", { exact: true })).toBeVisible();
    await expect(page.locator('[aria-label="Suivi partagé"]')).toContainText("Destinataire absent — recette navigateur V1");
    await page.locator("main").screenshot({ path: screenshotPaths.failureClient });

    await selectPersona(page, "admin");
    await page.goto(`/dashboard/orders/${standard.id}`);
    await expect(page.getByRole("heading", { name: standard.reference, exact: true })).toBeVisible();
    await expect(page.getByText("Échec de livraison", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Destinataire absent", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Destinataire absent — recette navigateur V1", { exact: true })).toBeVisible();
    await expect(page.locator('[aria-label="Suivi partagé"]')).toContainText("Destinataire absent — recette navigateur V1");
    await page.locator("main").screenshot({ path: screenshotPaths.failureAdmin });
    console.log("[V1-GO] R10 projections client/admin validées");

    expect(pageErrors).toEqual([]);
    expect(proximityResponses.length).toBeGreaterThanOrEqual(3);
    expect(proximityResponses.every((status) => status === 200)).toBeTruthy();
    output = {
      ...output,
      passed: true,
      r01: {
        doubleClickDispatched: true,
        oneOrderPersisted: true,
        referenceVisible: true,
        responseStatuses: orderResponses,
      },
      r02: { courierFormSubmitted: true, pickupSkipRefused: true },
      r06: {
        acknowledgementVisible: true,
        pickupThenDelivery: true,
        realPhotoUploaded: true,
        proofVisibleToClientAndAdmin: true,
        browserPositionFixture: browserPosition,
        realProximityResponses: proximityResponses,
        pickupOutOfRangeConfirmed,
      },
      r10: {
        missingReasonRefusedByConnectedRecipe: "outputs/test2/connected.json",
        absentReasonRecorded: true,
        clientAdminTrackingConsistent: true,
      },
      screenshots: screenshotPaths,
      pageErrors,
    };
  } catch (error) {
    scenarioError = error;
    output = {
      ...output,
      passed: false,
      error: error instanceof Error ? error.message : "Erreur inconnue",
      pageErrors,
    };
  } finally {
    let photoRemoved = uploadedProofPath == null;
    let cleanupError: string | null = null;
    try {
      if (uploadedProofPath && companyId && courier?.deliveries[0]) {
        await deletePodPhoto(uploadedProofPath, companyId, courier.deliveries[0].id);
        const storageAudit = await cleanupPodPhotoOrphans({
          companyId,
          deliveryId: courier.deliveries[0].id,
        });
        photoRemoved = storageAudit.removed === 0;
      }
      if (companyId) {
        // Cette session de démonstration est isolée. Les jobs créés pendant la
        // recette ne portent pas tous une relation vers la commande ; la date et
        // l'entreprise bornent donc leur suppression avant celle des commandes.
        await prisma.operationJob.deleteMany({
          where: { companyId, createdAt: { gte: new Date(String(output.executedAt)) } },
        });
        await prisma.invoice.deleteMany({
          where: { order: { notes: { startsWith: marker } } },
        });
        await prisma.order.deleteMany({
          where: { companyId, notes: { startsWith: marker } },
        });
      }
    } catch (error) {
      cleanupError = error instanceof Error ? error.message : "Nettoyage inconnu";
    }
    const residue = await prisma.order.count({ where: { notes: { startsWith: marker } } });
    clean = cleanupError == null && residue === 0 && photoRemoved;
    output = {
      ...output,
      cleanup: { markedOrders: residue, proofObjectRemoved: photoRemoved, error: cleanupError },
      clean,
    };
    mkdirSync(outputDirectory, { recursive: true });
    writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
    await prisma.$disconnect();
    // Après le nettoyage seulement : la déconnexion rend l'espace de démo au pool et lance son recyclage.
    await page.request.post("/api/auth/logout").catch(() => undefined);
  }
  if (scenarioError) throw scenarioError;
  expect(clean).toBeTruthy();
});
