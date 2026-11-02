import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { THEME_SCOPED_PATH_PREFIXES } from "../src/lib/theme";

const root = new URL("../", import.meta.url);
const read = (path: string) => readFileSync(fileURLToPath(new URL(path, root)), "utf8");

const LEGAL_HREFS = ['href="/mentions-legales"', 'href="/confidentialite"'];

test("LEGAL-LIENS : les deux pages légales existent et suivent le thème", () => {
  for (const page of ["src/app/mentions-legales/page.tsx", "src/app/confidentialite/page.tsx"]) {
    assert.ok(existsSync(fileURLToPath(new URL(page, root))), page);
  }
  assert.ok(THEME_SCOPED_PATH_PREFIXES.includes("/mentions-legales" as never));
  assert.ok(THEME_SCOPED_PATH_PREFIXES.includes("/confidentialite" as never));
});

test("LEGAL-LIENS : chaque pied de page public mène aux mentions légales et à la confidentialité", () => {
  // Accueil ; Fonctionnalités, Tarifs, Démonstration, Contact (GrowthShell) ; connexions (AuthShell) ; inscription.
  for (const file of [
    "src/features/landing/home-landing.tsx",
    "src/features/landing/growth-shell.tsx",
    "src/features/auth/auth-shell.tsx",
    "src/features/auth/signup-wizard.tsx",
  ]) {
    const source = read(file);
    for (const href of LEGAL_HREFS) assert.ok(source.includes(href), `${file} : ${href}`);
  }
});

test("LEGAL-LIENS : les formulaires qui collectent des données renvoient à la confidentialité", () => {
  const contact = read("src/features/landing/contact-form.tsx");
  assert.ok(contact.includes('href="/confidentialite"'));
  const signup = read("src/features/auth/signup-wizard.tsx");
  const start = signup.indexOf('stage === "identity"');
  const identity = signup.slice(start, signup.indexOf('stage === "payment"', start));
  assert.ok(identity.includes('href="/confidentialite"'), "étape identité de l'inscription");
});

test("LEGAL-LIENS : contenu provisoire signalé, aucune identité inventée", () => {
  const shell = read("src/features/legal/legal-document.tsx");
  assert.match(shell, /Version provisoire, en cours de vérification/);
  const mentions = read("src/app/mentions-legales/page.tsx");
  const privacy = read("src/app/confidentialite/page.tsx");
  for (const source of [mentions, privacy]) {
    assert.ok(source.includes("<LegalDocument"), "bandeau provisoire via LegalDocument");
    // Aucun SIREN/SIRET (9 ou 14 chiffres) ni numéro de téléphone publié tant que LEGAL-1 est ouverte.
    assert.doesNotMatch(source, /\b\d{9}\b|\b\d{14}\b|\b0\d(?:[ .]?\d{2}){4}\b/);
  }
  assert.match(mentions, /\["Immatriculation \(SIREN\)", pending\]/);
  assert.match(mentions, /\["Directeur de la publication", "Carotenuto - Marchetti Orso"\]/);
  assert.match(privacy, /En cours de définition/);
});
