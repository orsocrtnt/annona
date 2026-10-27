import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// Node 20 n'a pas de WebSocket natif : le client realtime de Supabase refusait de démarrer
// (« Node.js 20 detected without native WebSocket support ») dans demo2:maintain.
test("les scripts du pool démo chargent le WebSocket de ws avant tout le reste", () => {
  for (const file of ["scripts/demo2/maintain-pool.ts", "scripts/demo2/prepare-pool.ts"]) {
    const firstImport = readFileSync(file, "utf8").split("\n").find((line) => line.startsWith("import"));
    assert.equal(firstImport, 'import "./node-websocket";', file);
  }
});

test("le polyfill fournit globalThis.WebSocket quand Node n'en a pas, sans écraser un WebSocket natif", async () => {
  const native = (globalThis as { WebSocket?: unknown }).WebSocket;
  await import("../scripts/demo2/node-websocket");
  const current = (globalThis as { WebSocket?: unknown }).WebSocket;
  assert.equal(typeof current, "function");
  if (native) assert.equal(current, native);
  else assert.equal(current, (await import("ws")).WebSocket);
});
