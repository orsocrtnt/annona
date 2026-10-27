import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const inventoryPath = "docs/operations/admin01/tenant-api-boundaries.md";

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

function observe(scan: string) {
  const permissions = [...scan.matchAll(/requireStaffRole\(\s*"([^"]+)"\s*\)/g)].map((match) => match[1]);
  const permission = permissions.length > 0 ? permissions.join(", ") : scan.includes("requireStaffRole()") ? "requireStaffRole()" : "aucun";
  const roles = scan.match(/requireRole\([^)]*\[([^\]]*)\]/);
  const roleList = roles?.[1] ?? "";
  const role = roles ? [...roleList.matchAll(/"([^"]+)"/g)].map((match) => match[1]).join(", ") : "aucun";
  return { permission, role };
}

function discover() {
  const rows: Array<{ file: string; method: string; permission: string; role: string }> = [];
  const files = readdirSync("src/app/api", { recursive: true })
    .map((entry) => entry.toString().split("\\").join("/"))
    .filter((entry) => entry.endsWith("route.ts") && !entry.startsWith("admin/"))
    .sort();
  for (const file of files) {
    const source = readFileSync(join("src/app/api", file), "utf8");
    if (!/\bgetCompanyId\s*\(/.test(source)) continue;
    const helpers = functionBodies(source);
    const parts = source.split(/export async function (GET|POST|PATCH|PUT|DELETE)/);
    for (let index = 1; index < parts.length; index += 2) {
      const method = parts[index] ?? "";
      const body = parts[index + 1] ?? "";
      let scan = body;
      if (!body.includes("requireStaffRole") && !body.includes("requireRole")) {
        for (const [name, helper] of helpers) {
          if (new RegExp(`\\b${name}\\s*\\(`).test(body)) scan += `\n${helper}`;
        }
      }
      const observed = observe(scan);
      rows.push({ file: `src/app/api/${file}`, method, ...observed });
    }
  }
  return rows;
}

function documented() {
  const source = readFileSync(inventoryPath, "utf8");
  const block = source.split("<!-- TENANT_API_BOUNDARIES_START -->")[1]?.split("<!-- TENANT_API_BOUNDARIES_END -->")[0] ?? "";
  return block.split("\n").flatMap((line) => {
    if (!line.startsWith("| src/")) return [];
    const [file, method, permission, role] = line.split("|").slice(1, 5).map((cell) => cell.trim());
    return [{ file, method, permission, role }];
  });
}

test("ADMIN-1 inventaire entreprise : chaque route avec getCompanyId est documentée", () => {
  const found = discover();
  const listed = documented();
  assert.equal(found.length, 49);
  assert.equal(new Set(found.map((row) => row.file)).size, 34);
  assert.deepEqual(listed, found);
  const note = readFileSync(inventoryPath, "utf8");
  assert.equal(note.includes("conversationAuth"), true);
  assert.equal(note.includes("requireSupportStaff"), true);
});
