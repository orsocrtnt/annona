import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

// CONFIG-MSG-2 : aucune réponse d'API ne renvoie les messages Zod bruts (techniques, en anglais).
// Les routes répondent par un message français (`error`) ; `firstFieldMessage` et `zodIssueMessage` le traduisent.
const RAW_ZOD = /details:\s*\w+\.error\.flatten\(\)|\w+\.error\.(issues|errors|message|format\(\))/;

function routeFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return routeFiles(path);
    return entry.name.endsWith(".ts") ? [path] : [];
  });
}

test("CONFIG-MSG-2 : aucune route de src/app/api ne renvoie d'erreur Zod brute", () => {
  const offenders = routeFiles("src/app/api").filter((file) => RAW_ZOD.test(readFileSync(file, "utf8")));
  assert.deepEqual(offenders, []);
});
