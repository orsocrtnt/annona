import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";
import { NextResponse } from "next/server";
import {
  buildCourierStatement,
  courierStatementQuerySchema,
  courierStatementToCsv,
  parisDayStart,
  type CourierStatementRow,
} from "../src/domains/delivery/courier-statement";

const row = (over: Partial<CourierStatementRow> = {}): CourierStatementRow => ({
  deliveryId: "d1", reference: "LIV-1", driverId: "dr1", driverName: "Luc Livreur", status: "DELIVERED",
  startedAt: new Date("2026-10-28T08:00:00Z"), completedAt: new Date("2026-10-28T08:45:00Z"), address: "2 rue B", city: "Lyon", ...over,
});

test("relevé : regroupe par livreur, compte livrées et échecs, durée réelle en minutes", () => {
  const statement = buildCourierStatement([
    row(),
    row({ deliveryId: "d2", reference: "LIV-2", completedAt: new Date("2026-10-28T09:30:00Z") }),
    row({ deliveryId: "d3", reference: "LIV-3", status: "FAILED", completedAt: new Date("2026-10-28T10:00:00Z") }),
    row({ deliveryId: "d4", reference: "LIV-4", driverId: "dr2", driverName: "Zoé", status: "INVOICED", startedAt: null }),
  ]);
  assert.equal(statement.couriers.length, 2);
  const luc = statement.couriers.find((courier) => courier.driverId === "dr1")!;
  assert.deepEqual([luc.delivered, luc.failed], [2, 1]);
  assert.deepEqual(luc.rows.map((r) => r.durationMinutes), [45, 90, 120]);
  assert.equal(luc.totalDurationMinutes, 255);
  assert.equal(luc.averageDurationMinutes, 85);
  const zoe = statement.couriers.find((courier) => courier.driverId === "dr2")!;
  assert.deepEqual([zoe.delivered, zoe.failed, zoe.rows[0]!.durationMinutes, zoe.averageDurationMinutes], [1, 0, null, null]);
});

test("relevé : durée négative ou absente ignorée du total", () => {
  const statement = buildCourierStatement([row({ completedAt: new Date("2026-10-28T07:00:00Z") }), row({ deliveryId: "d2", startedAt: null })]);
  assert.equal(statement.couriers[0]!.totalDurationMinutes, 0);
  assert.equal(statement.couriers[0]!.rows[0]!.durationMinutes, null);
});

test("CSV : séparateur point-virgule, BOM, une ligne par course, formules neutralisées", () => {
  const csv = courierStatementToCsv(buildCourierStatement([row({ driverName: "=CMD()", address: '12 "rue"; X' })]));
  assert.ok(csv.startsWith("﻿"));
  const lines = csv.slice(1).trim().split("\r\n");
  assert.equal(lines.length, 2);
  assert.match(lines[0]!, /^Livreur;Référence;Résultat;Prise en charge;Livraison;Durée \(min\);Adresse$/);
  assert.ok(lines[1]!.startsWith("'=CMD();LIV-1;Livrée;"), lines[1]);
  assert.ok(lines[1]!.includes('"12 ""rue""; X, Lyon"'));
  assert.ok(lines[1]!.includes(";45;"));
});

test("paramètres : période bornée, dates valides, 93 jours maximum", () => {
  assert.ok(courierStatementQuerySchema.safeParse({ from: "2026-10-01", to: "2026-10-31" }).success);
  assert.ok(!courierStatementQuerySchema.safeParse({ from: "2026-10-31", to: "2026-10-01" }).success);
  assert.ok(!courierStatementQuerySchema.safeParse({ from: "2026-01-01", to: "2026-12-31" }).success);
  assert.ok(!courierStatementQuerySchema.safeParse({ from: "pas-une-date", to: "2026-10-01" }).success);
  assert.ok(!courierStatementQuerySchema.safeParse({ from: "2026-02-30", to: "2026-03-02" }).success);
  assert.equal(courierStatementQuerySchema.parse({ from: "2026-10-01", to: "2026-10-02" }).format, "json");
});

// --- route : rôles, entreprise de la session, aucun accès inter-entreprises ---
function loadRoute(role: string, calls: Record<string, unknown>[]) {
  const module = { exports: {} as typeof import("../src/app/api/back-office/courier-statements/route") };
  const js = ts.transpileModule(readFileSync(resolve("src/app/api/back-office/courier-statements/route.ts"), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const deps: Record<string, unknown> = {
    "next/server": { NextResponse },
    "@/lib/config-messages": { zodIssueMessage: (e: { issues: Array<{ message: string }> }, f: string) => e.issues[0]?.message ?? f },
    "@/lib/api/auth-guard": {
      requireStaffRole: async (permission: string) => {
        calls.push({ permission });
        return { context: { user: { companyId: "company-a", role: { systemRole: role } } } };
      },
      requireRole: (context: { user: { role: { systemRole: string } } }, roles: string[]) =>
        roles.includes(context.user.role.systemRole) ? null : NextResponse.json({ error: "Accès refusé" }, { status: 403 }),
      getCompanyId: (context: { user: { companyId: string } }) => context.user.companyId,
    },
    "@/domains/delivery/courier-statement": { courierStatementQuerySchema, courierStatementToCsv },
    "@/domains/delivery/courier-statement.service": {
      getCourierStatement: async (input: Record<string, unknown>) => { calls.push(input); return { couriers: [], truncated: false, from: "", to: "" }; },
    },
  };
  runInNewContext(js, { Object, URL, Response, exports: module.exports, module, require: (id: string) => { assert.ok(id in deps, `Unexpected dependency ${id}`); return deps[id]; } });
  return module.exports;
}

test("route relevé : rôles autorisés, entreprise issue de la session (jamais de l'URL), pilote refusé", async () => {
  for (const role of ["COMPANY_ADMIN", "MINI_ADMIN", "DISPATCHER"]) {
    const calls: Record<string, unknown>[] = [];
    const response = await loadRoute(role, calls).GET(new Request("http://local/api/back-office/courier-statements?from=2026-10-01&to=2026-10-31&companyId=company-b"));
    assert.equal(response.status, 200);
    assert.equal(calls[0]!.permission, "drivers:read");
    assert.equal(calls[1]!.companyId, "company-a", "le companyId de l'URL est ignoré");
  }
  for (const role of ["DRIVER", "CLIENT"]) {
    const calls: Record<string, unknown>[] = [];
    const response = await loadRoute(role, calls).GET(new Request("http://local/api/back-office/courier-statements?from=2026-10-01&to=2026-10-31"));
    assert.equal(response.status, 403);
    assert.equal(calls.length, 1, "aucune lecture avant le contrôle du rôle");
  }
});

test("route relevé : période invalide → 400 sans lecture ; CSV servi en pièce jointe", async () => {
  const calls: Record<string, unknown>[] = [];
  const route = loadRoute("COMPANY_ADMIN", calls);
  assert.equal((await route.GET(new Request("http://local/x?from=2026-10-31&to=2026-10-01"))).status, 400);
  assert.equal(calls.length, 1);
  const csv = await route.GET(new Request("http://local/x?from=2026-10-01&to=2026-10-31&format=csv"));
  assert.match(csv.headers.get("content-type") ?? "", /text\/csv/);
  assert.match(csv.headers.get("content-disposition") ?? "", /releve-livreurs-2026-10-01-2026-10-31\.csv/);
});

test("période : les jours sont calculés à minuit, heure de Paris (heure d'été et d'hiver)", () => {
  assert.equal(parisDayStart("2026-10-28").toISOString(), "2026-10-27T23:00:00.000Z");
  assert.equal(parisDayStart("2026-07-01").toISOString(), "2026-06-30T22:00:00.000Z");
});
