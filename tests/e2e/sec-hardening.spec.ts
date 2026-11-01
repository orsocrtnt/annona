import { expect, test } from "@playwright/test";

// SEC-1..6 : recette navigateur du durcissement (non lancée par l'agent Sécurité).
// Base de développement uniquement ; aucun compte réel n'est créé ni modifié.

test("en-têtes de sécurité et CSP bloquante sur une page publique et une carte", async ({ page }) => {
  const violations: string[] = [];
  page.on("console", (message) => {
    if (/Content Security Policy|Content-Security-Policy/i.test(message.text())) violations.push(message.text());
  });
  const response = await page.goto("/");
  const headers = response!.headers();
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(headers["permissions-policy"]).toContain("geolocation=(self)");
  expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
  await page.waitForLoadState("networkidle");
  // La mini-démo et les cartes ne doivent produire aucune violation de la CSP bloquante.
  expect(violations, violations.join("\n")).toEqual([]);
});

test("mutation depuis une autre origine refusée par le middleware (403)", async ({ request }) => {
  const response = await request.post("/api/contact", {
    headers: { Origin: "https://evil.example", "Content-Type": "application/json" },
    data: { name: "Test", email: "e2e-sec@example.invalid", message: "Message de test E2E sécurité." },
  });
  expect(response.status()).toBe(403);
  expect((await response.json()).error).toMatch(/Origine/);
});

test("synchronisation : tout champ, dont accountType, est refusé (400)", async ({ request, baseURL }) => {
  const response = await request.post("/api/auth/sync", {
    headers: { Origin: new URL(baseURL!).origin },
    data: { accountType: "company" },
  });
  expect(response.status()).toBe(400);
});

test("connexion : 6 échecs pour une adresse inconnue -> 429 avec Retry-After, message sans énumération", async ({ request, baseURL }) => {
  const email = `e2e-sec-ratelimit-${Date.now()}@example.invalid`;
  const origin = new URL(baseURL!).origin;
  for (let i = 0; i < 5; i++) {
    const failed = await request.post("/api/auth/login", { headers: { Origin: origin }, data: { email, password: "mauvais-mot-de-passe" } });
    expect(failed.status()).toBe(401);
  }
  const blocked = await request.post("/api/auth/login", { headers: { Origin: origin }, data: { email, password: "mauvais-mot-de-passe" } });
  expect(blocked.status()).toBe(429);
  expect(Number(blocked.headers()["retry-after"])).toBeGreaterThan(0);
  expect((await blocked.json()).error).toMatch(/Trop de tentatives/);
});
