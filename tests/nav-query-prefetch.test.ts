import assert from "node:assert/strict";
import test from "node:test";
import { QueryClient } from "@tanstack/react-query";

test("le préchargement du dispatch n'envoie pas le contexte React Query comme livraison", async () => {
  const urls: string[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (url: string) => {
    urls.push(String(url));
    return new Response(JSON.stringify({ data: { deliveries: [] } }), { status: 200 });
  }) as typeof fetch;
  try {
    const { prefetchRouteQueries } = await import("../src/lib/navigation/nav-query-prefetch");
    const client = new QueryClient();
    prefetchRouteQueries(client, "/dispatch");
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.deepEqual(urls, ["/api/dispatch/overview"]);
    // Même clé que useDispatchOverview() sans livraison ciblée : le préchargement sert vraiment.
    assert.ok(client.getQueryData(["company", "dispatch", "overview", null]));
  } finally {
    globalThis.fetch = originalFetch;
  }
});
