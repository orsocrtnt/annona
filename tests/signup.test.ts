import assert from "node:assert/strict";
import test from "node:test";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { Prisma } from "@prisma/client";
import { signupIdentitySchema } from "../src/lib/validations/signup";

function loadSignupService() {
  const module = { exports: {} };
  const dependencies: Record<string, unknown> = {
    "server-only": {},
    "node:crypto": { createHash, randomBytes, timingSafeEqual },
    "@prisma/client": { Prisma },
    "@/services/prisma/client": { prisma: {} },
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
  };
  const source = ts.transpileModule(readFileSync(resolve("src/domains/signup/signup.service.ts"), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  runInNewContext(source, { Buffer, Date, Error, Map, Set, JSON, Math, console, exports: module.exports, module, require: (id: string) => {
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
  const migration = readFileSync(resolve("prisma/migrations/20261022130000_signup_autonomous/migration.sql"), "utf8");
  assert.doesNotMatch(migration, /password/i);
  assert.match(migration, /ENABLE ROW LEVEL SECURITY/g);
  assert.match(migration, /REVOKE ALL PRIVILEGES/);
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
  assert.match(jobs, /deliverSignupWelcomeEmail\(job\.payload, job\.jobKey\)/);
});

test("SIGNUP-1 : aucun ancien endpoint ni retour navigateur ne peut provisionner directement", () => {
  const legacyRoute = readFileSync(resolve("src/app/api/auth/register/route.ts"), "utf8");
  const paymentRoute = readFileSync(resolve("src/app/api/signup/payment/route.ts"), "utf8");
  const service = readFileSync(resolve("src/domains/signup/signup.service.ts"), "utf8");
  assert.match(legacyRoute, /status: 410/);
  assert.doesNotMatch(legacyRoute, /provisionCompanyAdmin/);
  assert.match(paymentRoute, /SIGNUP_PAYMENT_ADAPTER === "fake"/);
  assert.match(paymentRoute, /VERCEL_ENV !== "production"/);
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
  const paymentRoute = readFileSync(resolve("src/app/api/signup/payment/route.ts"), "utf8");
  assert.match(paymentRoute, /redirect=\/onboarding/);
});
