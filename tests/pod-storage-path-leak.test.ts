import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";
import { NextResponse } from "next/server";
import * as proofLinks from "../src/domains/delivery/proof-links";

test("omitStoragePaths retire les chemins de preuve à toute profondeur, sans toucher au reste", () => {
  const date = new Date("2026-10-28T10:00:00Z");
  const input = {
    id: "d1", podPhotoPath: "a/d1-1.jpg", podSignaturePath: "a/d1-sig-1.png", podRecipientName: "Mme Martin", at: date,
    nested: [{ podPhotoPath: "x", keep: 1, deliveries: [{ podSignaturePath: "y", id: "d2" }] }],
  };
  const output = proofLinks.omitStoragePaths(input);
  assert.deepEqual(JSON.parse(JSON.stringify(output)), {
    id: "d1", podRecipientName: "Mme Martin", at: date.toISOString(), nested: [{ keep: 1, deliveries: [{ id: "d2" }] }],
  });
  assert.ok(output.at instanceof Date);
  assert.equal(input.podPhotoPath, "a/d1-1.jpg", "l'entrée n'est pas modifiée");
});

test("lien PDF : affiché seulement si une preuve existe (le PDF répond 404 sans podOutcome)", () => {
  assert.equal(proofLinks.proofLinks("/api/deliveries", { id: "d1", status: "DELIVERED" }).podPdfUrl, null);
  assert.equal(proofLinks.proofLinks("/api/deliveries", { id: "d1", status: "PAID", podOutcome: null }).podPdfUrl, null);
  assert.equal(proofLinks.proofLinks("/api/deliveries", { id: "d1", status: "FAILED", podOutcome: "FAILED" }).podPdfUrl, "/api/deliveries/d1/proof/pdf");
  assert.equal(proofLinks.proofLinks("/api/portal/deliveries", { id: "d 2", podOutcome: "SUCCESS" }).podPdfUrl, "/api/portal/deliveries/d%202/proof/pdf");
});

// Routes qui renvoient des lignes de livraison issues de services sans `select` : toutes doivent filtrer.
const ROUTES_RETURNING_DELIVERY_ROWS = [
  "src/app/api/deliveries/route.ts",
  "src/app/api/deliveries/[id]/route.ts",
  "src/app/api/deliveries/[id]/assign/route.ts",
  "src/app/api/dispatch/overview/route.ts",
  "src/app/api/driver/deliveries/[id]/claim/route.ts",
  "src/app/api/driver/missions/[id]/start/route.ts",
  "src/app/api/drivers/[id]/route.ts",
  "src/app/api/orders/[id]/route.ts",
  "src/app/api/orders/dashboard/route.ts",
];

test("chaque route qui renvoie des lignes de livraison brutes retire les chemins Storage", () => {
  for (const file of ROUTES_RETURNING_DELIVERY_ROWS) {
    const source = readFileSync(resolve(file), "utf8");
    const returned = [...source.matchAll(/NextResponse\.json\(\{\s*data:\s*([^,}]+)/g)].map((match) => match[1]!.trim());
    assert.ok(returned.length > 0, `${file} : aucun retour de données trouvé`);
    for (const expression of returned) {
      assert.ok(/omitStoragePaths|withProofLinks/.test(expression), `${file} : « ${expression} » est renvoyé sans omitStoragePaths`);
    }
  }
});

test("liste des livraisons du back-office : aucun chemin de photo ni de signature dans la réponse", async () => {
  const module = { exports: {} as typeof import("../src/app/api/deliveries/route") };
  const js = ts.transpileModule(readFileSync(resolve("src/app/api/deliveries/route.ts"), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const deps: Record<string, unknown> = {
    "next/server": { NextResponse },
    "@/lib/api/auth-guard": {
      requireStaffRole: async () => ({ context: { user: { companyId: "a", role: { systemRole: "DISPATCHER" } } } }),
      requireRole: () => null,
      getCompanyId: () => "a",
    },
    "@/lib/api/route-handler": { withApiHandler: (handler: () => Promise<Response>) => handler() },
    "@/domains/delivery/delivery.service": {
      getCompanyDeliveries: async () => [{ id: "d1", podPhotoPath: "a/d1-1.jpg", podSignaturePath: "a/d1-sig-1-x.png", order: { reference: "C1" } }],
    },
    "@/domains/delivery/proof-links": proofLinks,
  };
  runInNewContext(js, { URL, Object, Array, Date, exports: module.exports, module, require: (id: string) => { assert.ok(id in deps, `Unexpected dependency ${id}`); return deps[id]; } });
  const response = await module.exports.GET(new Request("http://local/api/deliveries"));
  const text = JSON.stringify(await response.json());
  assert.equal(text.includes("podPhotoPath"), false);
  assert.equal(text.includes("podSignaturePath"), false);
  assert.ok(text.includes("C1"));
});
