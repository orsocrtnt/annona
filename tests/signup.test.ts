import assert from "node:assert/strict";
import test from "node:test";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { Prisma } from "@prisma/client";
import { describeSignupValidation, signupActionSchema, signupIdentityDetailsSchema, signupIdentitySchema } from "../src/lib/validations/signup";
import { buildSignupPlanComparison } from "../src/features/auth/signup-plan-comparison";

function loadSignupService(overrides: Record<string, unknown> = {}) {
  const module = { exports: {} };
  const dependencies: Record<string, unknown> = {
    "server-only": {},
    "node:crypto": { createHash, randomBytes, timingSafeEqual },
    "@prisma/client": { Prisma },
    "@/services/prisma/client": { prisma: {} },
    "@/services/supabase/admin": { createAdminClient: () => ({}) },
    "@/services/supabase/password-link": { createPasswordLinkClient: () => ({}) },
    "@/lib/auth/email-links": { getPasswordLinkRedirect: () => "https://example.test/reset-password" },
    "@/lib/auth/normalize-email": { normalizeEmail: (value: string) => value.trim().toLowerCase() },
    "@/lib/utils": { slugify: (value: string) => value.toLowerCase().replaceAll(" ", "-") },
    "@/domains/saas/saas.service": { snapshotPlan: (value: unknown) => value },
    "@/domains/operations/operation-job.service": {
      enqueueOperationJob: () => ({}),
      kickOperationJob: () => undefined,
    },
    "@/lib/email/transactional-email": { sendTransactionalEmail: () => ({}) },
    "@/domains/sales/sales-code.service": {
      attributeSignupSale: async () => ({ status: "none" }),
      resolveActiveSalesCodeId: async (raw: string) => {
        if (raw.trim().toUpperCase() !== "CAMILLER-BBBB") throw new Error("SALES_CODE_INVALID");
        return "sales-code-1";
      },
    },
    ...overrides,
  };
  const source = ts.transpileModule(readFileSync(resolve("src/domains/signup/signup.service.ts"), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  runInNewContext(source, { Buffer, Date, Error, Map, Set, JSON, Math, console, URL, process, exports: module.exports, module, require: (id: string) => {
    assert.ok(id in dependencies, `Unexpected dependency ${id}`);
    return dependencies[id];
  } });
  return module.exports as typeof import("../src/domains/signup/signup.service");
}

const catalog = {
  id: "catalog",
  code: "C7_V1",
  currency: "EUR",
  vatRateBps: 2000,
  plans: [
    { code: "STARTER" as const, name: "Starter", monthlyPriceCents: 7900, annualPriceCents: 79000, includedDriverSeats: 5, unlimitedDriverSeats: false, maxDriverSeats: 10, includedAdminSeats: 1, maxAdminSeats: 1, includedDispatcherSeats: 0, maxDispatcherSeats: null, includedMonthlyOrders: 1000, orderOverageUnitPriceCents: 10, includedFeatures: [] },
    { code: "PRO" as const, name: "Pro", monthlyPriceCents: 17900, annualPriceCents: 179000, includedDriverSeats: 10, unlimitedDriverSeats: false, maxDriverSeats: 30, includedAdminSeats: 1, maxAdminSeats: 1, includedDispatcherSeats: 1, maxDispatcherSeats: null, includedMonthlyOrders: 3000, orderOverageUnitPriceCents: 8, includedFeatures: ["auto_dispatch", "admin_gps"] },
  ],
  options: [
    { id: "gps", code: "ADMIN_GPS", name: "Carte GPS administrateur", kind: "OPTION" as const, featureKey: "admin_gps", monthlyPriceCents: 3900, annualPriceCents: 46800, applicablePlans: ["STARTER" as const] },
    { id: "driver", code: "DRIVER_STARTER", name: "Livreur supplémentaire Starter", kind: "DRIVER_SEAT" as const, featureKey: null, monthlyPriceCents: 1200, annualPriceCents: 14400, applicablePlans: ["STARTER" as const] },
    { id: "dispatcher", code: "DISPATCHER_ALL", name: "Dispatcher supplémentaire", kind: "DISPATCHER_SEAT" as const, featureKey: null, monthlyPriceCents: 800, annualPriceCents: 9600, applicablePlans: ["STARTER" as const, "PRO" as const] },
  ],
};

test("SIGNUP-1 : la comparaison d’offres montre ce que les formules moins chères n’incluent pas", () => {
  const comparisonCatalog = {
    currency: "EUR",
    vatRateBps: 2000,
    plans: [
      { code: "STARTER" as const, name: "Starter", monthlyPriceCents: 7900, annualPriceCents: 79000, includedDriverSeats: 5, unlimitedDriverSeats: false, maxDriverSeats: 10, includedAdminSeats: 1, includedDispatcherSeats: 0, includedMonthlyOrders: 1000, orderOverageUnitPriceCents: 10, includedFeatures: [] },
      { code: "PRO" as const, name: "Pro", monthlyPriceCents: 17900, annualPriceCents: 179000, includedDriverSeats: 10, unlimitedDriverSeats: false, maxDriverSeats: 30, includedAdminSeats: 1, includedDispatcherSeats: 1, includedMonthlyOrders: 3000, orderOverageUnitPriceCents: 8, includedFeatures: ["auto_dispatch", "admin_gps"] },
      { code: "BUSINESS" as const, name: "Business", monthlyPriceCents: 34900, annualPriceCents: 349000, includedDriverSeats: 0, unlimitedDriverSeats: true, maxDriverSeats: null, includedAdminSeats: 2, includedDispatcherSeats: 1, includedMonthlyOrders: 6000, orderOverageUnitPriceCents: 6, includedFeatures: ["auto_dispatch", "admin_gps", "client_gps", "advanced_analytics", "priority_support"] },
    ],
    options: [
      { code: "AUTO_DISPATCH", name: "Dispatch automatique", kind: "OPTION" as const, featureKey: "auto_dispatch", monthlyPriceCents: 2900, annualPriceCents: 34800, applicablePlans: ["STARTER" as const] },
      { code: "ADMIN_GPS", name: "Carte GPS administrateur", kind: "OPTION" as const, featureKey: "admin_gps", monthlyPriceCents: 3900, annualPriceCents: 46800, applicablePlans: ["STARTER" as const] },
      { code: "CLIENT_GPS", name: "Carte GPS client", kind: "OPTION" as const, featureKey: "client_gps", monthlyPriceCents: 4900, annualPriceCents: 58800, applicablePlans: ["STARTER" as const, "PRO" as const] },
      { code: "ADVANCED_ANALYTICS", name: "Analytics avancés", kind: "OPTION" as const, featureKey: "advanced_analytics", monthlyPriceCents: 2900, annualPriceCents: 34800, applicablePlans: ["STARTER" as const, "PRO" as const] },
      { code: "PRIORITY_SUPPORT", name: "Support prioritaire", kind: "OPTION" as const, featureKey: "priority_support", monthlyPriceCents: 2900, annualPriceCents: 34800, applicablePlans: ["STARTER" as const, "PRO" as const] },
      { code: "DISPATCHER_ALL", name: "Dispatcher supplémentaire", kind: "DISPATCHER_SEAT" as const, featureKey: null, monthlyPriceCents: 800, annualPriceCents: 9600, applicablePlans: ["STARTER" as const, "PRO" as const, "BUSINESS" as const] },
    ],
  };
  const rows = buildSignupPlanComparison(comparisonCatalog, "MONTHLY");
  const byId = Object.fromEntries(rows.map((row) => [row.id, row]));
  const row = (id: string) => {
    const found = byId[id];
    if (!found) throw new Error(`missing comparison row ${id}`);
    return found;
  };
  assert.equal(rows.some((item) => item.id === "dispatchers"), false);
  assert.equal(row("auto_dispatch").label, "Dispatch automatique");
  assert.equal(row("auto_dispatch").cells.STARTER.kind, "option");
  assert.match(row("auto_dispatch").cells.STARTER.text, /29,00/);
  assert.match(row("auto_dispatch").cells.STARTER.text, /En option · .+ HT \/ mois/);
  assert.equal(row("auto_dispatch").cells.PRO.kind, "included");
  assert.equal(row("auto_dispatch").cells.PRO.text, "1 inclus");
  assert.equal(row("auto_dispatch").cells.BUSINESS.kind, "included");
  assert.equal(row("auto_dispatch").cells.BUSINESS.text, "1 inclus");
  assert.equal(row("admin_gps").cells.STARTER.kind, "option");
  assert.match(row("admin_gps").cells.STARTER.text, /En option/);
  assert.equal(row("admin_gps").cells.PRO.kind, "included");
  assert.equal(row("admin_gps").cells.BUSINESS.kind, "included");
  assert.equal(row("client_gps").cells.STARTER.kind, "option");
  assert.equal(row("client_gps").cells.PRO.kind, "option");
  assert.equal(row("client_gps").cells.BUSINESS.kind, "included");
  assert.equal(row("drivers").cells.BUSINESS.text, "Illimités, usage mesuré");
  assert.equal(row("orders").cells.STARTER.text.replace(/\s/g, " "), "1 000");
  const annual = buildSignupPlanComparison(comparisonCatalog, "ANNUAL");
  const annualPrice = annual.find((item) => item.id === "price");
  if (!annualPrice) throw new Error("missing comparison row price");
  const money = (text: string) => text.replace(/\s/g, " ");
  assert.match(annual.find((item) => item.id === "auto_dispatch")!.cells.STARTER.text, /\/ an/);
  assert.equal(annual.find((item) => item.id === "auto_dispatch")!.cells.PRO.text, "1 inclus");
  assert.equal(annual.find((item) => item.id === "auto_dispatch")!.cells.BUSINESS.text, "1 inclus");
  assert.match(money(annualPrice.cells.STARTER.text), /790,00 €/);
  assert.match(money(annualPrice.cells.STARTER.struckText ?? ""), /948,00 €/);
  assert.match(money(annualPrice.cells.PRO.text), /1 790,00 €/);
  assert.match(money(annualPrice.cells.PRO.struckText ?? ""), /2 148,00 €/);
  assert.equal(row("price").cells.STARTER.struckText, undefined);
  const ui = readFileSync(resolve("src/features/auth/signup-wizard.tsx"), "utf8");
  const table = readFileSync(resolve("src/features/auth/signup-plan-comparison-table.tsx"), "utf8");
  assert.match(ui, /SignupPlanComparisonTable/);
  assert.match(table, /Comparaison des formules Starter, Pro et Business/);
  assert.match(table, /cell\.struckText/);
});

test("SIGNUP-1 : devis mensuel/annuel exact, options annuelles à douze mensualités", () => {
  const service = loadSignupService();
  const monthly = service.buildSignupQuote(catalog, "STARTER", "MONTHLY", []);
  assert.equal(monthly.totalHtCents, 7900);
  assert.equal(monthly.vatCents, 1580);
  assert.equal(monthly.totalTtcCents, 9480);
  assert.equal(monthly.orderOverageUnitPriceCents, 10);
  const annual = service.buildSignupQuote(catalog, "STARTER", "ANNUAL", [
    { code: "DRIVER_STARTER", quantity: 2 },
    { code: "ADMIN_GPS", quantity: 1 },
  ]);
  assert.equal(annual.planPriceCents, 79000);
  assert.equal(annual.optionsPriceCents, 2 * 14400 + 46800);
  assert.equal(annual.totalTtcCents, Math.round(annual.totalHtCents * 1.2));
});

test("SIGNUP-1 : options incluses, doublons, quantités et plafonds sont refusés côté serveur", () => {
  const service = loadSignupService();
  assert.throws(() => service.buildSignupQuote(catalog, "PRO", "MONTHLY", [{ code: "ADMIN_GPS", quantity: 1 }]), /SIGNUP_OPTION_INVALID|SIGNUP_OPTION_ALREADY_INCLUDED/);
  assert.throws(() => service.buildSignupQuote(catalog, "STARTER", "MONTHLY", [{ code: "ADMIN_GPS", quantity: 2 }]), /SIGNUP_OPTION_QUANTITY_INVALID/);
  assert.throws(() => service.buildSignupQuote(catalog, "STARTER", "MONTHLY", [{ code: "DRIVER_STARTER", quantity: 6 }]), /SIGNUP_DRIVER_LIMIT_EXCEEDED/);
  assert.throws(() => service.buildSignupQuote(catalog, "STARTER", "MONTHLY", [{ code: "DISPATCHER_ALL", quantity: 1 }, { code: "DISPATCHER_ALL", quantity: 1 }]), /SIGNUP_OPTION_INVALID/);
});

test("SIGNUP-1 : un refus ou événement tardif ne rétrograde jamais un paiement confirmé", () => {
  const service = loadSignupService();
  assert.equal(JSON.stringify(service.nextSignupPaymentState(false, "PENDING")), JSON.stringify({ status: "PAYMENT_PENDING", failureCode: null, confirmsPayment: false }));
  assert.equal(JSON.stringify(service.nextSignupPaymentState(false, "DECLINED")), JSON.stringify({ status: "EMAIL_VERIFIED", failureCode: "PAYMENT_DECLINED", confirmsPayment: false }));
  assert.equal(JSON.stringify(service.nextSignupPaymentState(false, "CONFIRMED")), JSON.stringify({ status: "PAYMENT_CONFIRMED", failureCode: null, confirmsPayment: true }));
  assert.equal(JSON.stringify(service.nextSignupPaymentState(true, "DECLINED")), JSON.stringify({ status: "PAYMENT_CONFIRMED", failureCode: null, confirmsPayment: false }));
});

test("SIGNUP-1 : les périodes calendaires conservent le jour ou la fin de mois en UTC", () => {
  const service = loadSignupService();
  assert.equal(
    service.signupPeriodEnd(new Date("2026-01-31T12:30:00.000Z"), "MONTHLY").toISOString(),
    "2026-02-28T12:30:00.000Z"
  );
  assert.equal(
    service.signupPeriodEnd(new Date("2024-02-29T08:00:00.000Z"), "ANNUAL").toISOString(),
    "2025-02-28T08:00:00.000Z"
  );
});

test("SIGNUP-1 : identité bornée, SIREN/SIRET cohérents et mot de passe jamais dans le schéma SQL", () => {
  const base = { action: "identity", firstName: "Ada", lastName: "Martin", email: "ada@example.test", password: "Secret123", companyName: "Livraison Ada", billingAddress: "1 rue du Test", billingPostalCode: "75001", billingCity: "Paris", billingCountry: "FR" };
  assert.equal(signupIdentitySchema.safeParse({ ...base, siren: "123456789", siret: "12345678900012" }).success, true);
  assert.equal(signupIdentitySchema.safeParse({ ...base, siren: "123456789", siret: "99999999900012" }).success, false);
  const shortName = signupIdentitySchema.safeParse({ ...base, lastName: "c" });
  assert.equal(shortName.success, false);
  if (shortName.success) throw new Error("expected lastName validation");
  const shortNameDetails = describeSignupValidation(shortName.error);
  assert.equal(shortNameDetails.fields.lastName, "Le nom doit contenir au moins 2 caractères.");
  assert.equal(shortNameDetails.summary, "Le nom doit contenir au moins 2 caractères.");
  const weakPassword = signupIdentitySchema.safeParse({ ...base, password: "testtest" });
  assert.equal(weakPassword.success, false);
  if (weakPassword.success) throw new Error("expected password validation");
  assert.match(describeSignupValidation(weakPassword.error).fields.password ?? "", /minuscule, une majuscule et un chiffre/);
  const route = readFileSync(resolve("src/app/api/signup/route.ts"), "utf8");
  const ui = readFileSync(resolve("src/features/auth/signup-wizard.tsx"), "utf8");
  assert.match(route, /describeSignupValidation/);
  assert.match(route, /fields: details.fields/);
  assert.match(ui, /fieldErrors\.lastName/);
  assert.match(ui, /Les mots de passe ne correspondent pas/);
  const migration = readFileSync(resolve("prisma/migrations/20261022130000_signup_autonomous/migration.sql"), "utf8");
  assert.doesNotMatch(migration, /password/i);
  assert.match(migration, /ENABLE ROW LEVEL SECURITY/g);
  assert.match(migration, /REVOKE ALL PRIVILEGES/);
});

test("SIGNUP-1 : le renvoi d’e-mail est une action bornée à trente secondes côté serveur", () => {
  assert.equal(signupActionSchema.safeParse({ action: "resend-email" }).success, true);
  const service = readFileSync(resolve("src/domains/signup/signup.service.ts"), "utf8");
  const ui = readFileSync(resolve("src/features/auth/signup-wizard.tsx"), "utf8");
  const migration = readFileSync(resolve("prisma/migrations/20261023150000_signup_email_resend/migration.sql"), "utf8");
  assert.match(service, /SIGNUP_EMAIL_RESEND_COOLDOWN_SECONDS = 30/);
  assert.match(service, /verificationEmailSentAt: \{ lte: availableBefore \}/);
  assert.match(service, /client\.auth\.resend/);
  assert.match(service, /deliverSignupConfirmationEmail/);
  assert.match(service, /reuseUnconfirmedAuthUser/);
  assert.match(ui, /Renvoyer l’e-mail dans \$\{resendSeconds\} s/);
  assert.match(ui, /disabled=\{submitting \|\| resendSeconds > 0\}/);
  assert.match(ui, /Cette adresse est déjà confirmée/);
  assert.match(migration, /verification_email_sent_at/);
});

test("SIGNUP-1 : deux renvois concurrents produisent un seul e-mail", async () => {
  const resumeToken = "resume-token-long-enough-for-signup-test";
  const row = {
    id: "signup-1",
    resumeTokenHash: createHash("sha256").update(resumeToken).digest("hex"),
    status: "EMAIL_PENDING",
    catalogVersionId: "catalog",
    planCode: "STARTER",
    billingInterval: "MONTHLY",
    optionSelections: [],
    quoteSnapshot: {},
    email: "signup@example.test",
    authUserId: "auth-1",
    emailLinkTokenHash: "hash",
    firstName: "Ada",
    lastName: "Martin",
    companyName: "Livraison Ada",
    legalName: null,
    siren: null,
    siret: null,
    phone: null,
    billingAddress: "1 rue du Test",
    billingPostalCode: "75001",
    billingCity: "Paris",
    billingCountry: "FR",
    emailVerifiedAt: null,
    verificationEmailSentAt: null as Date | null,
    paymentConfirmedAt: null,
    activatedAt: null,
    failureCode: null as string | null,
    expiresAt: new Date(Date.now() + 60_000),
    companyId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  let sends = 0;
  const prismaMock = {
    signupJourney: {
      findUnique: async () => row,
      findUniqueOrThrow: async () => row,
      update: async ({ data }: { data: Partial<typeof row> }) => Object.assign(row, data),
      updateMany: async ({ data }: { data: { verificationEmailSentAt: Date | null; failureCode?: string | null } }) => {
        if (data.verificationEmailSentAt instanceof Date) {
          if (row.verificationEmailSentAt && Date.now() - row.verificationEmailSentAt.getTime() < 30_000) return { count: 0 };
          row.verificationEmailSentAt = data.verificationEmailSentAt;
          row.failureCode = data.failureCode ?? null;
          return { count: 1 };
        }
        Object.assign(row, data);
        return { count: 1 };
      },
    },
    user: { findFirst: async () => null, findUnique: async () => null },
  };
  const service = loadSignupService({
    "@/services/prisma/client": { prisma: prismaMock },
    "@/services/supabase/admin": { createAdminClient: () => ({ auth: { admin: {
      getUserById: async () => ({ data: { user: { id: "auth-1", email: "signup@example.test", email_confirmed_at: null } }, error: null }),
      listUsers: async () => ({ data: { users: [] }, error: null }),
      updateUserById: async () => ({ error: null }),
    } } }) },
    "@/services/supabase/password-link": { createPasswordLinkClient: () => ({ auth: { resend: async () => { sends += 1; return { error: null }; } } }) },
  });
  const results = await Promise.allSettled([
    service.resendSignupConfirmation(resumeToken),
    service.resendSignupConfirmation(resumeToken),
  ]);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(results.filter((result) => result.status === "rejected").length, 1);
  assert.equal(sends, 1);
  assert.ok(row.verificationEmailSentAt);
});

test("SIGNUP-1 : un e-mail non confirmé peut recevoir un nouvel envoi même s’il existe déjà", async () => {
  const resumeToken = "resume-token-for-reused-unconfirmed-email";
  const row = {
    id: "signup-reuse-1",
    resumeTokenHash: createHash("sha256").update(resumeToken).digest("hex"),
    status: "DRAFT" as string,
    catalogVersionId: "catalog",
    planCode: "STARTER",
    billingInterval: "MONTHLY",
    optionSelections: [],
    quoteSnapshot: {},
    email: null as string | null,
    authUserId: null as string | null,
    emailLinkTokenHash: null as string | null,
    firstName: null as string | null,
    lastName: null,
    companyName: null,
    legalName: null,
    siren: null,
    siret: null,
    phone: null,
    billingAddress: null,
    billingPostalCode: null,
    billingCity: null,
    billingCountry: "FR",
    emailVerifiedAt: null,
    verificationEmailSentAt: null as Date | null,
    paymentConfirmedAt: null,
    activatedAt: null,
    failureCode: null as string | null,
    expiresAt: new Date(Date.now() + 60_000),
    companyId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const identity = {
    firstName: "Ada",
    lastName: "Martin",
    email: "reuse@example.test",
    password: "Secret123",
    companyName: "Livraison Ada",
    billingAddress: "1 rue du Test",
    billingPostalCode: "75001",
    billingCity: "Paris",
    billingCountry: "FR",
  };
  let signUps = 0;
  let resends = 0;
  let listedEmail: string | null = null;
  const prismaMock = {
    signupJourney: {
      findUnique: async () => row,
      findUniqueOrThrow: async () => row,
      update: async ({ data }: { data: Partial<typeof row> }) => Object.assign(row, data),
      updateMany: async ({ data }: { data: Partial<typeof row> }) => {
        Object.assign(row, data);
        return { count: 1 };
      },
    },
    user: { findUnique: async () => null, findFirst: async () => null },
  };
  const service = loadSignupService({
    "@/services/prisma/client": { prisma: prismaMock },
    "@/services/supabase/admin": {
      createAdminClient: () => ({ auth: { admin: {
        getUserById: async () => ({ data: { user: null }, error: { status: 404, code: "user_not_found" } }),
        listUsers: async () => {
          listedEmail = "reuse@example.test";
          return { data: { users: [{ id: "auth-unconfirmed", email: "reuse@example.test", email_confirmed_at: null }] }, error: null };
        },
        updateUserById: async () => ({ error: null }),
        deleteUser: async () => ({ error: null }),
      } } }),
    },
    "@/services/supabase/password-link": {
      createPasswordLinkClient: () => ({ auth: {
        signUp: async () => {
          signUps += 1;
          return { data: { user: { id: "fake-hidden", identities: [] }, session: null }, error: null };
        },
        resend: async () => {
          resends += 1;
          return { error: null };
        },
        signOut: async () => ({ error: null }),
      } }),
    },
  });
  const first = await service.submitSignupIdentity(resumeToken, identity);
  assert.equal(first.verificationRequired, true);
  assert.equal(signUps, 0);
  assert.equal(resends, 1);
  assert.equal(listedEmail, "reuse@example.test");
  assert.equal(row.authUserId, "auth-unconfirmed");
  assert.equal(row.status, "EMAIL_PENDING");

  signUps = 0;
  resends = 0;
  const pendingService = loadSignupService({
    "@/services/prisma/client": { prisma: prismaMock },
    "@/services/supabase/admin": {
      createAdminClient: () => ({ auth: { admin: {
        getUserById: async () => ({ data: { user: { id: "auth-unconfirmed", email: "reuse@example.test", email_confirmed_at: null } }, error: null }),
        listUsers: async () => ({ data: { users: [] }, error: null }),
        updateUserById: async () => ({ error: null }),
        deleteUser: async () => ({ error: null }),
      } } }),
    },
    "@/services/supabase/password-link": {
      createPasswordLinkClient: () => ({ auth: {
        signUp: async () => {
          signUps += 1;
          return { data: { user: { id: "should-not", identities: [{ id: "x" }] }, session: null }, error: null };
        },
        resend: async () => {
          resends += 1;
          return { error: null };
        },
        signOut: async () => ({ error: null }),
      } }),
    },
  });
  await pendingService.submitSignupIdentity(resumeToken, identity);
  assert.equal(signUps, 0);
  assert.equal(resends, 1);

  let deleted = false;
  signUps = 0;
  resends = 0;
  row.authUserId = "auth-confirmed-orphan";
  const orphanService = loadSignupService({
    "@/services/prisma/client": { prisma: prismaMock },
    "@/services/supabase/admin": {
      createAdminClient: () => ({ auth: { admin: {
        getUserById: async (id: string) => id === "auth-fresh"
          ? { data: { user: { id: "auth-fresh", email: "reuse@example.test", email_confirmed_at: null } }, error: null }
          : { data: { user: { id: "auth-confirmed-orphan", email: "reuse@example.test", email_confirmed_at: "2026-10-23T00:00:00.000Z" } }, error: null },
        listUsers: async () => ({ data: { users: [] }, error: null }),
        updateUserById: async () => ({ error: null }),
        deleteUser: async () => { deleted = true; return { error: null }; },
      } } }),
    },
    "@/services/supabase/password-link": {
      createPasswordLinkClient: () => ({ auth: {
        signUp: async () => {
          signUps += 1;
          return { data: { user: { id: "auth-fresh", identities: [{ id: "id-1" }] }, session: null }, error: null };
        },
        resend: async () => {
          resends += 1;
          return { error: null };
        },
        signOut: async () => ({ error: null }),
      } }),
    },
  });
  await orphanService.submitSignupIdentity(resumeToken, identity);
  assert.equal(deleted, true);
  assert.equal(signUps, 1);
  assert.equal(resends, 0);
  assert.equal(row.authUserId, "auth-fresh");

  let deletedReal = false;
  signUps = 0;
  resends = 0;
  row.authUserId = "auth-confirmed-real";
  const realService = loadSignupService({
    "@/services/prisma/client": { prisma: {
      signupJourney: prismaMock.signupJourney,
      user: { findUnique: async () => ({ id: "user-1" }), findFirst: async () => ({ id: "user-1" }) },
    } },
    "@/services/supabase/admin": {
      createAdminClient: () => ({ auth: { admin: {
        getUserById: async () => ({ data: { user: { id: "auth-confirmed-real", email: "reuse@example.test", email_confirmed_at: "2026-10-23T00:00:00.000Z" } }, error: null }),
        listUsers: async () => ({ data: { users: [] }, error: null }),
        updateUserById: async () => ({ error: null }),
        deleteUser: async () => { deletedReal = true; return { error: null }; },
      } } }),
    },
    "@/services/supabase/password-link": {
      createPasswordLinkClient: () => ({ auth: {
        signUp: async () => {
          signUps += 1;
          return { data: { user: { id: "nope", identities: [{ id: "x" }] }, session: null }, error: null };
        },
        resend: async () => {
          resends += 1;
          return { error: null };
        },
        signOut: async () => ({ error: null }),
      } }),
    },
  });
  await realService.submitSignupIdentity(resumeToken, identity);
  assert.equal(deletedReal, false);
  assert.equal(signUps, 0);
  assert.equal(resends, 0);
});

function pendingSignupRow(resumeToken: string, authUserId: string | null) {
  return {
    id: "signup-resend-pending",
    resumeTokenHash: createHash("sha256").update(resumeToken).digest("hex"),
    status: "EMAIL_PENDING" as string,
    catalogVersionId: "catalog",
    planCode: "STARTER",
    billingInterval: "MONTHLY",
    optionSelections: [],
    quoteSnapshot: {},
    email: "reuse@example.test",
    authUserId,
    emailLinkTokenHash: "hash",
    firstName: "Ada",
    lastName: "Martin",
    companyName: "Livraison Ada",
    legalName: null,
    siren: null,
    siret: null,
    phone: null,
    billingAddress: "1 rue du Test",
    billingPostalCode: "75001",
    billingCity: "Paris",
    billingCountry: "FR",
    emailVerifiedAt: null as Date | null,
    verificationEmailSentAt: null as Date | null,
    paymentConfirmedAt: null,
    activatedAt: null,
    failureCode: null as string | null,
    expiresAt: new Date(Date.now() + 60_000),
    companyId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

test("SIGNUP-1 : renvoyer un e-mail déjà confirmé sans compte TutelLiv avance l’inscription", async () => {
  const resumeToken = "resume-token-for-confirmed-orphan-resend";
  const row = pendingSignupRow(resumeToken, null);
  let resends = 0;
  const service = loadSignupService({
    "@/services/prisma/client": { prisma: {
      signupJourney: {
        findUnique: async () => row,
        findUniqueOrThrow: async () => row,
        update: async ({ data }: { data: Partial<typeof row> }) => Object.assign(row, data),
        updateMany: async ({ data }: { data: Partial<typeof row> }) => {
          Object.assign(row, data);
          return { count: 1 };
        },
      },
      user: { findFirst: async () => null, findUnique: async () => null },
    } },
    "@/services/supabase/admin": {
      createAdminClient: () => ({ auth: { admin: {
        getUserById: async () => ({ data: { user: { id: "auth-orphan", email: "reuse@example.test", email_confirmed_at: "2026-10-23T00:00:00.000Z" } }, error: null }),
        listUsers: async () => ({ data: { users: [{ id: "auth-orphan", email: "reuse@example.test", email_confirmed_at: "2026-10-23T00:00:00.000Z" }] }, error: null }),
        updateUserById: async () => ({ error: null }),
      } } }),
    },
    "@/services/supabase/password-link": {
      createPasswordLinkClient: () => ({ auth: { resend: async () => { resends += 1; return { error: null }; } } }),
    },
  });
  const result = await service.resendSignupConfirmation(resumeToken);
  assert.equal(result.verificationRequired, false);
  assert.equal(result.journey.emailVerified, true);
  assert.equal(resends, 0);
  assert.equal(row.status, "EMAIL_VERIFIED");
  assert.equal(row.authUserId, "auth-orphan");
});

test("SIGNUP-1 : un renvoi local n’impose pas localhost comme redirection Auth", async () => {
  const resumeToken = "resume-token-for-localhost-redirect";
  const row = pendingSignupRow(resumeToken, "auth-unconfirmed");
  let redirectTo: string | undefined = "unset";
  const service = loadSignupService({
    "@/lib/auth/email-links": { getPasswordLinkRedirect: () => "http://localhost:3000/reset-password" },
    "@/services/prisma/client": { prisma: {
      signupJourney: {
        findUnique: async () => row,
        findUniqueOrThrow: async () => row,
        update: async ({ data }: { data: Partial<typeof row> }) => Object.assign(row, data),
        updateMany: async ({ data }: { data: Partial<typeof row> }) => {
          Object.assign(row, data);
          return { count: 1 };
        },
      },
      user: { findFirst: async () => null, findUnique: async () => null },
    } },
    "@/services/supabase/admin": {
      createAdminClient: () => ({ auth: { admin: {
        getUserById: async () => ({ data: { user: { id: "auth-unconfirmed", email: "reuse@example.test", email_confirmed_at: null } }, error: null }),
        listUsers: async () => ({ data: { users: [] }, error: null }),
        updateUserById: async () => ({ error: null }),
      } } }),
    },
    "@/services/supabase/password-link": {
      createPasswordLinkClient: () => ({ auth: {
        resend: async (args: { options?: { emailRedirectTo?: string } }) => {
          redirectTo = args.options?.emailRedirectTo;
          return { error: null };
        },
      } }),
    },
  });
  await service.resendSignupConfirmation(resumeToken);
  assert.equal(redirectTo, undefined);
});

test("SIGNUP-1 : revenir corriger l’identité invalide l’ancien lien et conserve le brouillon", async () => {
  assert.equal(signupActionSchema.safeParse({ action: "edit-identity" }).success, true);
  const resumeToken = "resume-token-for-editing-signup-identity";
  const row = {
    id: "signup-edit-1",
    resumeTokenHash: createHash("sha256").update(resumeToken).digest("hex"),
    status: "EMAIL_PENDING",
    catalogVersionId: "catalog",
    planCode: "STARTER",
    billingInterval: "MONTHLY",
    optionSelections: [],
    quoteSnapshot: {},
    email: "edit@example.test",
    authUserId: "auth-edit-1" as string | null,
    emailLinkTokenHash: "one-time-link" as string | null,
    firstName: "Ada",
    lastName: "Martin",
    companyName: "Livraison Ada",
    legalName: null,
    siren: null,
    siret: null,
    phone: null,
    billingAddress: "1 rue du Test",
    billingPostalCode: "75001",
    billingCity: "Paris",
    billingCountry: "FR",
    emailVerifiedAt: null,
    verificationEmailSentAt: new Date() as Date | null,
    paymentConfirmedAt: null,
    activatedAt: null,
    failureCode: null,
    expiresAt: new Date(Date.now() + 60_000),
    companyId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  let deletedAuthUser: string | null = null;
  const tx = {
    $queryRaw: async () => [{ id: row.id }],
    signupJourney: {
      findUnique: async () => row,
      update: async ({ data }: { data: Partial<typeof row> }) => Object.assign(row, data),
    },
    user: { findUnique: async () => null },
  };
  const service = loadSignupService({
    "@/services/prisma/client": {
      prisma: {
        signupJourney: { findUnique: async () => row },
        $transaction: async (callback: (client: typeof tx) => unknown) => callback(tx),
      },
    },
    "@/services/supabase/admin": {
      createAdminClient: () => ({ auth: { admin: {
        getUserById: async () => ({ data: { user: { email: row.email, email_confirmed_at: null } }, error: null }),
        deleteUser: async (id: string) => { deletedAuthUser = id; return { error: null }; },
      } } }),
    },
  });
  const reopened = await service.reopenSignupIdentity(resumeToken);
  assert.equal(deletedAuthUser, "auth-edit-1");
  assert.equal(reopened.status, "DRAFT");
  assert.equal(row.authUserId, null);
  assert.equal(row.emailLinkTokenHash, null);
  assert.equal(row.verificationEmailSentAt, null);
  assert.equal(row.email, "edit@example.test");
  assert.equal(row.companyName, "Livraison Ada");
  const source = readFileSync(resolve("src/domains/signup/signup.service.ts"), "utf8");
  assert.match(source, /journey\.status !== "EMAIL_PENDING"/);

  row.status = "EMAIL_PENDING";
  row.authUserId = "auth-confirmed-orphan";
  row.emailLinkTokenHash = "confirmed-link";
  row.emailVerifiedAt = null;
  let orphanDeleted = false;
  const orphanService = loadSignupService({
    "@/services/prisma/client": {
      prisma: {
        signupJourney: { findUnique: async () => row },
        $transaction: async (callback: (client: typeof tx) => unknown) => callback(tx),
      },
    },
    "@/services/supabase/admin": {
      createAdminClient: () => ({ auth: { admin: {
        getUserById: async () => ({ data: { user: { email: row.email, email_confirmed_at: new Date().toISOString() } }, error: null }),
        deleteUser: async () => { orphanDeleted = true; return { error: null }; },
      } } }),
    },
  });
  const reopenedConfirmed = await orphanService.reopenSignupIdentity(resumeToken);
  assert.equal(orphanDeleted, true);
  assert.equal(reopenedConfirmed.status, "DRAFT");

  row.status = "EMAIL_PENDING";
  row.authUserId = "auth-confirmed-account";
  row.emailLinkTokenHash = "account-link";
  row.emailVerifiedAt = null;
  let confirmedAccountDeleted = false;
  const lockedTx = { ...tx, user: { findUnique: async () => ({ id: "user-1" }) } };
  const lockedService = loadSignupService({
    "@/services/prisma/client": {
      prisma: {
        signupJourney: { findUnique: async () => row },
        $transaction: async (callback: (client: typeof lockedTx) => unknown) => callback(lockedTx),
      },
    },
    "@/services/supabase/admin": {
      createAdminClient: () => ({ auth: { admin: {
        getUserById: async () => ({ data: { user: { email: row.email, email_confirmed_at: new Date().toISOString() } }, error: null }),
        deleteUser: async () => { confirmedAccountDeleted = true; return { error: null }; },
      } } }),
    },
  });
  await assert.rejects(() => lockedService.reopenSignupIdentity(resumeToken), /SIGNUP_EDIT_IDENTITY_LOCKED/);
  assert.equal(confirmedAccountDeleted, false);
});

test("SIGNUP-1 : une confirmation Auth déjà faite rattache le brouillon au rafraîchissement", async () => {
  const resumeToken = "resume-token-for-reconciling-confirmed-email";
  const row = {
    id: "signup-reconcile-1",
    resumeTokenHash: createHash("sha256").update(resumeToken).digest("hex"),
    status: "EMAIL_PENDING",
    catalogVersionId: "catalog",
    planCode: "STARTER",
    billingInterval: "MONTHLY",
    optionSelections: [],
    quoteSnapshot: { totalHtCents: 7900, vatCents: 1580, totalTtcCents: 9480, currency: "EUR", includedMonthlyOrders: 1000, orderOverageUnitPriceCents: 10 },
    email: "orsocarot@gmail.com",
    authUserId: "auth-already-confirmed",
    emailLinkTokenHash: "stale-link",
    firstName: "Orso",
    lastName: "Carotenuto",
    companyName: "TutelLiv Test",
    legalName: null,
    siren: null,
    siret: null,
    phone: null,
    billingAddress: "1 rue du Test",
    billingPostalCode: "75001",
    billingCity: "Paris",
    billingCountry: "FR",
    emailVerifiedAt: null as Date | null,
    verificationEmailSentAt: new Date(),
    paymentConfirmedAt: null,
    activatedAt: null,
    failureCode: null,
    expiresAt: new Date(Date.now() + 60_000),
    companyId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const service = loadSignupService({
    "@/services/prisma/client": {
      prisma: {
        signupJourney: {
          findUnique: async () => row,
          findUniqueOrThrow: async () => row,
          updateMany: async ({ data }: { data: Partial<typeof row> }) => {
            Object.assign(row, data);
            return { count: 1 };
          },
        },
      },
    },
    "@/services/supabase/admin": {
      createAdminClient: () => ({ auth: { admin: {
        getUserById: async () => ({ data: { user: { email: row.email, email_confirmed_at: new Date().toISOString() } }, error: null }),
      } } }),
    },
  });
  const reconciled = await service.getSignupJourney(resumeToken);
  assert.equal(reconciled.status, "EMAIL_VERIFIED");
  assert.equal(reconciled.emailVerified, true);
  assert.equal(row.emailLinkTokenHash, null);
});

test("SIGNUP-1 : l’offre et l’identité restent corrigeables jusqu’au paiement confirmé", async () => {
  assert.equal(signupActionSchema.safeParse({ action: "identity-details", firstName: "Ada", lastName: "Martin", email: "ada@example.test", companyName: "Livraison Ada", billingAddress: "1 rue du Test", billingPostalCode: "75001", billingCity: "Paris", billingCountry: "FR" }).success, true);
  assert.equal(signupIdentityDetailsSchema.safeParse({ action: "identity-details", firstName: "A", lastName: "Martin", email: "ada@example.test", companyName: "Livraison Ada", billingAddress: "1 rue du Test", billingPostalCode: "75001", billingCity: "Paris" }).success, false);

  const resumeToken = "resume-token-for-editing-signup-quote";
  const row = {
    id: "signup-edit-quote",
    resumeTokenHash: createHash("sha256").update(resumeToken).digest("hex"),
    status: "EMAIL_VERIFIED",
    catalogVersionId: "catalog",
    planCode: "STARTER" as const,
    billingInterval: "MONTHLY" as const,
    optionSelections: [],
    quoteSnapshot: {},
    email: "ada@example.test",
    authUserId: "auth-verified-1",
    emailLinkTokenHash: null,
    firstName: "Ada",
    lastName: "Martin",
    companyName: "Livraison Ada",
    legalName: null,
    siren: null,
    siret: null,
    phone: null,
    billingAddress: "1 rue du Test",
    billingPostalCode: "75001",
    billingCity: "Paris",
    billingCountry: "FR",
    emailVerifiedAt: new Date(),
    verificationEmailSentAt: new Date(),
    paymentConfirmedAt: null as Date | null,
    activatedAt: null as Date | null,
    failureCode: null,
    expiresAt: new Date(Date.now() + 60_000),
    companyId: null as string | null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const service = loadSignupService({
    "@/services/prisma/client": {
      prisma: {
        signupJourney: {
          findUnique: async () => row,
          update: async ({ data }: { data: Partial<typeof row> }) => Object.assign(row, data),
        },
        saasCatalogVersion: { findUnique: async () => catalog },
      },
    },
  });
  const quoted = await service.updateSignupSelection(resumeToken, { planCode: "PRO", billingInterval: "ANNUAL", optionSelections: [] });
  assert.equal(quoted.planCode, "PRO");
  assert.equal(quoted.choicesEditable, true);
  assert.equal(quoted.salesCodeApplied, false);
  // SALES-1 : le code est résolu côté serveur ; absent = inchangé, vide = retiré.
  const withCode = await service.updateSignupSelection(resumeToken, { planCode: "PRO", billingInterval: "ANNUAL", optionSelections: [], salesCode: " camiller-bbbb " });
  assert.equal(withCode.salesCodeApplied, true);
  assert.equal((row as Record<string, unknown>).salesCodeId, "sales-code-1");
  assert.equal("salesCodeId" in withCode, false, "l'identifiant interne n'est pas renvoyé");
  assert.equal((await service.updateSignupSelection(resumeToken, { planCode: "PRO", billingInterval: "MONTHLY", optionSelections: [] })).salesCodeApplied, true);
  await assert.rejects(
    () => service.updateSignupSelection(resumeToken, { planCode: "PRO", billingInterval: "MONTHLY", optionSelections: [], salesCode: "INCONNU-DDDD" }),
    /SALES_CODE_INVALID/,
  );
  assert.equal((row as Record<string, unknown>).salesCodeId, "sales-code-1", "un code refusé ne remplace rien");
  assert.equal((await service.updateSignupSelection(resumeToken, { planCode: "PRO", billingInterval: "ANNUAL", optionSelections: [], salesCode: "" })).salesCodeApplied, false);
  const renamed = await service.updateSignupIdentityDetails(resumeToken, {
    firstName: "Ada",
    lastName: "Martin",
    email: "ada@example.test",
    companyName: "Courses Ada",
    billingAddress: "12 rue du Test",
    billingPostalCode: "75002",
    billingCity: "Paris",
    billingCountry: "FR",
  });
  assert.equal(renamed.companyName, "Courses Ada");
  await assert.rejects(
    () => service.updateSignupIdentityDetails(resumeToken, {
      firstName: "Ada",
      lastName: "Martin",
      email: "autre@example.test",
      companyName: "Courses Ada",
      billingAddress: "12 rue du Test",
      billingPostalCode: "75002",
      billingCity: "Paris",
      billingCountry: "FR",
    }),
    /SIGNUP_IDENTITY_LOCKED/,
  );
  row.paymentConfirmedAt = new Date();
  row.status = "PAYMENT_CONFIRMED";
  await assert.rejects(
    () => service.updateSignupSelection(resumeToken, { planCode: "STARTER", billingInterval: "MONTHLY", optionSelections: [] }),
    /SIGNUP_SELECTION_LOCKED/,
  );
});

test("SIGNUP-1 : activation verrouillée, atomique et conditionnée par e-mail + paiement serveur", () => {
  const source = readFileSync(resolve("src/domains/signup/signup.service.ts"), "utf8");
  assert.match(source, /SELECT id FROM \"signup_journeys\" WHERE id = \$\{signupId\} FOR UPDATE/);
  assert.match(source, /!journey\.emailVerifiedAt \|\| !journey\.paymentConfirmedAt/);
  assert.match(source, /signupPaymentEvent\.findFirst/);
  assert.match(source, /status: \"CONFIRMED\"/);
  assert.match(source, /isolationLevel: Prisma\.TransactionIsolationLevel\.Serializable/);
  assert.match(source, /status: \"ACTIVATED\"/);
  assert.match(source, /if \(journey\.status === \"ACTIVATED\" && journey\.companyId\)/);
});

test("SIGNUP-1 : la bienvenue est durable, idempotente et découplée de l'activation", () => {
  const signup = readFileSync(resolve("src/domains/signup/signup.service.ts"), "utf8");
  const jobs = readFileSync(resolve("src/domains/operations/operation-job.service.ts"), "utf8");
  assert.match(signup, /jobKey: `signup-welcome:/);
  assert.match(signup, /enqueueOperationJob\(tx/);
  assert.match(signup, /kickOperationJob\(activation\.welcomeJobId\)/);
  assert.match(signup, /idempotencyKey: eventKey/);
  assert.match(jobs, /deliverSignupWelcomeEmail\(job\.payload, job\.jobKey, jobEmailReplayWindow\(job\.id\)\)/);
});

test("SIGNUP-1 : aucun ancien endpoint ni retour navigateur ne peut provisionner directement", () => {
  const legacyRoute = readFileSync(resolve("src/app/api/auth/register/route.ts"), "utf8");
  const paymentRoute = readFileSync(resolve("src/app/api/signup/payment/route.ts"), "utf8");
  const service = readFileSync(resolve("src/domains/signup/signup.service.ts"), "utf8");
  assert.match(legacyRoute, /status: 410/);
  assert.doesNotMatch(legacyRoute, /provisionCompanyAdmin/);
  assert.match(paymentRoute, /SIGNUP_PAYMENT_ADAPTER === "fake"/);
  assert.match(paymentRoute, /VERCEL_ENV !== "production"/);
  assert.match(paymentRoute, /NODE_ENV !== "production"/);
  assert.match(service, /signup_flow: "managed"/);
  assert.doesNotMatch(service, /account_type: "company"/);
  assert.doesNotMatch(service, /signup_resume_token/);
  assert.match(service, /signup_link_token: emailLinkToken/);
});

test("SIGNUP-1 : parcours mobile, reprise et progression restent visibles", () => {
  const ui = readFileSync(resolve("src/features/auth/signup-wizard.tsx"), "utf8");
  assert.match(ui, /Étape \{progress\} sur 5/);
  assert.match(ui, /fetch\("\/api\/signup", \{ cache: "no-store" \}\)/);
  assert.match(ui, /sm:grid-cols-2/);
  assert.match(ui, /J’ai confirmé, actualiser/);
  assert.match(ui, /La confirmation n’est pas encore enregistrée/);
  assert.match(ui, /SignupPlanComparisonTable/);
  assert.match(ui, /index <= currentStepIndex/);
  assert.match(ui, /Modifier l’offre/);
  assert.match(ui, /goToStage/);
  assert.match(ui, /Revoir la formule/);
  const paymentRoute = readFileSync(resolve("src/app/api/signup/payment/route.ts"), "utf8");
  assert.match(paymentRoute, /signupPaidEnvironmentPath/);
});

test("SIGNUP-1 : un jeton de reprise périmé relance une inscription au lieu de bloquer", () => {
  const route = readFileSync(resolve("src/app/api/signup/route.ts"), "utf8");
  assert.match(route, /clearSignupResumeCookie/);
  assert.match(route, /isResumeInvalid/);
  assert.match(route, /createSignupJourney\(parsed.data\)/);
});

test("SIGNUP-1 : un quota Auth 429 confirme l’e-mail via admin hors production", async () => {
  const source = readFileSync(resolve("src/domains/signup/signup.service.ts"), "utf8");
  assert.match(source, /signupFakeEmailBypassAllowed/);
  assert.match(source, /SIGNUP_PAYMENT_ADAPTER === "fake"/);
  assert.match(source, /email_confirm: true/);

  const resumeToken = "resume-token-for-auth-rate-limit-bypass";
  const row = {
    id: "signup-rate-limit-1",
    resumeTokenHash: createHash("sha256").update(resumeToken).digest("hex"),
    status: "DRAFT" as string,
    catalogVersionId: "catalog",
    planCode: "STARTER",
    billingInterval: "MONTHLY",
    optionSelections: [],
    quoteSnapshot: {},
    email: null as string | null,
    authUserId: null as string | null,
    emailLinkTokenHash: null as string | null,
    firstName: null as string | null,
    lastName: null,
    companyName: null,
    legalName: null,
    siren: null,
    siret: null,
    phone: null,
    billingAddress: null,
    billingPostalCode: null,
    billingCity: null,
    billingCountry: "FR",
    emailVerifiedAt: null as Date | null,
    verificationEmailSentAt: null as Date | null,
    paymentConfirmedAt: null,
    activatedAt: null,
    failureCode: null as string | null,
    expiresAt: new Date(Date.now() + 60_000),
    companyId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const identity = {
    firstName: "Ada",
    lastName: "Martin",
    email: "rate-limit@example.test",
    password: "Secret123",
    companyName: "Livraison Ada",
    billingAddress: "1 rue du Test",
    billingPostalCode: "75001",
    billingCity: "Paris",
    billingCountry: "FR",
  };
  const authUser = {
    id: "auth-rate-limit",
    email: "rate-limit@example.test",
    email_confirmed_at: "2026-10-23T00:00:00.000Z",
  };
  let created = false;
  const prismaMock = {
    signupJourney: {
      findUnique: async () => row,
      findUniqueOrThrow: async () => row,
      update: async ({ data }: { data: Partial<typeof row> }) => Object.assign(row, data),
      updateMany: async ({ data }: { data: Partial<typeof row> }) => {
        Object.assign(row, data);
        return { count: 1 };
      },
    },
    user: { findFirst: async () => null, findUnique: async () => null },
  };
  const service = loadSignupService({
    "@/services/prisma/client": { prisma: prismaMock },
    "@/services/supabase/admin": {
      createAdminClient: () => ({ auth: { admin: {
        getUserById: async () => ({ data: { user: authUser }, error: null }),
        listUsers: async () => ({ data: { users: [] }, error: null }),
        createUser: async () => {
          created = true;
          return { data: { user: authUser }, error: null };
        },
        updateUserById: async () => ({ data: { user: authUser }, error: null }),
      } } }),
    },
    "@/services/supabase/password-link": {
      createPasswordLinkClient: () => ({ auth: {
        signUp: async () => ({ data: { user: null, session: null }, error: { status: 429 } }),
        resend: async () => ({ error: { status: 429 } }),
        signOut: async () => ({ error: null }),
      } }),
    },
  });
  const previousVercelEnv = process.env.VERCEL_ENV;
  delete process.env.VERCEL_ENV;
  const result = await service.submitSignupIdentity(resumeToken, identity);
  assert.equal(created, true);
  assert.equal(result.verificationRequired, false);
  assert.equal(result.journey?.emailVerified, true);
  assert.equal(row.status, "EMAIL_VERIFIED");
  assert.equal(row.authUserId, "auth-rate-limit");

  process.env.VERCEL_ENV = "production";
  row.status = "DRAFT";
  row.emailVerifiedAt = null;
  row.authUserId = null;
  await assert.rejects(() => service.submitSignupIdentity(resumeToken, identity), /AUTH_RATE_LIMITED/);
  if (previousVercelEnv === undefined) delete process.env.VERCEL_ENV;
  else process.env.VERCEL_ENV = previousVercelEnv;
});

test("SIGNUP-1 : le paiement confirmé ouvre l’environnement d’offre payé", () => {
  const service = loadSignupService();
  assert.equal(service.signupPaidEnvironmentPath("alex@example.fr", true), "/onboarding");
  assert.equal(
    service.signupPaidEnvironmentPath("alex@example.fr", false),
    "/login?email=alex%40example.fr&redirect=/onboarding"
  );
  const paymentRoute = readFileSync(resolve("src/app/api/signup/payment/route.ts"), "utf8");
  assert.match(paymentRoute, /generateLink/);
  assert.match(paymentRoute, /verifyOtp/);
  assert.doesNotMatch(paymentRoute, /redirect=\/onboarding/);
});
