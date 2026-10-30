import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { NextResponse } from "next/server";

const files = [
  {
    file: "src/app/api/company/location-settings/route.ts",
    service: "@/domains/company/location-settings.service",
    read: "getCompanyLocationSettings",
    write: "updateCompanyLocationSettings",
    validation: "@/lib/validations/driver-location-settings",
    schema: "driverLocationSettingsSchema",
  },
  {
    file: "src/app/api/company/tariffs/route.ts",
    service: "@/domains/company/tariff-settings.service",
    read: "getCompanyTariffSettings",
    write: "updateCompanyTariffSettings",
    validation: "@/lib/validations/tariff-settings",
    schema: "companyTariffSettingsSchema",
  },
] as const;

function load(spec: (typeof files)[number], role: string, calls: string[]) {
  const module = { exports: {} as Record<string, (request?: Request) => Promise<Response>> };
  const source = ts.transpileModule(readFileSync(spec.file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const dependencies: Record<string, unknown> = {
    "next/server": { NextResponse },
    "@/lib/config-messages": { zodIssueMessage: (e: { issues: Array<{ message: string }> }, f: string) => e.issues[0]?.message ?? f },
    "@/lib/api/dispatch-settings-read-guard": {
      // Garde de lecture testée à part (tests/dispatcher-403-settings-read.test.ts).
      requireDispatchSettingsReader: async () => {
        calls.push("reader");
        return ["COMPANY_ADMIN", "MINI_ADMIN", "DISPATCHER"].includes(role)
          ? { context: { user: { role: { systemRole: role } } } }
          : { error: NextResponse.json({ error: "Accès refusé" }, { status: 403 }) };
      },
    },
    "@/lib/api/auth-guard": {
      requireStaffRole: async () => {
        calls.push("staff");
        return { context: { user: { role: { systemRole: role } } } };
      },
      requireRole: (context: { user: { role: { systemRole: string } } }, roles: string[]) => {
        calls.push("role");
        assert.equal([...roles].join(","), "COMPANY_ADMIN,MINI_ADMIN");
        return roles.includes(context.user.role.systemRole)
          ? null
          : NextResponse.json({ error: "Accès refusé" }, { status: 403 });
      },
      getCompanyId: () => { calls.push("company"); return "company-1"; },
    },
    [spec.service]: {
      [spec.read]: async () => { calls.push("read"); return {}; },
      [spec.write]: async () => { calls.push("write"); return {}; },
    },
    [spec.validation]: {
      [spec.schema]: { safeParse: () => { calls.push("parse"); return { success: true, data: {} }; } },
    },
  };
  runInNewContext(source, {
    Error, exports: module.exports, module,
    require: (id: string) => {
      assert.ok(id in dependencies, `Unexpected dependency ${id}`);
      return dependencies[id];
    },
  });
  return module.exports;
}

test("ADMIN-1 configuration entreprise : emplacements et tarifs refusés avant lecture", async () => {
  for (const spec of files) {
    for (const role of ["SUPER_ADMIN", "DISPATCHER"]) {
      const calls: string[] = [];
      const route = load(spec, role, calls);
      const request = new Request("http://local/api", { method: "PATCH", body: "{}" });
      const read = request.json.bind(request);
      Object.defineProperty(request, "json", { value: async () => { calls.push("body"); return read(); } });
      // DISPATCHER-403 : le dispatcher lit (assignation), n'écrit jamais ; le super-administrateur ne fait ni l'un ni l'autre.
      const reads = role === "DISPATCHER";
      assert.equal((await route.GET!()).status, reads ? 200 : 403, `${role} ${spec.file}`);
      assert.equal((await route.PATCH!(request)).status, 403);
      assert.deepEqual(calls, reads ? ["reader", "company", "read", "staff", "role"] : ["reader", "staff", "role"]);
    }
    for (const role of ["COMPANY_ADMIN", "MINI_ADMIN"]) {
      const calls: string[] = [];
      const route = load(spec, role, calls);
      assert.equal((await route.GET!()).status, 200);
      assert.equal((await route.PATCH!(new Request("http://local/api", { method: "PATCH", body: "{}" }))).status, 200);
      assert.deepEqual(calls, ["reader", "company", "read", "staff", "role", "company", "parse", "write"]);
    }
  }
});
