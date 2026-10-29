import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test, { mock } from "node:test";
import { AUTH_REQUEST_TIMEOUT_MS, AUTH_TIMEOUT_MESSAGE, RequestTimeoutError, requestJsonWithTimeout } from "../src/features/auth/request-timeout";
import { createSubmitGuard } from "../src/features/auth/submit-guard";

// Seule la frontière réseau (fetch) est simulée ; le minuteur est faux.
function hangingFetch() {
  const seen: { signal?: AbortSignal; resolve?: (response: Response) => void } = {};
  const fetchImpl = ((_url: string, init?: RequestInit) => new Promise<Response>((resolve) => { seen.signal = init?.signal ?? undefined; seen.resolve = resolve; })) as typeof fetch;
  return { fetchImpl, seen };
}

test("connexion : sans réponse, abandon après environ 15 s avec message propre", async () => {
  mock.timers.enable({ apis: ["setTimeout"] });
  try {
    const { fetchImpl, seen } = hangingFetch();
    assert.equal(AUTH_REQUEST_TIMEOUT_MS, 15_000);
    const pending = requestJsonWithTimeout("/api/auth/login", { method: "POST" }, { fetchImpl });
    const outcome = pending.then(() => "résolu", (error: unknown) => error);
    mock.timers.tick(14_999);
    assert.equal(seen.signal?.aborted, false, "pas d'abandon avant le délai");
    mock.timers.tick(1);
    const error = await outcome;
    assert.ok(error instanceof RequestTimeoutError);
    assert.equal(seen.signal?.aborted, true, "la requête est annulée");
    assert.equal(AUTH_TIMEOUT_MESSAGE, "Le serveur ne répond pas, réessayez");
  } finally { mock.timers.reset(); }
});

test("connexion : une réponse arrivée après l'abandon ne fait rien, le délai est retiré après une réponse normale", async () => {
  mock.timers.enable({ apis: ["setTimeout"] });
  try {
    const late = hangingFetch();
    const outcome = requestJsonWithTimeout("/x", {}, { fetchImpl: late.fetchImpl }).then(() => "résolu", (error: unknown) => error);
    mock.timers.tick(15_000);
    assert.ok((await outcome) instanceof RequestTimeoutError);
    late.seen.resolve!(new Response(JSON.stringify({ user: "tard" }), { status: 200 }));
    await Promise.resolve();
    assert.ok(true, "aucune exception non gérée ni second résultat");

    const quick = await requestJsonWithTimeout("/x", {}, { fetchImpl: (async () => new Response(JSON.stringify({ ok: 1 }), { status: 401 })) as typeof fetch });
    assert.deepEqual({ ok: quick.ok, status: quick.status, json: quick.json }, { ok: false, status: 401, json: { ok: 1 } });
    const unreadable = await requestJsonWithTimeout("/x", {}, { fetchImpl: (async () => new Response("<html>502</html>", { status: 502 })) as typeof fetch });
    assert.equal(unreadable.json, null);
  } finally { mock.timers.reset(); }
});

test("connexion : à l'expiration la garde d'envoi est relâchée et le bouton rendu (le formulaire attrape RequestTimeoutError)", async () => {
  mock.timers.enable({ apis: ["setTimeout"] });
  try {
    const guard = createSubmitGuard();
    assert.equal(guard.tryAcquire(), true);
    const { fetchImpl } = hangingFetch();
    const outcome = requestJsonWithTimeout("/api/auth/login", {}, { fetchImpl }).catch((error: unknown) => { if (error instanceof RequestTimeoutError) guard.release(); return error; });
    mock.timers.tick(15_000);
    await outcome;
    assert.equal(guard.isLocked(), false);
    assert.equal(guard.tryAcquire(), true, "nouvel essai possible");
  } finally { mock.timers.reset(); }
});

test("le formulaire de connexion utilise le délai pour les quatre requêtes d'authentification, sans fetch nu", () => {
  const source = readFileSync("src/features/auth/auth-form.tsx", "utf8");
  assert.equal([...source.matchAll(/\bfetch\(/g)].length, 0);
  assert.equal([...source.matchAll(/requestJsonWithTimeout\(/g)].length, 4);
  assert.match(source, /RequestTimeoutError/);
  assert.match(source, /AUTH_TIMEOUT_MESSAGE/);
});
