import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("la page démonstration réutilise l'entrée existante sans la déclencher", () => {
  const page = readFileSync(new URL("../src/app/demonstration/page.tsx", import.meta.url), "utf8");
  const reader = readFileSync(new URL("../src/domains/growth/public-demo.ts", import.meta.url), "utf8");
  const login = readFileSync(new URL("../src/app/api/auth/login/route.ts", import.meta.url), "utf8");
  const users = readFileSync(new URL("../src/domains/demo/demo-users.service.ts", import.meta.url), "utf8");
  const publicNav = readFileSync(new URL("../src/features/landing/public-top-navbar.tsx", import.meta.url), "utf8");
  assert.match(page, /readPublicDemoEntry/);
  assert.match(page, /DEMO_PERSONA_LABELS/);
  assert.match(page, /ni un pilote gratuit, ni une découverte premium, ni une souscription/);
  assert.match(page, /n'est pas ouverte sur cet environnement/);
  assert.match(page, /href="\/fonctionnalites"/);
  assert.match(page, /href="\/tarifs"/);
  assert.match(page, /href="\/contact"/);
  assert.match(page, /href="\/login"/);
  assert.doesNotMatch(page, /GPS permanent|e-mail réel|paiement|stripe|Demo2026/i);
  assert.match(reader, /DEMO_LOGIN_EMAIL/);
  assert.match(reader, /isDemo: true/);
  assert.doesNotMatch(reader, /leaseDemoPoolEnvironment|ensureDemoSession|provisionDemo|create\(/);
  assert.match(login, /Environnement de démo incomplet/);
  assert.match(users, /isDemo: true/);
  assert.match(publicNav, /href: "\/demonstration"/);
});
