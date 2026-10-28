import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import test from "node:test";

// SEC-7 : le client Supabase service (clé service_role) ne doit jamais être atteignable
// depuis un module "use client". `import "server-only"` n'est pas utilisable ici : le paquet
// n'est fourni que par l'alias interne de Next, et les tests node ou scripts tsx qui
// importent ce module échoueraient. Ce test parcourt donc le graphe d'imports réel.
const SRC = resolve("src");
const ADMIN = join(SRC, "services/supabase/admin.ts");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}
function resolveImport(from: string, specifier: string): string | null {
  const base = specifier.startsWith("@/") ? join(SRC, specifier.slice(2)) : specifier.startsWith(".") ? resolve(dirname(from), specifier) : null;
  if (!base) return null;
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, join(base, "index.ts"), join(base, "index.tsx")]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}
const directive = (source: string, name: string) => new RegExp(`^\\s*(?:\\/\\/[^\\n]*\\n\\s*)*["']${name}["']`).test(source);

const files = walk(SRC);
const sources = new Map(files.map((file) => [file, readFileSync(file, "utf8")]));
const graph = new Map(files.map((file) => {
  const source = sources.get(file)!;
  // Les imports de type disparaissent à la compilation.
  const specifiers = [...source.matchAll(/^\s*(?:import|export)\s+(?!type\s)(?:[^"';]*?\sfrom\s+)?["']([^"']+)["']/gm)].map((m) => m[1]!);
  const dynamic = [...source.matchAll(/import\(\s*["']([^"']+)["']\s*\)/g)].map((m) => m[1]!);
  return [file, [...specifiers, ...dynamic].map((s) => resolveImport(file, s)).filter((p): p is string => Boolean(p))];
}));

function pathToAdmin(start: string): string[] | null {
  const seen = new Set<string>();
  const stack: Array<[string, string[]]> = [[start, [start]]];
  while (stack.length) {
    const [file, path] = stack.pop()!;
    if (file === ADMIN) return path;
    if (seen.has(file)) continue;
    seen.add(file);
    // Une action serveur importée par le client s'exécute côté serveur.
    if (file !== start && directive(sources.get(file) ?? "", "use server")) continue;
    for (const next of graph.get(file) ?? []) stack.push([next, [...path, next]]);
  }
  return null;
}

test("graphe d'imports lu : le client service existe et des modules client sont trouvés", () => {
  assert.ok(sources.has(ADMIN));
  assert.ok(files.filter((file) => directive(sources.get(file)!, "use client")).length > 50);
});

test("aucun module \"use client\" n'atteint le client Supabase service", () => {
  const leaks = files
    .filter((file) => directive(sources.get(file)!, "use client"))
    .map(pathToAdmin)
    .filter((path): path is string[] => path !== null)
    .map((path) => path.map((file) => relative(SRC, file)).join(" -> "));
  assert.deepEqual(leaks, []);
});

test("la clé service n'est lue que par le module serveur dédié et des modules serveur", () => {
  const readers = files.filter((file) => sources.get(file)!.includes("SUPABASE_SERVICE_ROLE_KEY"));
  for (const file of readers) assert.equal(directive(sources.get(file)!, "use client"), false, relative(SRC, file));
});
