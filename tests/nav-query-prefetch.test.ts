import assert from "node:assert/strict";
import test from "node:test";
import { QueryClient } from "@tanstack/react-query";

test("le préchargement d'un lien du menu appelle la même API que l'écran, avec la même clé", async () => {
  const urls: string[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (url: string) => {
    urls.push(String(url));
    return new Response(JSON.stringify({ data: [] }), { status: 200 });
  }) as typeof fetch;
  try {
    const { prefetchRouteQueries } = await import("../src/lib/navigation/nav-query-prefetch");
    const client = new QueryClient();
    prefetchRouteQueries(client, "/support?ticket=1");
    prefetchRouteQueries(client, "/bakery");
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.deepEqual(urls, ["/api/support"], "écran « à venir » : aucun préchargement inventé");
    assert.ok(client.getQueryData(["company", "support"]));
  } finally {
    globalThis.fetch = originalFetch;
  }
});
