import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

// ICONES-IA : le propriétaire ne veut plus d'icônes « étincelles » (style IA) ni de leurs cousines.
const FORBIDDEN = /\b(Sparkles?|WandSparkles|Wand2?|Stars)\b|✨/;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(tsx?|css)$/.test(entry.name) ? [path] : [];
  });
}

test("ICONES-IA : aucune icône étincelle, baguette magique ni emoji ✨ dans src", () => {
  const offenders = sourceFiles("src").filter((file) => FORBIDDEN.test(readFileSync(file, "utf8")));
  assert.deepEqual(offenders, []);
});
