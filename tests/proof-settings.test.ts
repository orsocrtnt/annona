import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";
import * as podEvidence from "../src/domains/delivery/pod-evidence";

test("PATCH partiel : seuls les champs fournis sont acceptés, aucun défaut ajouté, objet vide et clés inconnues refusés", () => {
  const schema = podEvidence.proofRulesPatchSchema;
  assert.deepEqual(schema.parse({ signatureRequired: true }), { signatureRequired: true });
  assert.deepEqual(schema.parse({ emailToClient: false }), { emailToClient: false });
  assert.ok(!schema.safeParse({}).success);
  assert.ok(!schema.safeParse({ signatureRequired: true, autre: 1 }).success);
  assert.ok(!schema.safeParse({ signatureRequired: "oui" }).success);
});

function service(options: { stored?: unknown; updated?: number } = {}) {
  const statements: Array<{ sql: string; values: unknown[] }> = [];
  const writes: unknown[] = [];
  const module = { exports: {} as typeof import("../src/domains/delivery/proof-settings.service") };
  const js = ts.transpileModule(readFileSync(resolve("src/domains/delivery/proof-settings.service.ts"), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const deps: Record<string, unknown> = {
    "@/services/prisma/client": {
      prisma: {
        company: {
          findUnique: async () => ({ settings: { dispatchRules: { enabled: true }, proofRules: options.stored ?? { signatureRequired: true, emailToClient: true } } }),
          update: async (args: unknown) => { writes.push(args); },
        },
        $executeRaw: async (strings: TemplateStringsArray, ...values: unknown[]) => {
          statements.push({ sql: strings.join("?"), values });
          return options.updated ?? 1;
        },
      },
    },
    "./pod-evidence": podEvidence,
  };
  runInNewContext(js, { Object, JSON, exports: module.exports, module, require: (id: string) => { assert.ok(id in deps, `Unexpected dependency ${id}`); return deps[id]; } });
  return { service: module.exports, statements, writes };
}

test("mise à jour des règles : une seule instruction SQL de fusion ciblée, sans lecture-modification-écriture du JSON complet", async () => {
  const f = service();
  await f.service.updateCompanyProofRules("company-a", { emailToClient: false });
  assert.equal(f.writes.length, 0, "aucun company.update qui réécrirait tout settings");
  assert.equal(f.statements.length, 1);
  const { sql, values } = f.statements[0]!;
  assert.match(sql, /jsonb_set/);
  assert.match(sql, /\|\|/);
  assert.ok(values.includes("company-a"));
  const patch = values.find((value) => typeof value === "string" && value.startsWith("{"));
  assert.deepEqual(JSON.parse(patch as string), { emailToClient: false }, "les champs omis ne sont pas envoyés, donc non réinitialisés");
});

test("mise à jour des règles : entreprise inconnue → COMPANY_NOT_FOUND, valeurs invalides refusées avant SQL", async () => {
  const missing = service({ updated: 0 });
  await assert.rejects(missing.service.updateCompanyProofRules("company-x", { signatureRequired: true }), /COMPANY_NOT_FOUND/);
  const invalid = service();
  await assert.rejects(invalid.service.updateCompanyProofRules("company-a", { signatureRequired: "oui" }));
  assert.equal(invalid.statements.length, 0);
});

test("lecture après mise à jour : les autres champs conservent leur valeur", async () => {
  const f = service({ stored: { signatureRequired: true, emailToClient: false } });
  const rules = await f.service.updateCompanyProofRules("company-a", { emailToClient: true });
  assert.equal(typeof rules.signatureRequired, "boolean");
});
