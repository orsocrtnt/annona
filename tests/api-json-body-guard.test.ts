import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

// RECETTE-2810 point 17 : un corps JSON invalide doit répondre 400 (jamais 500). Toute lecture directe
// de `request.json()` doit donc absorber l'échec d'analyse, la validation Zod produisant ensuite le 400.
function routeFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? routeFiles(path) : name === "route.ts" ? [path] : [];
  });
}

test("aucune route API ne lit request.json() sans protection", () => {
  const offenders = routeFiles(join(process.cwd(), "src/app/api")).filter((file) =>
    /(?<!NextResponse)\.json\(\)(?!\.catch)/.test(readFileSync(file, "utf8"))
  );
  assert.deepEqual(offenders, []);
});

test("PATCH /api/company/dispatch répond 400 (et n'écrit rien) sur un JSON invalide", async () => {
  const { readFileSync: read } = await import("node:fs");
  const { runInNewContext } = await import("node:vm");
  const ts = (await import("typescript")).default;
  const { NextResponse } = await import("next/server");
  const { companyDispatchSettingsSchema } = await import("../src/lib/validations/dispatch-settings");
  const writes: string[] = [];
  const module = { exports: {} as Record<string, (request: Request) => Promise<Response>> };
  const source = ts.transpileModule(read("src/app/api/company/dispatch/route.ts", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const dependencies: Record<string, unknown> = {
    "next/server": { NextResponse },
    "@/lib/api/auth-guard": {
      requireStaffRole: async () => ({ context: { user: { role: { systemRole: "COMPANY_ADMIN" } } } }),
      requireRole: () => null,
      getCompanyId: () => "company-1",
    },
    "@/domains/company/dispatch-settings.service": {
      getCompanyDispatchSettings: async () => ({}),
      updateCompanyDispatchSettings: async () => { writes.push("write"); return {}; },
    },
    "@/lib/validations/dispatch-settings": { companyDispatchSettingsSchema },
  };
  runInNewContext(source, { Error, exports: module.exports, module, require: (id: string) => dependencies[id] });
  for (const body of ["{pas du json", "", "null"]) {
    const response = await module.exports.PATCH!(new Request("http://local/api/company/dispatch", { method: "PATCH", body }));
    assert.equal(response.status, 400, `corps ${JSON.stringify(body)}`);
  }
  assert.deepEqual(writes, []);
});

test("non authentifié + JSON invalide sur dispatch : 401 avant tout 400", async () => {
  const { readFileSync: read } = await import("node:fs");
  const { runInNewContext } = await import("node:vm");
  const ts = (await import("typescript")).default;
  const { NextResponse } = await import("next/server");
  const module = { exports: {} as Record<string, (request: Request) => Promise<Response>> };
  const source = ts.transpileModule(read("src/app/api/company/dispatch/route.ts", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const dependencies: Record<string, unknown> = {
    "next/server": { NextResponse },
    "@/lib/api/auth-guard": {
      requireStaffRole: async () => ({ error: NextResponse.json({ error: "Non authentifié" }, { status: 401 }) }),
      requireRole: () => null,
      getCompanyId: () => "c",
    },
    "@/domains/company/dispatch-settings.service": {},
    "@/lib/validations/dispatch-settings": {},
  };
  runInNewContext(source, { Error, exports: module.exports, module, require: (id: string) => dependencies[id] });
  const response = await module.exports.PATCH!(new Request("http://local/api/company/dispatch", { method: "PATCH", body: "{pas du json" }));
  assert.equal(response.status, 401);
});
