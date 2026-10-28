import { expect, test } from "@playwright/test";

// POD-2 : spec écrite mais NON lancée par l'agent (aucun serveur ni navigateur autorisé).
// À jouer par le propriétaire : `npx playwright test tests/e2e/pod-proof.spec.ts` sur tutelliv-dev.

test("POD-2 : un visiteur anonyme n'obtient aucune pièce de preuve", async ({ request }) => {
  for (const kind of ["pdf", "photo", "signature"]) {
    expect([401, 403]).toContain((await request.get(`/api/deliveries/inexistante/proof/${kind}`)).status());
    expect([401, 403]).toContain((await request.get(`/api/portal/deliveries/inexistante/proof/${kind}`)).status());
  }
});

test("POD-2 : le back-office télécharge le PDF de preuve d'une livraison terminée, pas celui d'un identifiant inconnu", async ({ page }) => {
  const login = await page.request.post("/api/auth/login", {
    data: { email: "demo@tutelliv.fr", password: "Demo2026!", demoTestSession: true, accountType: "company" },
  });
  expect(login.status()).toBe(200);
  try {
    const list = await page.request.get("/api/deliveries");
    const deliveries = (await list.json()).data as Array<{ id: string; status: string }>;
    const done = deliveries.find((delivery) => ["DELIVERED", "FAILED"].includes(delivery.status));
    test.skip(!done, "Aucune livraison terminée dans la base de développement.");

    const detail = (await (await page.request.get(`/api/deliveries/${done!.id}`)).json()).data as {
      podPdfUrl: string | null; podPhotoUrl: string | null; podSignatureUrl?: string | null;
    };
    expect(detail.podPdfUrl).toBe(`/api/deliveries/${done!.id}/proof/pdf`);
    const pdf = await page.request.get(detail.podPdfUrl!);
    expect(pdf.status()).toBe(200);
    expect(pdf.headers()["content-type"]).toContain("application/pdf");
    expect((await pdf.body()).subarray(0, 5).toString()).toBe("%PDF-");

    expect((await page.request.get("/api/deliveries/livraison-inexistante/proof/pdf")).status()).toBe(404);
    expect((await page.request.get(`/api/deliveries/${done!.id}/proof/autre`)).status()).toBe(404);
  } finally {
    await page.request.post("/api/auth/logout").catch(() => undefined);
  }
});

// Parcours de signature : à jouer avec la fixture V1 (voir tests/e2e/v1-operational.spec.ts) et un téléphone réel.
test.fixme("POD-2 : le livreur signe à l'écran, efface, saisit le nom du réceptionnaire puis valide ; le portail affiche signature et lien PDF", async ({ page }) => {
  // 1. Livreur : ouvrir la boîte « Preuve de livraison », vérifier que « Valider la livraison » reste désactivé sans photo.
  // 2. Tracer dans [data-testid=signature-canvas] (page.mouse.down/move/up) : data-signed passe à "true".
  // 3. Cliquer « Effacer » : data-signed repasse à "false". Retracer.
  // 4. Sans nom du réceptionnaire, le bouton reste désactivé ; renseigner « Mme Martin ».
  // 5. Cocher « refuse ou ne peut pas signer » : le canevas disparaît, un motif devient obligatoire.
  // 6. Mode hors ligne (context.setOffline(true)) : valider ; la file conserve l'action ; reconnecter ; la preuve part en un envoi.
  // 7. Portail client propriétaire : « Reçu par Mme Martin », image de signature, lien « Télécharger la preuve (PDF) » (200 application/pdf).
  // 8. Portail d'un autre client : /api/portal/deliveries/<id>/proof/pdf répond 404.
  void page;
});
