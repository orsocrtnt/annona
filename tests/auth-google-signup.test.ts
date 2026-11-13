/**
 * AUTH-GOOGLE (décision d'Orso du 13 novembre 2026) : inscription autonome des boulangeries (e-mail ou
 * Google), entreprise « Essai », comptes des clients et employés toujours créés par l'admin (ADM-01),
 * connexion Google sur un compte existant de même adresse, adresse inconnue refusée.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  isDisposableGoogleAccount,
  parseCallbackIntent,
  signUpCompanyWithEmail,
  signUpCompanyWithGoogle,
  unprovisionedOutcome,
  type SessionIdentity,
  type SignupAuthProvider,
  type SignUpResult,
} from "../src/domains/auth/company-signup.service";
import { shouldActivatePending } from "../src/domains/auth/auth.service";
import type { CompanyAdminDb } from "../src/domains/admin/company-admin.service";
import { loginNotice } from "../src/features/auth/login-notice";
import { googleCallbackUrl } from "../src/features/auth/google-button";
import { companySignupSchema, emailSignupSchema } from "../src/lib/validations/auth";
import type { UserWithRole } from "../src/types";
import { createMemoryDb } from "./helpers/memory-db";

type Row = Record<string, unknown>;

function fixture() {
  const tables: Record<string, Row[]> = {
    company: [{ id: "A", name: "Boulangerie A", slug: "boulangerie-a", status: "ACTIVE", cutoffTime: "17:00", timezone: "Europe/Paris", reminderLeadMinutes: 120, settings: {} }],
    role: [{ id: "rAdmin", slug: "admin", name: "Administrateur", systemRole: "ADMIN" }],
    user: [{ id: "u1", authId: "auth-u1", companyId: "A", roleId: "rAdmin", email: "deja@exemple.test", firstName: "Déjà", lastName: "Là", status: "ACTIVE" }],
    slot: [],
  };
  return { tables, db: createMemoryDb(tables) as unknown as CompanyAdminDb };
}

function fakeAuth(result: SignUpResult = { kind: "created", authId: "auth-new" }) {
  const calls: Array<{ email: string; password: string }> = [];
  const removed: string[] = [];
  const auth: SignupAuthProvider = {
    async signUp(email, password) {
      calls.push({ email, password });
      return result;
    },
    async remove(authId) {
      removed.push(authId);
    },
  };
  return { auth, calls, removed };
}

const EMAIL_INPUT = { companyName: "Fournil du Port", firstName: "Lou", lastName: "Martin", email: " Lou@Fournil.TEST ", password: "Secret123" };

test("AUTH-GOOGLE : inscription par e-mail = entreprise « Essai », trois créneaux, admin en attente du lien de confirmation", async () => {
  const { tables, db } = fixture();
  const fake = fakeAuth();
  assert.deepEqual(await signUpCompanyWithEmail(EMAIL_INPUT, { db, auth: fake.auth }), { kind: "sent" });
  assert.deepEqual(fake.calls, [{ email: "lou@fournil.test", password: "Secret123" }]);
  const company = tables.company!.find((row) => row.name === "Fournil du Port")!;
  assert.equal(company.status, "TRIAL");
  assert.equal(company.slug, "fournil-du-port");
  assert.deepEqual([company.cutoffTime, company.timezone, company.reminderLeadMinutes], ["17:00", "Europe/Paris", 120]);
  assert.equal(tables.slot!.filter((row) => row.companyId === company.id).length, 3);
  const admin = tables.user!.find((row) => row.companyId === company.id)!;
  assert.deepEqual([admin.authId, admin.email, admin.roleId, admin.status], ["auth-new", "lou@fournil.test", "rAdmin", "PENDING_VERIFICATION"]);
});

test("AUTH-GOOGLE : inscription par e-mail, même réponse si l'adresse a déjà un compte ; rien de créé ; échec en base = compte de connexion retiré", async () => {
  const { tables, db } = fixture();
  const known = fakeAuth();
  assert.deepEqual(await signUpCompanyWithEmail({ ...EMAIL_INPUT, email: "deja@exemple.test" }, { db, auth: known.auth }), { kind: "sent" });
  assert.equal(known.calls.length, 0, "aucun appel à Supabase pour une adresse déjà connue d'Annona");
  const registered = fakeAuth({ kind: "already-registered" });
  assert.deepEqual(await signUpCompanyWithEmail(EMAIL_INPUT, { db, auth: registered.auth }), { kind: "sent" });
  assert.equal(tables.company!.length, 1);
  const broken = { ...(db as unknown as Record<string, unknown>), $transaction: async () => { throw new Error("db down"); } } as unknown as CompanyAdminDb;
  const cleanup = fakeAuth();
  await assert.rejects(signUpCompanyWithEmail(EMAIL_INPUT, { db: broken, auth: cleanup.auth }), /db down/);
  assert.deepEqual(cleanup.removed, ["auth-new"]);
});

const GOOGLE: SessionIdentity = { authId: "auth-google", email: "Chef@Gmail.test", emailConfirmed: true, providers: ["google"] };

test("AUTH-GOOGLE : inscription avec Google = admin actif tout de suite, adresse de la session ; session non Google refusée", async () => {
  const { tables, db } = fixture();
  const created = await signUpCompanyWithGoogle({ companyName: "Pains de Léa", firstName: "Léa", lastName: "Roux" }, GOOGLE, { db });
  const company = tables.company!.find((row) => row.id === created.companyId)!;
  assert.equal(company.status, "TRIAL");
  const admin = tables.user!.find((row) => row.id === created.adminUserId)!;
  assert.deepEqual([admin.authId, admin.email, admin.status], ["auth-google", "chef@gmail.test", "ACTIVE"]);
  await assert.rejects(
    signUpCompanyWithGoogle({ companyName: "X", firstName: "A", lastName: "B" }, { ...GOOGLE, authId: "other", providers: ["email"] }, { db }),
    { status: 403 }
  );
  await assert.rejects(
    signUpCompanyWithGoogle({ companyName: "X", firstName: "A", lastName: "B" }, { ...GOOGLE, authId: "other", emailConfirmed: false }, { db }),
    { status: 403 }
  );
  // Une seule entreprise par personne : adresse ou compte Google déjà relié = refus, rien de créé.
  await assert.rejects(signUpCompanyWithGoogle({ companyName: "Y", firstName: "A", lastName: "B" }, GOOGLE, { db }), { status: 409 });
  await assert.rejects(
    signUpCompanyWithGoogle({ companyName: "Z", firstName: "A", lastName: "B" }, { ...GOOGLE, authId: "auth-x", email: "deja@exemple.test" }, { db }),
    { status: 409 }
  );
  assert.equal(tables.company!.length, 2);
});

test("AUTH-GOOGLE : retour de Google sans profil = étape « boulangerie » seulement pendant une inscription ; sinon refus et compte Google retiré", () => {
  assert.equal(parseCallbackIntent("signup"), "signup");
  assert.equal(parseCallbackIntent("confirm"), "confirm");
  assert.equal(parseCallbackIntent("autre"), "login");
  assert.equal(parseCallbackIntent(null), "login");
  assert.equal(unprovisionedOutcome("signup", GOOGLE), "complete-signup");
  assert.equal(unprovisionedOutcome("login", GOOGLE), "unknown");
  assert.equal(unprovisionedOutcome("signup", { ...GOOGLE, providers: ["email"] }), "unknown");
  assert.equal(unprovisionedOutcome("signup", { ...GOOGLE, emailConfirmed: false }), "unknown");
  assert.equal(isDisposableGoogleAccount(GOOGLE), true);
  assert.equal(isDisposableGoogleAccount({ ...GOOGLE, providers: ["email", "google"] }), false);
  assert.equal(isDisposableGoogleAccount({ ...GOOGLE, providers: [] }), false);
});

function profile(status: string, companyStatus = "ACTIVE"): UserWithRole {
  return {
    id: "u", companyId: "A", status,
    company: { id: "A", status: companyStatus },
    role: { systemRole: "MERCHANT" },
  } as unknown as UserWithRole;
}

test("AUTH-GOOGLE : un compte « en attente » devient actif quand l'adresse est prouvée, jamais si l'entreprise est indisponible", () => {
  assert.equal(shouldActivatePending(profile("PENDING_VERIFICATION"), true), true);
  assert.equal(shouldActivatePending(profile("PENDING_VERIFICATION", "TRIAL"), true), true);
  assert.equal(shouldActivatePending(profile("PENDING_VERIFICATION"), false), false);
  assert.equal(shouldActivatePending(profile("PENDING_VERIFICATION", "SUSPENDED"), true), false);
  assert.equal(shouldActivatePending(profile("INACTIVE"), true), false);
  assert.equal(shouldActivatePending(profile("ACTIVE"), true), false);
});

test("AUTH-GOOGLE : formulaire minimal ; mot de passe solide ; champs inconnus refusés", () => {
  assert.equal(emailSignupSchema.safeParse(EMAIL_INPUT).success, true);
  assert.equal(emailSignupSchema.safeParse({ ...EMAIL_INPUT, password: "faible" }).success, false);
  assert.equal(emailSignupSchema.safeParse({ ...EMAIL_INPUT, password: "toutminuscule1" }).success, false);
  assert.equal(emailSignupSchema.safeParse({ ...EMAIL_INPUT, companyName: "  " }).success, false);
  assert.equal(emailSignupSchema.safeParse({ ...EMAIL_INPUT, role: "SUPER_ADMIN" }).success, false);
  assert.equal(companySignupSchema.safeParse({ companyName: "B", firstName: "A", lastName: "C", email: "x@y.z" }).success, false);
});

test("AUTH-GOOGLE : messages de la page de connexion au retour de Google ou d'un lien", () => {
  const params = (query: string) => new URLSearchParams(query);
  assert.equal(loginNotice(params("google=inconnu"))?.signupLink, true);
  assert.match(loginNotice(params("google=inconnu"))!.message, /administrateur doit d'abord créer votre compte/);
  assert.equal(loginNotice(params("google=annule"))?.variant, "info");
  assert.equal(loginNotice(params("confirmation=lien"))?.variant, "info");
  assert.equal(loginNotice(params("google=<script>")), null);
  assert.equal(loginNotice(params("")), null);
  assert.equal(googleCallbackUrl("http://localhost:3000", "signup"), "http://localhost:3000/auth/callback?intent=signup");
});

test("AUTH-GOOGLE : le bouton Google est masqué dans les applications natives et sans réglage ; le retour ne lit jamais les métadonnées pour créer un profil", () => {
  const button = readFileSync("src/features/auth/google-button.tsx", "utf8");
  assert.match(button, /isGoogleAuthEnabled\(\) && !isNativeApp\(\)/);
  assert.match(button, /NEXT_PUBLIC_GOOGLE_AUTH === "on"/);
  const callback = readFileSync("src/app/auth/callback/route.ts", "utf8");
  assert.doesNotMatch(callback, /user_metadata/);
  assert.doesNotMatch(callback, /insertCompanyWithAdmin|signUpCompanyWith/);
  // L'inscription avec Google relit l'adresse dans la session, jamais dans la requête.
  const googleRoute = readFileSync("src/app/api/auth/signup/google/route.ts", "utf8");
  assert.match(googleRoute, /supabase\.auth\.getUser\(\)/);
  assert.match(googleRoute, /companySignupSchema/);
});
