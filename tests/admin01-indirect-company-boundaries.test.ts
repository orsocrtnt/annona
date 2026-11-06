import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { NextResponse } from "next/server";

const inventoryPath = "docs/operations/admin01/tenant-api-boundaries.md";
const roles = ["SUPER_ADMIN", "ADMIN", "BAKER", "DRIVER", "MERCHANT"];
const supportRoles = ["ADMIN"];

function requireRoleFrom(source: string, expected: string[]) {
  const match = source.match(/requireRole\(auth\.context, \[([^\]]*)\]\)/);
  assert.ok(match);
  const declared = [...(match[1] ?? "").matchAll(/"([^"]+)"/g)].map((item) => item[1]);
  assert.deepEqual(declared, expected);
  return (context: { user: { role: { systemRole: string } } }, called: string[]) => {
    assert.equal([...called].join(","), expected.join(","));
    return expected.includes(context.user.role.systemRole)
      ? null
      : NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  };
}

function functionBodies(source: string) {
  const bodies = new Map<string, string>();
  for (const match of source.matchAll(/async function (\w+)\(/g)) {
    const start = source.indexOf("{", match.index ?? 0);
    let depth = 0;
    for (let index = start; index < source.length; index += 1) {
      if (source[index] === "{") depth += 1;
      else if (source[index] === "}") {
        depth -= 1;
        if (depth === 0) {
          bodies.set(match[1] ?? "", source.slice(start, index));
          break;
        }
      }
    }
  }
  return bodies;
}

function guardsIn(scan: string) {
  const guards: string[] = [];
  if (/\borderActorAuth\s*\(/.test(scan)) guards.push("orderActorAuth");
  if (/\brequireSupportStaff\s*\(/.test(scan)) guards.push("requireSupportStaff");
  return guards;
}

function discover() {
  const rows: Array<{ file: string; method: string; guard: string }> = [];
  const files = readdirSync("src/app/api", { recursive: true })
    .map((entry) => entry.toString().split("\\").join("/"))
    .filter((entry) => entry.endsWith("route.ts"))
    .sort();
  for (const file of files) {
    const source = readFileSync(join("src/app/api", file), "utf8");
    const helpers = functionBodies(source);
    const parts = source.split(/export async function (GET|POST|PATCH|PUT|DELETE)/);
    for (let index = 1; index < parts.length; index += 2) {
      const method = parts[index] ?? "";
      const body = parts[index + 1] ?? "";
      let scan = body;
      if (guardsIn(body).length === 0) {
        for (const [name, helper] of helpers) {
          if (new RegExp(`\\b${name}\\s*\\(`).test(body)) scan += `\n${helper}`;
        }
      }
      for (const guard of guardsIn(scan)) {
        rows.push({ file: `src/app/api/${file}`, method, guard });
      }
    }
  }
  return rows;
}

function documented() {
  const source = readFileSync(inventoryPath, "utf8");
  const block = source.split("<!-- INDIRECT_COMPANY_BOUNDARIES_START -->")[1]?.split("<!-- INDIRECT_COMPANY_BOUNDARIES_END -->")[0] ?? "";
  return block.split("\n").flatMap((line) => {
    if (!line.startsWith("| src/")) return [];
    const [file, method, guard] = line.split("|").slice(1, 4).map((cell) => cell.trim());
    return [{ file, method, guard }];
  });
}

function load(file: string, dependencies: Record<string, unknown>) {
  const module = { exports: {} as Record<string, (...args: unknown[]) => Promise<Record<string, unknown>>> };
  const source = ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  runInNewContext(source, {
    Error, exports: module.exports, module,
    require: (id: string) => {
      assert.ok(id in dependencies, `Unexpected dependency ${id}`);
      return dependencies[id];
    },
  });
  return module.exports;
}

test("ADMIN-1 frontières indirectes : l'inventaire suit les consommateurs réels", () => {
  const found = discover();
  assert.equal(found.filter((row) => row.guard === "orderActorAuth").length, 0);
  assert.equal(found.filter((row) => row.guard === "requireSupportStaff").length, 4);
  assert.deepEqual(documented(), found);
});

test("ADMIN-1 frontières indirectes : le support entreprise exige l'administrateur et support:read", async () => {
  const helperSource = readFileSync("src/lib/api/support-staff-auth.ts", "utf8");
  const requireRole = requireRoleFrom(helperSource, supportRoles);
  assert.match(helperSource, /!auth\.context\.permissions\.includes\("support:read"\)/);
  for (const role of roles) {
    for (const permissions of [[], ["support:read"]]) {
      let companyReads = 0;
      const helper = load("src/lib/api/support-staff-auth.ts", {
        "server-only": {},
        "next/server": { NextResponse },
        "@/lib/api/auth-guard": {
          requireStaffRole: async () => ({
            context: { permissions, user: { id: "user-1", companyId: "company-1", role: { systemRole: role } } },
          }),
          requireRole,
          getCompanyId: (context: { user: { companyId?: string | null } }) => {
            companyReads += 1;
            return context.user.companyId ?? null;
          },
        },
      });
      const result = await helper.requireSupportStaff!();
      const allowed = supportRoles.includes(role) && permissions.includes("support:read");
      if (allowed) {
        assert.equal(result.companyId, "company-1");
        assert.equal(companyReads, 1);
      } else {
        assert.equal((result.error as Response).status, 403);
        assert.equal(companyReads, 0);
      }
    }
  }
});
