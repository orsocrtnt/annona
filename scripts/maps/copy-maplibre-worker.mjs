import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// MapLibre 6 charge son worker à côté de son propre module : une fois empaqueté par Next,
// ce chemin n'existe plus. Le worker autonome est donc servi depuis `public/` et désigné
// par `setWorkerUrl` (src/lib/maps/maplibre-worker.ts). Lancé au postinstall.
export const WORKER_SOURCE = "node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs";
export const WORKER_TARGET = "public/vendor/maplibre-gl-worker.mjs";

export function copyMaplibreWorker(root = process.cwd()) {
  const source = resolve(root, WORKER_SOURCE);
  const target = resolve(root, WORKER_TARGET);
  if (!existsSync(source)) throw new Error(`MAPLIBRE_WORKER_MISSING: ${WORKER_SOURCE}`);
  if (existsSync(target) && readFileSync(target).equals(readFileSync(source))) return false;
  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(source, target);
  return true;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const copied = copyMaplibreWorker();
  console.log(JSON.stringify({ maplibreWorker: WORKER_TARGET, copied }));
}
