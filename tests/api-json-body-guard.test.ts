import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

// RECETTE-2810 point 17 : un corps JSON invalide doit répondre 400 (jamais 500). Toute lecture directe
// de `request.json()` doit donc absorber l'échec d'analyse, la validation Zod produisant ensuite le 400.
function routeFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? routeFiles(path) : name === "route.ts" ? [path] : [];
  });
}

test("aucune route API ne lit request.json() sans protection", () => {
  const offenders = routeFiles(join(process.cwd(), "src/app/api")).filter((file) =>
    /(?<!NextResponse)\.json\(\)(?!\.catch)/.test(readFileSync(file, "utf8"))
  );
  assert.deepEqual(offenders, []);
});
