import { expect, test } from "@playwright/test";

/**
 * LEGAL-1 : les itinéraires passent par le serveur (/api/maps/route). Le calcul réel interroge la
 * Géoplateforme IGN : lancé seulement si DRIVE_ROUTE_IGN_URL est fourni au serveur de test.
 * Coordonnées fictives (Louvre → La Défense), aucune donnée de livraison.
 */
const WAYPOINTS = [{ latitude: 48.8606, longitude: 2.3364 }, { latitude: 48.8919, longitude: 2.239 }];

test("ITINÉRAIRE : refusé sans connexion, calculé par le serveur pour le livreur, rien vers OSRM public", async ({ page, request }) => {
  expect((await request.post("/api/maps/route", { data: { waypoints: WAYPOINTS } })).status()).toBe(401);

  const login = await page.request.post("/api/auth/login", {
    data: { email: "demo@annona.fr", password: "Demo2026!", demoTestSession: true, accountType: "company" },
  });
  expect(login.status()).toBe(200);
  try {
    expect((await page.request.post("/api/demo/persona", { data: { persona: "driver" } })).status()).toBe(200);
    expect((await page.request.post("/api/maps/route", { data: { waypoints: WAYPOINTS.slice(0, 1) } })).status()).toBe(400);
    expect((await page.request.post("/api/maps/route", { data: { waypoints: [...WAYPOINTS, { latitude: 999, longitude: 2 }] } })).status()).toBe(400);
    expect((await page.request.post("/api/maps/route", { data: { waypoints: WAYPOINTS, label: "Chez Mme Martin" } })).status(), "champ inconnu refusé").toBe(400);

    test.skip(!process.env.DRIVE_ROUTE_IGN_URL, "DRIVE_ROUTE_IGN_URL absent : pas d'appel réel à l'IGN");
    const response = await page.request.post("/api/maps/route", { data: { waypoints: WAYPOINTS } });
    expect(response.status()).toBe(200);
    const route = (await response.json()).data as { polyline: [number, number][]; distanceMeters: number; durationSeconds: number; steps: { instruction: string }[] };
    expect(route.polyline.length).toBeGreaterThan(10);
    expect(route.distanceMeters).toBeGreaterThan(5_000);
    expect(route.distanceMeters).toBeLessThan(20_000);
    expect(route.durationSeconds).toBeGreaterThan(300);
    expect(route.steps.length).toBeGreaterThan(2);
    expect(route.steps.at(-1)!.instruction).toBe("Vous êtes arrivé");
    expect(route.steps.some((step) => /["{}\\]/.test(step.instruction)), "aucun nom de voie tronqué affiché").toBe(false);
    expect(response.headers()["cache-control"]).toContain("no-store");
  } finally {
    await page.request.post("/api/auth/logout");
  }
});
