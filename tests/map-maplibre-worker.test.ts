import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { MAPLIBRE_WORKER_PATH, maplibreWorkerUrl } from "../src/lib/maps/provider-config";
import { WORKER_SOURCE, WORKER_TARGET, copyMaplibreWorker } from "../scripts/maps/copy-maplibre-worker.mjs";

test("MAP-4 : le worker MapLibre installé existe et l'URL servie correspond à la copie publique", () => {
  assert.ok(existsSync(WORKER_SOURCE), "maplibre-gl doit fournir un worker autonome");
  assert.equal(`public${MAPLIBRE_WORKER_PATH}`, WORKER_TARGET);
  assert.equal(maplibreWorkerUrl("6.13.0"), "/vendor/maplibre-gl-worker.mjs?v=6.13.0");
  const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { scripts: Record<string, string> };
  assert.match(pkg.scripts.postinstall!, /scripts\/maps\/copy-maplibre-worker\.mjs/);
});

test("MAP-4 : la copie du worker est idempotente et échoue explicitement sans paquet", () => {
  const root = mkdtempSync(join(tmpdir(), "maplibre-worker-"));
  assert.throws(() => copyMaplibreWorker(root), /MAPLIBRE_WORKER_MISSING/);

  mkdirSync(join(root, "node_modules/maplibre-gl/dist"), { recursive: true });
  writeFileSync(join(root, WORKER_SOURCE), "worker-v1");
  assert.equal(copyMaplibreWorker(root), true);
  assert.equal(readFileSync(join(root, WORKER_TARGET), "utf8"), "worker-v1");
  assert.equal(copyMaplibreWorker(root), false, "contenu identique : aucune réécriture");

  writeFileSync(join(root, WORKER_SOURCE), "worker-v2");
  assert.equal(copyMaplibreWorker(root), true, "une mise à jour du paquet remplace la copie");
  assert.equal(readFileSync(join(root, WORKER_TARGET), "utf8"), "worker-v2");
});
