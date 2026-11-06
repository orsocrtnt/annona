import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { NextResponse } from "next/server";

type Guard = { requireDispatchSettingsReader: () => Promise<{ context?: unknown; error?: Response }> };

function loadGuard(role: string, permissions: string[], staffAllowed = true): Guard {
  const module = { exports: {} as Guard };
  const source = ts.transpileModule(readFileSync("src/lib/api/dispatch-settings-read-guard.ts", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const dependencies: Record<string, unknown> = {
    "next/server": { NextResponse },
    "@/lib/api/auth-guard": {
      requireStaffRole: async (required: string[]) => {
        // Même règle que requireAuth : au moins une des permissions demandées.
        assert.equal([...required].join(","), "settings:read,deliveries:dispatch");
        if (!staffAllowed || !required.some((permission) => permissions.includes(permission))) {
          return { error: NextResponse.json({ error: "Accès refusé" }, { status: 403 }) };
        }
        return { context: { user: { role: { systemRole: role } }, permissions } };
      },
      requireRole: (context: { user: { role: { systemRole: string } } }, roles: string[]) =>
        roles.includes(context.user.role.systemRole) ? null : NextResponse.json({ error: "Accès refusé" }, { status: 403 }),
    },
  };
  runInNewContext(source, { exports: module.exports, module, require: (id: string) => dependencies[id] });
  return module.exports;
}

const allowed = async (role: string, permissions: string[], staff = true) =>
  !("error" in (await loadGuard(role, permissions, staff).requireDispatchSettingsReader()));

test("DISPATCHER-403 : lecture des réglages d'assignation ouverte au dispatcher, rien d'autre", async () => {
  assert.equal(await allowed("DISPATCHER", ["deliveries:dispatch", "orders:read"]), true);
  assert.equal(await allowed("DISPATCHER", ["orders:read"]), false, "dispatcher sans droit d'assignation");
  assert.equal(await allowed("DISPATCHER", ["settings:read"]), false, "settings:read seul ne suffit pas au dispatcher");
  assert.equal(await allowed("COMPANY_ADMIN", ["settings:read", "settings:update"]), true);
  assert.equal(await allowed("MINI_ADMIN", ["settings:read"]), true);
  assert.equal(await allowed("MINI_ADMIN", ["deliveries:dispatch"]), false, "mini-admin : settings:read exigé");
  assert.equal(await allowed("SUPER_ADMIN", ["settings:read", "deliveries:dispatch"]), false);
  assert.equal(await allowed("DRIVER", ["deliveries:dispatch"], false), false);
});

test("DISPATCHER-403 : les deux routes lisent avec la garde et écrivent toujours avec settings:update", () => {
  for (const route of ["dispatch", "location-settings"]) {
    const source = readFileSync(`src/app/api/company/${route}/route.ts`, "utf8");
    const get = source.slice(source.indexOf("export async function GET"), source.indexOf("export async function PATCH"));
    const patch = source.slice(source.indexOf("export async function PATCH"));
    assert.match(get, /requireDispatchSettingsReader\(\)/, route);
    assert.match(patch, /requireStaffRole\("settings:update"\)/, route);
    assert.match(patch, /requireRole\(auth\.context, \["COMPANY_ADMIN", "MINI_ADMIN"\]\)/, route);
  }
});
