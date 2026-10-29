import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { z } from "zod";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { onboardingPreferenceSchema, onboardingCompanyProfileSchema } from "../src/domains/onboarding/onboarding.service";

function load(file: string, dependencies: Record<string, unknown>) {
  const module = { exports: {} as Record<string, (...args: never[]) => Promise<unknown>> };
  const source = ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  runInNewContext(source, { Error, Date, exports: module.exports, module, require: (id: string) => {
    assert.ok(id in dependencies, `Unexpected dependency ${id}`); return dependencies[id];
  } });
  return module.exports;
}

test("ONBOARD-1 : API réelle, société du serveur, entrées strictes et refus des autres rôles", async () => {
  let actor = "COMPANY_ADMIN";
  let permitted = true;
  let canMutate = true;
  let companyId: string | null = "company-a";
  const writes: string[] = [];
  const route = load("src/app/api/onboarding/route.ts", {
    "zod": { z },
    "next/server": { NextResponse },
    "@/lib/api/auth-guard": {
      requireStaffRole: async (permission: string) => {
        assert.equal(permission, "settings:update");
        return permitted ? { context: { companyId, role: actor } } : { error: NextResponse.json({}, { status: 403 }) };
      },
      requireRole: (context: { role: string }, roles: string[]) => roles.includes(context.role) ? null : NextResponse.json({}, { status: 403 }),
      getCompanyId: (context: { companyId: string | null }) => context.companyId,
    },
    "@/domains/saas/saas.service": { resolveCompanySaasAccess: async () => ({ canMutate }) },
    "@/domains/onboarding/onboarding.service": {
      onboardingPreferenceSchema,
      onboardingCompanyProfileSchema,
      updateOnboardingCompanyProfile: async (id: string) => { writes.push(id); },
      updateOnboardingPreference: async (id: string) => { writes.push(id); },
      getCompanyOnboardingStatus: async (id: string) => ({ companyName: id }),
    },
  });
  const patch = route.PATCH as unknown as (request: Request) => Promise<Response>;
  const request = (body: unknown = { step: "collaborators", skipped: true }) => new Request("http://localhost/api/onboarding", { method: "PATCH", body: JSON.stringify(body) });
  for (const role of ["CLIENT", "DRIVER", "DISPATCHER", "MINI_ADMIN", "SUPER_ADMIN"]) {
    actor = role; assert.equal((await patch(request())).status, 403);
  }
  actor = "COMPANY_ADMIN"; permitted = false;
  assert.equal((await patch(request())).status, 403);
  permitted = true; companyId = null;
  assert.equal((await patch(request())).status, 400);
  companyId = "company-a";
  for (const body of [{ step: "firstOrder", skipped: true }, { step: "collaborators", skipped: true, companyId: "company-b" }, { step: "collaborators", skipped: "yes" }]) {
    assert.equal((await patch(request(body))).status, 400);
  }
  assert.equal((await patch(new Request("http://local", { method: "PATCH", body: "invalid" }))).status, 400);
  assert.equal(writes.length, 0);
  assert.equal((await patch(request())).status, 200);
  assert.deepEqual(writes, ["company-a"]);
  const profile = { name: "Pilote", email: "contact@example.test", phone: "", address: "1 rue du Test", city: "Paris", country: "FR" };
  assert.equal((await patch(request({ step: "company", profile }))).status, 200);
  canMutate = false;
  for (const body of [{ step: "company", profile }, { step: "collaborators", skipped: true }]) {
    assert.equal((await patch(request(body))).status, 403);
  }
  assert.deepEqual(writes, ["company-a", "company-a"]);
});

function invitations(options: { roleSlug?: "client" | "driver" | "dispatcher"; existing?: object; providerError?: { message: string; status?: number }; profileFails?: boolean; seatFails?: boolean } = {}) {
  const events: string[] = [];
  const roleSlug = options.roleSlug ?? "client";
  const role = { id: "role", name: roleSlug, slug: roleSlug, system_role: roleSlug.toUpperCase() };
  const provider = { id: "new-auth" };
  const prisma = {
    $queryRaw: async () => [role],
    user: { findUnique: async () => options.existing ?? null },
    $transaction: async (callback: (tx: unknown) => Promise<unknown>) => callback({ user: { create: async (args: { data: { status: string; companyId: string } }) => {
      events.push("profile");
      assert.equal(args.data.companyId, "company-a");
      assert.equal(args.data.status, "PENDING_VERIFICATION");
      if (options.profileFails) throw new Error("db down");
      return { id: "new-user", ...args.data };
    } } }),
  };
  const service = load("src/domains/user/user.service.ts", {
    "node:crypto": { randomUUID: () => "reservation-id" }, "@prisma/client": { Prisma },
    "@/services/prisma/client": { prisma },
    "@/services/supabase/admin": { createAdminClient: () => ({ auth: { admin: { inviteUserByEmail: async () => {
      events.push("invite"); return { data: { user: options.providerError ? null : provider }, error: options.providerError };
    } } } }) },
    "@/domains/client-portal/client-data.service": { linkPortalDataToClient: async () => { events.push("link"); } },
    "@/lib/query/list-limits": {},
    "@/lib/database/claimed-settings-update": { settingsSection: () => () => null }, "@/lib/database/settings-claims": { updateUserSettingsWithClaim: async () => "saved" },
    "@/lib/permissions/mini-admin": { canManageMiniAdmins: () => true },
    "@/lib/auth/email-links": { getPasswordLinkRedirect: () => "http://localhost/reset-password" },
    "@/lib/demo/constants": {},
    "@/domains/saas/saas.service": {
      reserveSaasSeat: async () => { events.push("reserve"); if (options.seatFails) throw new Error("SAAS_ACCOUNT_READ_ONLY"); return "seat"; },
      releaseSaasSeat: async () => { events.push("release"); },
    },
  });
  const create = service.createUserByAdmin as unknown as (input: unknown, companyId: string, actor: string) => Promise<{ invitationSent: boolean }>;
  return { events, create: () => create({ email: "new@example.test", firstName: "Test", lastName: "Pilote", roleSlug }, "company-a", "COMPANY_ADMIN") };
}

test("ONBOARD-1 : un nouveau compte est invité une seule fois et reste en attente", async () => {
  for (const roleSlug of ["client", "driver", "dispatcher"] as const) {
    const fixture = invitations({ roleSlug });
    assert.equal((await fixture.create()).invitationSent, true);
    assert.deepEqual(fixture.events, ["reserve", "invite", "profile", "release", ...(roleSlug === "client" ? ["link"] : [])]);
  }
});

test("ONBOARD-1 : compte actif, en attente ou d’une autre société, aucun transfert ni nouvel envoi", async () => {
  for (const status of ["ACTIVE", "PENDING_VERIFICATION"]) {
    for (const companyId of ["company-a", "company-b"]) {
      const fixture = invitations({ existing: { id: "existing", status, companyId } });
      await assert.rejects(fixture.create(), /EMAIL_EXISTS/);
      assert.deepEqual(fixture.events, []);
    }
  }
});

test("ONBOARD-1 : e-mail déjà connu du fournisseur et panne ne créent aucun profil", async () => {
  for (const [providerError, message] of [
    [{ message: "already registered" }, "EMAIL_EXISTS"],
    [{ message: "rate limited", status: 429 }, "AUTH_RATE_LIMITED"],
    [{ message: "unavailable", status: 503 }, "INVITATION_FAILED"],
  ] as const) {
    const fixture = invitations({ providerError });
    await assert.rejects(fixture.create(), new RegExp(message));
    assert.deepEqual(fixture.events, ["reserve", "invite", "release"]);
  }
});

test("ONBOARD-1 : échec profil libère la place ; droits SaaS refusés avant tout envoi", async () => {
  const profile = invitations({ profileFails: true });
  await assert.rejects(profile.create(), /INVITATION_PROFILE_FAILED/);
  assert.deepEqual(profile.events, ["reserve", "invite", "profile", "release"]);
  const denied = invitations({ seatFails: true });
  await assert.rejects(denied.create(), /SAAS_ACCOUNT_READ_ONLY/);
  assert.deepEqual(denied.events, ["reserve"]);
});
