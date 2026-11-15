// LOT1-D9 — pages de connexion plus légères : le client Supabase (connexion, temps réel, base, ~240 Ko bruts)
// n'est chargé qu'au clic sur « Continuer avec Google », plus à l'ouverture de /login, /login/client,
// /login/driver et /inscription.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("LOT1-D9 : le bouton Google charge le client Supabase au clic seulement", () => {
  const button = readFileSync("src/features/auth/google-button.tsx", "utf8");
  assert.doesNotMatch(button, /^import[^\n]*services\/supabase\/client/m, "import statique du client Supabase");
  assert.match(button, /await import\("@\/services\/supabase\/client"\)/);
  // Chargement impossible (hors réseau) : le bouton redevient utilisable et un message s'affiche.
  assert.match(button, /\.catch\(\(\) => null\)/);
});

test("LOT1-D9 : aucun autre fichier du formulaire de connexion n'importe le client Supabase", () => {
  for (const file of ["src/features/auth/auth-form.tsx", "src/features/auth/login-session.ts", "src/features/auth/auth-shell.tsx"]) {
    let source: string;
    try {
      source = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    assert.doesNotMatch(source, /^import[^\n]*(services\/supabase\/client|@supabase\/)/m, file);
  }
});
