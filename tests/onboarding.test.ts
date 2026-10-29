import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { selectLoginRedirect } from "../src/lib/auth/login-redirect";
import { prisma } from "../src/services/prisma/client";
import { DEFAULT_BILLING_SETTINGS } from "../src/lib/validations/billing-settings";
import { DEFAULT_DISPATCH_SETTINGS } from "../src/lib/validations/dispatch-settings";
import { buildCompanyOnboardingStatus, getCompanyOnboardingStatus, onboardingPreferenceSchema, onboardingCompanyProfileSchema, updateOnboardingCompanyProfile, resolveOnboardingLoginPath, updateOnboardingPreference } from "../src/domains/onboarding/onboarding.service";

test("ONBOARD-1 : une entreprise neuve voit les neuf étapes à accomplir", () => {
  const result = buildCompanyOnboardingStatus({
    companyName: "Entreprise test",
    companyStatus: "TRIAL",
    settings: {},
    clientCount: 0,
    driverCount: 0,
    orderCount: 0,
    completedDeliveryCount: 0,
  });

  assert.equal(result.completedSteps, 0);
  assert.equal(result.totalSteps, 9);
  assert.equal(result.readyForInternalTest, false);
  assert.equal(result.steps.every((step) => !step.complete), true);
});

test("ONBOARD-1 : comptes, réglages et livraison réelle complètent le jalon interne", () => {
  const result = buildCompanyOnboardingStatus({
    companyName: "Entreprise test",
    companyStatus: "ACTIVE",
    companyProfile: { email: "entreprise@example.test", address: "1 rue du Test", city: "Paris", country: "FR" },
    settings: {
      deliveryCategories: { STANDARD: true, COURIER: false, SPECIAL_MISSION: false },
      billing: DEFAULT_BILLING_SETTINGS,
      dispatchRules: DEFAULT_DISPATCH_SETTINGS,
    },
    collaboratorCount: 1,
    clientCount: 1,
    driverCount: 1,
    orderCount: 1,
    completedDeliveryCount: 1,
  });

  assert.equal(result.completedSteps, 9);
  assert.equal(result.readyForInternalTest, true);
  assert.equal(result.steps.every((step) => step.complete), true);
  assert.deepEqual(result.limits, {
    invitationEmailValidated: false,
    initialImportAvailable: false,
  });
});

test("ONBOARD-1 : une mission terminée ne masque pas l'absence de livreur", () => {
  const result = buildCompanyOnboardingStatus({
    companyName: "Entreprise test",
    companyStatus: "ACTIVE",
    settings: { deliveryOptions: {}, tariffs: {}, dispatch: {} },
    clientCount: 1,
    driverCount: 0,
    orderCount: 1,
    completedDeliveryCount: 1,
  });

  assert.equal(result.steps.find((step) => step.key === "driver")?.complete, false);
  assert.equal(result.steps.find((step) => step.key === "dispatch")?.complete, false);
  assert.equal(result.readyForInternalTest, false);
});

function replaceMethod(t: TestContext, target: object, key: string, fn: unknown) {
  const original = Reflect.get(target, key);
  Reflect.set(target, key, fn);
  t.after(() => { Reflect.set(target, key, original); });
}

const fresh = {
  companyName: "Pilote manuel", companyStatus: "TRIAL" as const, settings: {},
  clientCount: 0, driverCount: 0, orderCount: 0, completedDeliveryCount: 0,
};

test("ONBOARD-1 : passer les collaborateurs ne valide aucune étape obligatoire", () => {
  const status = buildCompanyOnboardingStatus({ ...fresh, settings: { onboarding: { skippedCollaborators: true, firstDelivery: true } } });
  assert.equal(status.completedSteps, 0);
  assert.equal(status.skippedSteps, 1);
  assert.equal(status.readyForInternalTest, false);
  assert.equal(status.steps.find((step) => step.key === "firstDelivery")?.complete, false);
  assert.equal(onboardingPreferenceSchema.safeParse({ step: "firstDelivery", skipped: true }).success, false);
  assert.equal(onboardingPreferenceSchema.safeParse({ step: "collaborators", skipped: true, companyId: "foreign" }).success, false);
});

test("ONBOARD-1 : les invitations en attente et les réglages vides ne valent pas activation", () => {
  const status = buildCompanyOnboardingStatus({ ...fresh,
    pendingClientCount: 1, pendingDriverCount: 2, pendingCollaboratorCount: 1,
    settings: { deliveryCategories: {}, billing: {}, dispatchRules: {} },
  });
  assert.equal(status.completedSteps, 0);
  for (const key of ["client", "driver", "collaborators"]) {
    assert.match(status.steps.find((step) => step.key === key)!.description, /en attente/);
  }
});

test("ONBOARD-1 : un collaborateur activé remplace le saut sans double comptage", () => {
  const status = buildCompanyOnboardingStatus({ ...fresh, collaboratorCount: 1, settings: { onboarding: { skippedCollaborators: true } } });
  assert.equal(status.completedSteps, 1);
  assert.equal(status.skippedSteps, 0);
});

test("ONBOARD-1 : reprise serveur isolée, activation et suspension recalculées", async (t) => {
  replaceMethod(t, prisma.company, "findUnique", async (args: { where: { id: string } }) => {
    assert.equal(args.where.id, "company-a");
    return { name: "Pilote", status: "TRIAL", settings: { onboarding: { skippedCollaborators: true } } };
  });
  let status = "PENDING_VERIFICATION";
  replaceMethod(t, prisma.user, "groupBy", async (args: { where: { companyId: string } }) => {
    assert.equal(args.where.companyId, "company-a");
    return [{ roleId: "client", status, _count: { _all: 1 } }];
  });
  replaceMethod(t, prisma.role, "findMany", async () => [{ id: "client", systemRole: "CLIENT" }]);
  for (const model of [prisma.order, prisma.delivery]) replaceMethod(t, model, "count", async (args: { where: { companyId: string } }) => {
    assert.equal(args.where.companyId, "company-a"); return 0;
  });
  assert.equal((await getCompanyOnboardingStatus("company-a")).completedSteps, 0);
  status = "ACTIVE";
  const resumed = await getCompanyOnboardingStatus("company-a");
  assert.equal(resumed.completedSteps, 1);
  assert.equal(resumed.skippedSteps, 1);
  status = "SUSPENDED";
  assert.equal((await getCompanyOnboardingStatus("company-a")).completedSteps, 0);
});

test("ONBOARD-1 : choix persistant, idempotent et réversible sans écraser les réglages concurrents", async (t) => {
  let settings: Record<string, unknown> = { billing: { marker: "keep" } };
  replaceMethod(t, prisma.company, "findUnique", async () => ({ settings }));
  let conflict = true;
  replaceMethod(t, prisma.company, "updateMany", async (args: { where: { id: string; settings: { equals: unknown } }; data: { settings: Record<string, unknown> } }) => {
    assert.equal(args.where.id, "company-a");
    if (conflict) { conflict = false; settings = { ...settings, external: "concurrent" }; return { count: 0 }; }
    assert.deepEqual(args.where.settings.equals, settings);
    settings = args.data.settings; return { count: 1 };
  });
  for (const skipped of [true, true, false]) {
    await updateOnboardingPreference("company-a", { step: "collaborators", skipped });
    assert.deepEqual(settings, { billing: { marker: "keep" }, external: "concurrent", onboarding: { skippedCollaborators: skipped } });
  }
});

test("ONBOARD-1 : données invalides, entreprise absente et conflits bornés ne sont pas validés", async (t) => {
  let reads = 0;
  replaceMethod(t, prisma.company, "findUnique", async () => { reads++; return null; });
  await assert.rejects(updateOnboardingPreference("a", { step: "driver", skipped: true }));
  assert.equal(reads, 0);
  await assert.rejects(updateOnboardingPreference("a", { step: "collaborators", skipped: true }), /COMPANY_NOT_FOUND/);
  replaceMethod(t, prisma.company, "findUnique", async () => ({ settings: {} }));
  let writes = 0;
  replaceMethod(t, prisma.company, "updateMany", async () => { writes++; return { count: 0 }; });
  await assert.rejects(updateOnboardingPreference("a", { step: "collaborators", skipped: true }), /ONBOARDING_CONFLICT/);
  assert.equal(writes, 3);
});

const companyProfile = { name: "Pilote manuel", email: "contact@example.test", address: "1 rue du Test", city: "Paris", country: "FR", phone: "" };

test("ONBOARD-1 : informations entreprise validées avant écriture et isolées par société", async (t) => {
  const writes: unknown[] = [];
  replaceMethod(t, prisma.company, "updateMany", async (args: unknown) => { writes.push(args); return { count: 1 }; });
  for (const profile of [{ ...companyProfile, email: "invalid" }, { ...companyProfile, name: " " }, { ...companyProfile, companyId: "foreign" }, { ...companyProfile, status: "ACTIVE" }]) {
    assert.equal(onboardingCompanyProfileSchema.safeParse(profile).success, false);
    await assert.rejects(updateOnboardingCompanyProfile("a", profile));
  }
  assert.equal(writes.length, 0);
  await updateOnboardingCompanyProfile("a", { ...companyProfile, name: " Pilote manuel ", country: "fr" });
  assert.deepEqual(writes, [{ where: { id: "a" }, data: companyProfile }]);
});

test("ONBOARD-1 : activation autonome reprend l’assistant ; compte déjà prêt retrouve le tableau de bord", async (t) => {
  let complete = false;
  let reads = 0;
  replaceMethod(t, prisma.company, "findUnique", async () => { reads++; return { ...companyProfile, status: "TRIAL", settings: {
    onboarding: { skippedCollaborators: true },
    ...(complete ? { deliveryCategories: { STANDARD: true, COURIER: false, SPECIAL_MISSION: false }, billing: DEFAULT_BILLING_SETTINGS, dispatchRules: DEFAULT_DISPATCH_SETTINGS } : {}),
  } }; });
  replaceMethod(t, prisma.user, "groupBy", async () => ["client", "driver"].map((roleId) => ({ roleId, status: "ACTIVE", _count: { _all: 1 } })));
  replaceMethod(t, prisma.role, "findMany", async () => [{ id: "client", systemRole: "CLIENT" }, { id: "driver", systemRole: "DRIVER" }]);
  for (const model of [prisma.order, prisma.delivery]) replaceMethod(t, model, "count", async () => complete ? 1 : 0);
  const admin = { companyId: "a", role: { systemRole: "COMPANY_ADMIN" }, settings: { onboardingRequired: true } };
  for (const user of [{ ...admin, settings: {} }, { ...admin, companyId: null }, { ...admin, role: { systemRole: "DRIVER" } }]) {
    assert.equal(await resolveOnboardingLoginPath(user, "/dashboard"), "/dashboard");
  }
  assert.equal(reads, 0);
  assert.equal(await resolveOnboardingLoginPath(admin, "/dashboard"), "/onboarding");
  complete = true;
  assert.equal(await resolveOnboardingLoginPath(admin, "/dashboard"), "/dashboard");
  assert.equal(reads, 2);
});

test("ONBOARD-1 : un ancien lien dashboard ne contourne pas la reprise serveur", () => {
  assert.equal(selectLoginRedirect("/dashboard", "/onboarding"), "/onboarding");
  assert.equal(selectLoginRedirect(null, "/dashboard"), "/dashboard");
  assert.equal(selectLoginRedirect("/onboarding", "/dashboard"), "/onboarding");
  assert.equal(selectLoginRedirect("/onboarding", "/portal"), "/portal");
  assert.equal(selectLoginRedirect("https://foreign.test", "/dashboard"), "/dashboard");
});

test("DESIGN-2 : Première livraison proposée au démarrage, puis hors du menu une fois terminée ou masquée", async () => {
  const { applyOnboardingNavVisibility } = await import("../src/features/navigation/onboarding-nav");
  const { companyNavItems } = await import("../src/features/navigation/nav-config");
  const hasEntry = (status?: { showInNavigation: boolean }) =>
    applyOnboardingNavVisibility(companyNavItems, status).some((item) => item.href === "/onboarding");

  const started = buildCompanyOnboardingStatus(fresh);
  assert.equal(started.showInNavigation, true);
  assert.equal(started.hiddenFromNavigation, false);
  assert.equal(hasEntry(started), true);

  // Masqué : hors du menu, mais l'avancement et les étapes incomplètes restent calculés (reprise).
  const hidden = buildCompanyOnboardingStatus({ ...fresh, settings: { onboarding: { hiddenFromNavigation: true, skippedCollaborators: true } } });
  assert.equal(hidden.showInNavigation, false);
  assert.equal(hidden.skippedSteps, 1);
  assert.equal(hidden.steps.filter((step) => !step.complete && !step.skipped).length, 8);
  assert.equal(hasEntry(hidden), false);

  // Terminé : hors du menu même sans l'avoir masqué. Statut inconnu (chargement, erreur) : hors du menu.
  const done = buildCompanyOnboardingStatus({
    ...fresh, companyStatus: "ACTIVE",
    companyProfile: { email: "entreprise@example.test", address: "1 rue du Test", city: "Paris", country: "FR" },
    settings: { deliveryCategories: { STANDARD: true, COURIER: false, SPECIAL_MISSION: false }, billing: DEFAULT_BILLING_SETTINGS, dispatchRules: DEFAULT_DISPATCH_SETTINGS },
    collaboratorCount: 1, clientCount: 1, driverCount: 1, orderCount: 1, completedDeliveryCount: 1,
  });
  assert.equal(done.showInNavigation, false);
  assert.equal(hasEntry(done), false);
  assert.equal(hasEntry(undefined), false);
  // Seule l'entrée du guide disparaît : les autres rubriques restent, dans le même ordre.
  assert.deepEqual(applyOnboardingNavVisibility(companyNavItems, done).map((item) => item.href), companyNavItems.map((item) => item.href).filter((href) => href !== "/onboarding"));
  // Valeur héritée non booléenne (ancien code, saisie libre) : jamais interprétée comme « masqué ».
  assert.equal(buildCompanyOnboardingStatus({ ...fresh, settings: { onboarding: { hiddenFromNavigation: "true" } } }).showInNavigation, true);
});

test("DESIGN-2 : masquer ou réafficher le guide est persistant, réversible et préserve les réglages concurrents", async (t) => {
  let settings: Record<string, unknown> = { billing: { marker: "keep" }, onboarding: { skippedCollaborators: true } };
  replaceMethod(t, prisma.company, "findUnique", async () => ({ settings }));
  let conflict = true;
  replaceMethod(t, prisma.company, "updateMany", async (args: { where: { settings: { equals: unknown } }; data: { settings: Record<string, unknown> } }) => {
    if (conflict) { conflict = false; settings = { ...settings, external: "concurrent" }; return { count: 0 }; }
    assert.deepEqual(args.where.settings.equals, settings);
    settings = args.data.settings; return { count: 1 };
  });
  for (const hidden of [true, true, false]) {
    await updateOnboardingPreference("company-a", { step: "navigation", hidden });
    assert.deepEqual(settings, { billing: { marker: "keep" }, external: "concurrent", onboarding: { skippedCollaborators: true, hiddenFromNavigation: hidden } });
  }
  for (const invalid of [{ step: "navigation" }, { step: "navigation", hidden: "oui" }, { step: "navigation", hidden: true, skipped: true }, { step: "collaborators", hidden: true }]) {
    assert.equal(onboardingPreferenceSchema.safeParse(invalid).success, false, JSON.stringify(invalid));
  }
});

test("DESIGN-2 : un guide masqué n'est plus imposé à la connexion", async (t) => {
  let hidden = false;
  replaceMethod(t, prisma.company, "findUnique", async () => ({ ...companyProfile, status: "TRIAL", settings: { onboarding: { hiddenFromNavigation: hidden } } }));
  replaceMethod(t, prisma.user, "groupBy", async () => []);
  replaceMethod(t, prisma.role, "findMany", async () => []);
  for (const model of [prisma.order, prisma.delivery]) replaceMethod(t, model, "count", async () => 0);
  const admin = { companyId: "a", role: { systemRole: "COMPANY_ADMIN" }, settings: { onboardingRequired: true } };
  assert.equal(await resolveOnboardingLoginPath(admin, "/dashboard"), "/onboarding");
  hidden = true;
  assert.equal(await resolveOnboardingLoginPath(admin, "/dashboard"), "/dashboard");
});
