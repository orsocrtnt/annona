import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { MISSING_TEST_DATA, readTestData } from "./helpers/test-data";

// POD-2 : les parcours authentifiés lisent le jeu de données `npm run e2e:test-data -- seed` (tutelliv-dev)
// et les comptes `npm run e2e:role-accounts -- setup` ; absents, ils sautent avec un message explicite.
type Account = { email: string; password: string };
const accounts = (): Record<"dispatcher" | "driver" | "billingAdminB", Account> | null => {
  try {
    return JSON.parse(readFileSync(resolve("outputs/e2e-role-accounts.json"), "utf8"));
  } catch {
    return null;
  }
};
const login = async (page: Page, account: Account) => {
  expect((await page.request.post("/api/auth/login", { data: { ...account, accountType: "company" } })).status()).toBe(200);
};
const logout = (page: Page) => page.request.post("/api/auth/logout").catch(() => undefined);

test("POD-2 : un visiteur anonyme n'obtient aucune pièce de preuve", async ({ request }) => {
  for (const kind of ["pdf", "photo", "signature"]) {
    expect([401, 403]).toContain((await request.get(`/api/deliveries/inexistante/proof/${kind}`)).status());
    expect([401, 403]).toContain((await request.get(`/api/portal/deliveries/inexistante/proof/${kind}`)).status());
  }
});

test("POD-2 : le back-office télécharge PDF, photo et signature d'une livraison terminée, pas ceux d'un identifiant inconnu", async ({ page }) => {
  const roles = accounts();
  const data = readTestData();
  test.skip(!roles || !data, roles ? MISSING_TEST_DATA : "comptes de rôle absents : npm run e2e:role-accounts -- setup");
  const id = data!.deliveries.delivered.id;
  await login(page, roles!.dispatcher);
  try {
    const detail = (await (await page.request.get(`/api/deliveries/${id}`)).json()).data as {
      podPdfUrl: string | null; podPhotoUrl: string | null; podSignatureUrl?: string | null; podRecipientName?: string | null;
    };
    expect(detail.podPdfUrl).toBe(`/api/deliveries/${id}/proof/pdf`);
    expect(detail.podPhotoUrl).toBe(`/api/deliveries/${id}/proof/photo`);
    expect(detail.podSignatureUrl).toBe(`/api/deliveries/${id}/proof/signature`);
    expect(detail.podRecipientName).toBe(data!.deliveries.delivered.recipientName);

    const pdf = await page.request.get(detail.podPdfUrl!);
    expect(pdf.status()).toBe(200);
    expect(pdf.headers()["content-type"]).toContain("application/pdf");
    expect((await pdf.body()).subarray(0, 5).toString()).toBe("%PDF-");

    // Photo et signature : redirection vers une URL signée qui sert réellement une image PNG.
    for (const kind of ["photo", "signature"]) {
      const file = await page.request.get(`/api/deliveries/${id}/proof/${kind}`);
      expect(file.status(), kind).toBe(200);
      expect(file.headers()["content-type"], kind).toContain("image/png");
      expect((await file.body()).subarray(1, 4).toString(), kind).toBe("PNG");
    }

    expect((await page.request.get("/api/deliveries/livraison-inexistante/proof/pdf")).status()).toBe(404);
    expect((await page.request.get(`/api/deliveries/${id}/proof/autre`)).status()).toBe(404);
  } finally {
    await logout(page);
  }
});

test("POD-2 : une autre entreprise n'obtient aucune pièce de la preuve (404), alors que l'équipe propriétaire la reçoit", async ({ page }) => {
  const roles = accounts();
  const data = readTestData();
  test.skip(!roles || !data, roles ? MISSING_TEST_DATA : "comptes de rôle absents : npm run e2e:role-accounts -- setup");
  const id = data!.deliveries.delivered.id;
  await login(page, roles!.dispatcher);
  try {
    expect((await page.request.get(`/api/deliveries/${id}/proof/pdf`)).status()).toBe(200);
  } finally {
    await logout(page);
  }
  await login(page, roles!.billingAdminB);
  try {
    for (const kind of ["pdf", "photo", "signature"]) {
      expect((await page.request.get(`/api/deliveries/${id}/proof/${kind}`, { maxRedirects: 0 })).status(), kind).toBe(404);
    }
    expect((await page.request.get(`/api/deliveries/${id}`)).status()).toBe(404);
  } finally {
    await logout(page);
  }
});

test("POD-2 : la fiche livraison affiche la preuve (réceptionnaire, photo, signature, lien PDF)", async ({ page }) => {
  const roles = accounts();
  const data = readTestData();
  test.skip(!roles || !data, roles ? MISSING_TEST_DATA : "comptes de rôle absents : npm run e2e:role-accounts -- setup");
  await login(page, roles!.dispatcher);
  try {
    await page.goto(`/dashboard/deliveries/${data!.deliveries.delivered.id}`);
    await expect(page.getByRole("heading", { level: 1, name: data!.deliveries.delivered.reference })).toBeVisible();
    await expect(page.getByText(data!.deliveries.delivered.recipientName).first()).toBeVisible();
    await expect(page.locator(`a[href="/api/deliveries/${data!.deliveries.delivered.id}/proof/pdf"]`).first()).toBeVisible();
  } finally {
    await logout(page);
  }
});

test("POD-2 : le livreur ouvre la preuve d'une mission en cours ; la validation exige photo, nom du réceptionnaire et signature", async ({ page }) => {
  test.setTimeout(120_000);
  const roles = accounts();
  const data = readTestData();
  test.skip(!roles || !data, roles ? MISSING_TEST_DATA : "comptes de rôle absents : npm run e2e:role-accounts -- setup");
  await login(page, roles!.driver);
  try {
    const missions = page.waitForResponse((r) => r.request().method() === "GET" && new URL(r.url()).pathname === "/api/driver/missions" && r.ok());
    await page.goto("/driver/missions", { waitUntil: "domcontentloaded" });
    await missions;
    await expect(page.getByText(data!.deliveries.inDelivery.reference)).toBeVisible();
    // Le livreur de recette n'a que cette mission : un seul bouton « Confirmer la livraison ».
    await page.getByRole("button", { name: "Confirmer la livraison" }).click();
    const dialog = page.getByRole("dialog").filter({ has: page.getByRole("heading", { name: "Preuve de livraison" }) });
    await expect(dialog).toBeVisible();
    // Sans photo, la validation reste impossible.
    const validate = dialog.getByRole("button", { name: "Valider la livraison" });
    await expect(validate).toBeDisabled();

    const canvas = dialog.getByTestId("signature-canvas");
    await expect(canvas).toBeVisible();
    await expect(canvas).toHaveAttribute("data-signed", "false");
    const box = (await canvas.boundingBox())!;
    const trace = async () => {
      await page.mouse.move(box.x + 20, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width / 2, box.y + 20, { steps: 8 });
      await page.mouse.move(box.x + box.width - 20, box.y + box.height / 2, { steps: 8 });
      await page.mouse.up();
    };
    await trace();
    await expect(canvas).toHaveAttribute("data-signed", "true");
    await dialog.getByRole("button", { name: "Effacer" }).click();
    await expect(canvas).toHaveAttribute("data-signed", "false");
    await trace();
    await expect(canvas).toHaveAttribute("data-signed", "true");
    // Toujours désactivé : aucune photo n'a été ajoutée.
    await expect(validate).toBeDisabled();
    await dialog.getByRole("button", { name: "Annuler" }).click();
    await expect(dialog).toBeHidden();
  } finally {
    await logout(page);
  }
});

// Reste à jouer sur un téléphone réel ou avec un faux appareil photo : envoi hors ligne puis portail client
// (aucun compte client de recette dans le jeu de données E2E).
test.fixme("POD-2 : envoi hors ligne de la preuve puis affichage « Reçu par » dans le portail du client propriétaire", async ({ page }) => {
  // 6. Mode hors ligne (context.setOffline(true)) : valider ; la file conserve l'action ; reconnecter ; la preuve part en un envoi.
  // 7. Portail client propriétaire : « Reçu par Mme Martin », image de signature, lien « Télécharger la preuve (PDF) » (200 application/pdf).
  // 8. Portail d'un autre client : /api/portal/deliveries/<id>/proof/pdf répond 404.
  void page;
});
