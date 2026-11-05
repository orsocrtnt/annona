import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  LAST_SPACE_STORAGE_KEY,
  LOGIN_SPACES,
  readLastSpace,
  rememberLastSpace,
  resolveLoginView,
  spaceForDestination,
} from "../src/features/auth/login-space";
import { createSubmitGuard } from "../src/features/auth/submit-guard";
import { isThemeScopedPath } from "../src/lib/theme";

function read(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  };
}

test("LANDING-2 : /login sans paramètre montre le choix, ?espace= valide ouvre le bon formulaire", () => {
  assert.deepEqual(resolveLoginView({}), { kind: "choose" });
  assert.deepEqual(resolveLoginView({ espace: "entreprise" }), { kind: "form", context: "company", prefillDemo: false });
  assert.deepEqual(resolveLoginView({ espace: "client" }), { kind: "form", context: "client", prefillDemo: false });
  assert.deepEqual(resolveLoginView({ espace: "livreur" }), { kind: "form", context: "driver", prefillDemo: false });
  assert.deepEqual(resolveLoginView({ espace: ["client", "livreur"] }), { kind: "form", context: "client", prefillDemo: false });
  assert.deepEqual(resolveLoginView({ espace: "entreprise", demo: "1" }), { kind: "form", context: "company", prefillDemo: true });
  // La démo ne pré-remplit jamais un formulaire client ou livreur.
  assert.deepEqual(resolveLoginView({ espace: "client", demo: "1" }), { kind: "form", context: "client", prefillDemo: false });
});

test("LANDING-2 : une valeur ?espace= invalide revient au choix sans erreur", () => {
  for (const espace of ["", "admin", "ENTREPRISE", "constructor", "__proto__", "toString", "<script>", "password"]) {
    assert.deepEqual(resolveLoginView({ espace }), { kind: "choose" }, espace);
  }
});

test("LANDING-2 : les liens existants (?email= démo, ?redirect= middleware et inscription) ouvrent le formulaire entreprise", () => {
  assert.equal(resolveLoginView({ email: "demo@tutelliv.fr" }).kind, "form");
  assert.deepEqual(resolveLoginView({ redirect: "/dashboard" }), { kind: "form", context: "company", prefillDemo: false });
  assert.deepEqual(resolveLoginView({ email: "a@b.fr", redirect: "/onboarding" }), { kind: "form", context: "company", prefillDemo: false });
});

test("LANDING-2 : le dernier espace retenu est celui ouvert par le serveur, sans donnée personnelle", () => {
  assert.equal(spaceForDestination("/portal"), "client");
  assert.equal(spaceForDestination("/portal/orders"), "client");
  assert.equal(spaceForDestination("/driver"), "livreur");
  assert.equal(spaceForDestination("/dashboard"), "entreprise");
  assert.equal(spaceForDestination("/portalx"), "entreprise");
  const storage = memoryStorage();
  rememberLastSpace(storage, "/driver/missions");
  assert.deepEqual([...storage.data.entries()], [[LAST_SPACE_STORAGE_KEY, "livreur"]]);
  assert.equal(readLastSpace(storage), "livreur");
  assert.equal(readLastSpace(memoryStorage({ [LAST_SPACE_STORAGE_KEY]: "jean@exemple.fr" })), null);
  assert.equal(readLastSpace(null), null);
  const throwing = { getItem: () => { throw new Error("bloqué"); }, setItem: () => { throw new Error("bloqué"); } };
  assert.equal(readLastSpace(throwing), null);
  assert.doesNotThrow(() => rememberLastSpace(throwing, "/portal"));
});

test("LANDING-2 : chaque tuile d'espace pointe vers une route de connexion existante", () => {
  assert.equal(LOGIN_SPACES.entreprise.href, "/login?espace=entreprise");
  assert.equal(LOGIN_SPACES.client.href, "/login/client");
  assert.equal(LOGIN_SPACES.livreur.href, "/login/driver");
  const chooser = read("src/features/auth/login-space-chooser.tsx");
  // Titre et description sur deux lignes (défaut « EntrepriseCommandes… » de la maquette).
  assert.match(chooser, /<span className="block text-lg[^"]*">\{space\.title\}<\/span>\s*<span className="block text-sm[^"]*">\{space\.description\}<\/span>/);
});

test("LANDING-2 : formulaire de connexion en POST, même appel serveur et mêmes messages", () => {
  const form = read("src/features/auth/auth-form.tsx");
  assert.match(form, /<form method="post" onSubmit=\{loginForm\.handleSubmit\(onLogin\)\}/);
  assert.doesNotMatch(form, /method="get"/i);
  assert.match(form, /setError\(json\.error \?\? "Email ou mot de passe incorrect\."\)/);
});

function fakeScheduler() {
  const timers = new Map<number, () => void>();
  let next = 0;
  return {
    timers,
    set: (callback: () => void) => {
      next += 1;
      timers.set(next, callback);
      return next;
    },
    clear: (handle: unknown) => void timers.delete(handle as number),
    fire: () => {
      for (const [id, callback] of [...timers]) {
        timers.delete(id);
        callback();
      }
    },
  };
}

test("LANDING-2 : garde d'envoi unique — double clic, échec, délai de sécurité, succès puis retour arrière", () => {
  const scheduler = fakeScheduler();
  const guard = createSubmitGuard({ timeoutMs: 30_000, scheduler });
  assert.equal(guard.tryAcquire(), true);
  assert.equal(guard.tryAcquire(), false, "double clic : second envoi refusé");
  guard.release();
  assert.equal(guard.tryAcquire(), true, "après un échec, nouvel essai possible");
  scheduler.fire();
  assert.equal(guard.isLocked(), false, "requête sans réponse : le délai rouvre la garde");
  assert.equal(guard.tryAcquire(), true);
  guard.hold();
  assert.equal(scheduler.timers.size, 0, "succès : aucun délai ne rouvre la garde pendant la navigation");
  scheduler.fire();
  assert.equal(guard.tryAcquire(), false);
  guard.release();
  assert.equal(guard.tryAcquire(), true, "retour arrière (pageshow persisté) : la garde se rouvre");
});

test("LANDING-2 : le formulaire passe par la garde et la relâche au retour depuis le bfcache", () => {
  const form = read("src/features/auth/auth-form.tsx");
  assert.match(form, /if \(!loginGuard\.tryAcquire\(\)\) return;/);
  assert.match(form, /event\.persisted\) loginGuard\.release\(\)/);
  assert.match(form, /loginGuard\.hold\(\);\s*router\.push\(destination\)/);
  assert.doesNotMatch(form, /setTimeout/);
});

test("LANDING-2 : aucune adresse de support inventée", () => {
  const constants = read("src/lib/constants.ts");
  assert.doesNotMatch(constants, /support@tutelliv\.fr"/);
  assert.match(constants, /NEXT_PUBLIC_SUPPORT_EMAIL\?\.trim\(\) \|\| null/);
  for (const file of [
    "src/features/landing/home-landing.tsx",
    "src/features/landing/public-top-navbar.tsx",
    "src/features/auth/auth-shell.tsx",
    "src/features/auth/auth-form.tsx",
    "src/features/support/public-support-link.tsx",
  ]) {
    assert.doesNotMatch(read(file), /support@tutelliv/, file);
  }
  assert.match(read("src/features/support/public-support-link.tsx"), /href="\/contact"/);
});

test("LANDING-3 : la landing n'écrit aucun prix en dur ; /tarifs retirée pour le moment, elle renvoie vers /fonctionnalites", () => {
  const page = read("src/app/page.tsx");
  const home = read("src/features/landing/home-landing.tsx");
  assert.doesNotMatch(page, /getActiveSignupCatalog/);
  assert.doesNotMatch(home, /\b(79|179|349) ?€/);
  assert.doesNotMatch(home, /href="\/tarifs"/);
  assert.match(home, /href="\/fonctionnalites"/);
  assert.match(read("src/app/tarifs/page.tsx"), /getActiveSignupCatalog/);
});

test("DESIGN-2 : le site public suit le choix Clair / Sombre / Système, le reste ne change pas", () => {
  for (const path of ["/", "/tarifs", "/fonctionnalites", "/demonstration", "/contact", "/mentions-legales", "/confidentialite", "/login", "/login/client", "/login/driver", "/forgot-password", "/reset-password", "/register", "/register/client"]) {
    assert.equal(isThemeScopedPath(path), true, path);
  }
  for (const path of ["/registerx", "/tarifsx", "/loginx"]) {
    assert.equal(isThemeScopedPath(path), false, path);
  }
  const nav = read("src/features/landing/public-top-navbar.tsx");
  assert.match(nav, /<ThemeToggle /);
  assert.match(nav, /<ThemeRadioGroup \/>/);
  assert.match(read("src/features/auth/auth-shell.tsx"), /<ThemeToggle \/>/);
});

test("DESIGN-2 : pages publiques sans dégradé ni texte foncé fixe en Dark", () => {
  for (const file of ["src/app/tarifs/page.tsx", "src/app/fonctionnalites/page.tsx"]) {
    const source = read(file);
    for (const [, classes = ""] of source.matchAll(/"([^"]*bg-gradient-to-[^"]*)"/g)) {
      assert.match(classes, /dark:bg-none/, `${file} : ${classes}`);
    }
  }
  for (const file of ["src/app/tarifs/page.tsx", "src/app/fonctionnalites/page.tsx", "src/app/demonstration/page.tsx", "src/features/landing/growth-shell.tsx", "src/features/landing/home-landing.tsx"]) {
    const source = read(file);
    for (const [, classes = ""] of source.matchAll(/"([^"]*\btext-\[#0e1310\][^"]*)"/g)) {
      // Encre fixe permise seulement sur fond vert (bouton primaire) ou avec sa variante Dark.
      assert.ok(/bg-\[#00d46a\]|dark:text-/.test(classes), `${file} : ${classes}`);
    }
  }
});
