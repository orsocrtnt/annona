import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { NextResponse } from "next/server";
import { getPortalShowDriverPhone, readPortalShowDriverPhone, updatePortalShowDriverPhone } from "../src/domains/company/portal-settings.service";
import { portalSettingsPatchSchema } from "../src/lib/validations/portal-settings";
import { clientDriverFirstName, redactClientTimeline } from "../src/domains/delivery/client-driver";
import { prisma } from "../src/services/prisma/client";

function stub(t: import("node:test").TestContext, delegate: object, key: string, fn: unknown) {
  const target = delegate as Record<string, unknown>;
  const original = target[key];
  target[key] = fn;
  t.after(() => { target[key] = original; });
}

function companyStore(t: import("node:test").TestContext, settings: unknown) {
  const row = { settings, updatedAt: new Date("2026-10-29T08:00:00Z") };
  const claims: Array<Date> = [];
  stub(t, prisma.company, "findUnique", async () => ({ ...row }));
  stub(t, prisma.company, "updateMany", async (args: { where: { updatedAt: Date }; data: { settings: unknown; updatedAt: Date } }) => {
    claims.push(args.where.updatedAt);
    if (args.where.updatedAt.getTime() !== row.updatedAt.getTime()) return { count: 0 };
    row.settings = args.data.settings;
    row.updatedAt = args.data.updatedAt;
    return { count: 1 };
  });
  return { row, claims };
}

test("I2 réglage : activé par défaut, lu depuis Company.settings", async (t) => {
  assert.equal(readPortalShowDriverPhone(undefined), true);
  assert.equal(readPortalShowDriverPhone({}), true);
  assert.equal(readPortalShowDriverPhone({ portalShowDriverPhone: "non" }), true, "valeur invalide → défaut");
  assert.equal(readPortalShowDriverPhone({ portalShowDriverPhone: false }), false);
  companyStore(t, { portalShowDriverPhone: false });
  assert.equal(await getPortalShowDriverPhone("company-a"), false);
});

test("I2 réglage : l'écriture passe par la réclamation et n'écrase pas les autres réglages", async (t) => {
  const others = { dispatch: { radius: 12 }, proofRules: { photo: true }, billing: { courier: { base: 5 } }, deliveryCategories: { STANDARD: true } };
  const store = companyStore(t, { ...others });
  assert.equal(await updatePortalShowDriverPhone("company-a", false), false);
  assert.deepEqual(store.row.settings, { ...others, portalShowDriverPhone: false });
  assert.equal(store.claims.length, 1);
  assert.equal(await updatePortalShowDriverPhone("company-a", true), true);
  assert.deepEqual(store.row.settings, { ...others, portalShowDriverPhone: true });
  stub(t, prisma.company, "findUnique", async () => null);
  await assert.rejects(updatePortalShowDriverPhone("company-z", true), /COMPANY_NOT_FOUND/);
});

test("I2 réglage : le schéma n'accepte que le booléen", () => {
  assert.equal(portalSettingsPatchSchema.safeParse({ portalShowDriverPhone: false }).success, true);
  assert.equal(portalSettingsPatchSchema.safeParse({ portalShowDriverPhone: "false" }).success, false);
  assert.equal(portalSettingsPatchSchema.safeParse({ portalShowDriverPhone: true, billing: {} }).success, false, "aucune autre clé");
  assert.equal(portalSettingsPatchSchema.safeParse({}).success, false);
});

function loadRoute(role: string, calls: string[]) {
  const module = { exports: {} as Record<string, (request?: Request) => Promise<Response>> };
  const source = ts.transpileModule(readFileSync("src/app/api/company/portal-settings/route.ts", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const deps: Record<string, unknown> = {
    "next/server": { NextResponse },
    "@/lib/api/auth-guard": {
      requireStaffRole: async (permission: string) => {
        calls.push(`perm:${permission}`);
        return role === "CLIENT" || role === "DRIVER"
          ? { error: NextResponse.json({ error: "Accès refusé" }, { status: 403 }) }
          : { context: { user: { companyId: "company-a", role: { systemRole: role } } } };
      },
      requireRole: (context: { user: { role: { systemRole: string } } }, roles: string[]) =>
        roles.includes(context.user.role.systemRole) ? null : NextResponse.json({ error: "Accès refusé" }, { status: 403 }),
      getCompanyId: (context: { user: { companyId: string } }) => context.user.companyId,
    },
    "@/domains/company/portal-settings.service": {
      getPortalShowDriverPhone: async () => { calls.push("read"); return true; },
      updatePortalShowDriverPhone: async (_id: string, value: boolean) => { calls.push(`write:${value}`); return value; },
    },
    "@/lib/validations/portal-settings": { portalSettingsPatchSchema },
  };
  runInNewContext(source, { Error, exports: module.exports, module, require: (id: string) => { assert.ok(id in deps, `dépendance inattendue ${id}`); return deps[id]; } });
  return module.exports;
}
const patch = (body: unknown) => new Request("http://local/api/company/portal-settings", { method: "PATCH", body: JSON.stringify(body) });

test("I2 réglage : un rôle sans droit est refusé avant toute lecture ou écriture", async () => {
  for (const role of ["CLIENT", "DRIVER", "DISPATCHER", "SUPER_ADMIN"]) {
    const calls: string[] = [];
    const route = loadRoute(role, calls);
    assert.equal((await route.GET!()).status, 403, role);
    assert.equal((await route.PATCH!(patch({ portalShowDriverPhone: false }))).status, 403, role);
    assert.equal(calls.some((call) => call === "read" || call.startsWith("write")), false, role);
  }
});

test("I2 réglage : l'administrateur de l'entreprise lit et modifie, corps invalide refusé", async () => {
  for (const role of ["COMPANY_ADMIN", "MINI_ADMIN"]) {
    const calls: string[] = [];
    const route = loadRoute(role, calls);
    assert.equal((await route.GET!()).status, 200);
    const ok = await route.PATCH!(patch({ portalShowDriverPhone: false }));
    assert.equal(ok.status, 200);
    assert.deepEqual((await ok.json()).data, { portalShowDriverPhone: false });
    assert.equal((await route.PATCH!(patch({ portalShowDriverPhone: "x" }))).status, 400);
    assert.ok(calls.includes("perm:settings:update") && calls.includes("write:false"));
    assert.equal(calls.filter((c) => c.startsWith("write")).length, 1);
  }
});

test("I2 client : prénom seul depuis la relation ou le nom stocké", () => {
  assert.equal(clientDriverFirstName({ firstName: "Karim" }, "Livreur Karim Benali"), "Karim");
  assert.equal(clientDriverFirstName(null, "Livreur Karim Benali"), "Karim");
  assert.equal(clientDriverFirstName(null, "Karim Benali"), "Karim");
  assert.equal(clientDriverFirstName(null, null), null);
  assert.equal(clientDriverFirstName(null, "  "), null);
});

test("I2 client : la chronologie ne montre plus de nom de livreur", () => {
  const at = new Date("2026-10-29T08:00:00Z");
  const events = [
    { id: "1", label: "Livreur réassigné", description: "Livreur Karim Benali → Livreur Awa Diallo", occurredAt: at },
    { id: "2", label: "Livreur retiré", description: "Livreur Karim Benali retiré avant le démarrage — panne", occurredAt: at },
    { id: "3", label: "Prise en charge confirmée", description: "Karim Benali a confirmé la prise en charge, avant le départ.", occurredAt: at },
    { id: "4", label: "Annulée", description: "Commande annulée avant le départ — livreur précédemment assigné : Karim Benali", occurredAt: at },
    { id: "5", label: "En route", description: "Le livreur est en route", occurredAt: at },
  ];
  const safe = redactClientTimeline(events);
  assert.equal(JSON.stringify(safe).includes("Benali"), false);
  assert.equal(JSON.stringify(safe).includes("Diallo"), false);
  assert.equal(safe.find((event) => event.id === "5")?.description, "Le livreur est en route", "événement neutre inchangé");
  assert.equal(safe.length, events.length, "aucun événement supprimé");
});
