import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { NextResponse } from "next/server";

function load(allowed: boolean, calls: string[], fail?: string) {
  const module = { exports: {} as { GET?: () => Promise<Response> } };
  const source = ts.transpileModule(readFileSync("src/app/api/admin/saas-health/route.ts", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const dependencies: Record<string, unknown> = {
    "next/server": { NextResponse },
    "@/lib/api/auth-guard": {
      requireStaffRole: async (permission: string) => {
        calls.push(`staff:${permission}`);
        return allowed ? { context: {} } : { error: NextResponse.json({ error: "Accès refusé" }, { status: 403 }) };
      },
      requireRole: () => null,
    },
    "@/lib/api/platform-access": { gatePlatformRead: async (_context: unknown, denied: Response | null) => denied },
    "@/domains/admin/saas-health.service": {
      getSaasHealthIndicators: async () => {
        calls.push("health");
        if (fail) throw new Error(fail);
        return { period: { startsAt: "2026-10-01T00:00:00.000Z" } };
      },
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

test("ADMIN-1 santé SaaS : refus avant lecture, succès sans cache et erreur générique", async () => {
  const denied: string[] = [];
  const refused = await load(false, denied).GET!();
  assert.equal(refused.status, 403);
  assert.deepEqual(denied, ["staff:dashboard:admin"]);

  const successCalls: string[] = [];
  const success = await load(true, successCalls).GET!();
  assert.equal(success.status, 200);
  assert.equal(success.headers.get("Cache-Control"), "no-store");
  assert.equal((await success.json()).data.period.startsAt, "2026-10-01T00:00:00.000Z");
  assert.deepEqual(successCalls, ["staff:dashboard:admin", "health"]);

  const failed = await load(true, [], "secret-tenant").GET!();
  assert.equal(failed.status, 500);
  assert.equal(failed.headers.get("Cache-Control"), "no-store");
  const body = await failed.json();
  assert.equal(body.error, "Indicateurs SaaS indisponibles.");
  assert.equal(JSON.stringify(body).includes("secret-tenant"), false);
});

test("ADMIN-1 santé SaaS : les deux lectures de /admin restent indépendantes", () => {
  const page = readFileSync("src/app/(back-office)/admin/page.tsx", "utf8");
  const overview = page.split("function OverviewPanel")[1]?.split("function SaasHealthPanel")[0] ?? "";
  const saas = page.split("function SaasHealthPanel")[1]?.split("export default function")[0] ?? "";
  const main = page.split("export default function")[1] ?? "";
  assert.equal(overview.includes("useAdminOverview"), true);
  assert.equal(overview.includes("useAdminSaasHealth"), false);
  assert.equal(saas.includes("useAdminSaasHealth"), true);
  assert.equal(saas.includes("useAdminOverview"), false);
  assert.equal(main.includes("<OverviewPanel />") && main.includes("<SaasHealthPanel />"), true);
  assert.equal(main.includes("PageSkeleton"), false);

  const hook = readFileSync("src/features/admin/hooks.ts", "utf8").split("export function useAdminSaasHealth")[1]?.split("export function")[0] ?? "";
  assert.equal(hook.includes("refetchInterval"), false);
  assert.equal(hook.includes('["admin", "saas-health"]'), true);
  assert.equal(readFileSync("src/features/admin/api.ts", "utf8").includes('fetch("/api/admin/saas-health", { cache: "no-store" })'), true);
  assert.equal(readFileSync("src/domains/admin/platform.service.ts", "utf8").includes("getSaasHealthIndicators"), false);
});
