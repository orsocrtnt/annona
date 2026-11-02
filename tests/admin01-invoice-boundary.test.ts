import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { NextResponse } from "next/server";

function load(file: string, role: string, calls: string[], fail?: string) {
  const module = { exports: {} as {
    GET?: (request: Request) => Promise<Response>;
    POST?: (request: Request, context: { params: Promise<{ id: string }> }) => Promise<Response>;
    PATCH?: (request: Request, context: { params: Promise<{ id: string }> }) => Promise<Response>;
  } };
  const source = ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const dependencies: Record<string, unknown> = {
    "@/lib/api/saas-guard": { refuseIfReadOnly: async () => null, refuseDemoInvitation: async () => null },
    "next/server": { NextResponse },
    "@/lib/config-messages": { zodIssueMessage: (e: { issues: Array<{ message: string }> }, f: string) => e.issues[0]?.message ?? f },
    "@/lib/api/auth-guard": {
      requireStaffRole: async (permission: string) => {
        calls.push(`staff:${permission}`);
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
    "@/domains/invoice/accounting-export.service": {
      exportAccountingCsv: async () => {
        calls.push("export");
        if (fail === "ACCOUNTING_EXPORT_TOO_LARGE") throw new Error(fail);
        return "csv";
      },
    },
    "@/lib/validations/accounting-export": {
      parseAccountingExportQuery: () => {
        calls.push("query");
        return { success: true, data: { from: "2026-10-01", to: "2026-10-31", status: "ALL" } };
      },
    },
    "@/domains/invoice/invoice.service": {
      createOrderInvoice: async () => { calls.push("create"); return { id: "invoice-1" }; },
      markOrderInvoicePaid: async () => {
        calls.push("pay");
        if (fail === "INVOICE_STATUS_CONFLICT") throw new Error(fail);
        return { id: "invoice-1" };
      },
    },
    "@/lib/validations/invoice": {
      createOrderInvoiceSchema: { safeParse: () => { calls.push("parse"); return { success: true, data: {} }; } },
      markOrderInvoicePaidSchema: { safeParse: () => { calls.push("parse"); return { success: true, data: { invoiceId: "invoice-1", expectedUpdatedAt: "2026-10-25T00:00:00.000Z" } }; } },
    },
  };
  runInNewContext(source, {
    Error, Response, console, exports: module.exports, module,
    require: (id: string) => {
      assert.ok(id in dependencies, `Unexpected dependency ${id}`);
      return dependencies[id];
    },
  });
  return module.exports;
}

function watched(calls: string[]) {
  const request = new Request("http://local/api/invoices/export?from=2026-10-01&to=2026-10-31&status=ALL");
  return new Proxy(request, {
    get(target, prop, receiver) {
      if (prop === "url") calls.push("url");
      return Reflect.get(target, prop, receiver);
    },
  });
}

function bodyRequest(calls: string[]) {
  const request = new Request("http://local/api/orders/order-1/invoice", { method: "POST", body: "{}" });
  const read = request.json.bind(request);
  Object.defineProperty(request, "json", { value: async () => { calls.push("body"); return read(); } });
  return request;
}

function context(calls: string[]) {
  return {
    params: {
      then(onFulfilled: (value: { id: string }) => unknown) {
        calls.push("params");
        return Promise.resolve({ id: "order-1" }).then(onFulfilled);
      },
    } as Promise<{ id: string }>,
  };
}

test("ADMIN-1 factures : export et mutations refusés avant URL, corps et entreprise", async () => {
  for (const role of ["SUPER_ADMIN", "DISPATCHER"]) {
    const exportCalls: string[] = [];
    const exported = load("src/app/api/invoices/export/route.ts", role, exportCalls);
    assert.equal((await exported.GET!(watched(exportCalls))).status, 403);
    assert.deepEqual(exportCalls, ["staff:invoices:read", "role"]);

    const invoiceCalls: string[] = [];
    const invoice = load("src/app/api/orders/[id]/invoice/route.ts", role, invoiceCalls);
    assert.equal((await invoice.POST!(bodyRequest(invoiceCalls), context(invoiceCalls))).status, 403);
    assert.equal((await invoice.PATCH!(bodyRequest(invoiceCalls), context(invoiceCalls))).status, 403);
    assert.deepEqual(invoiceCalls, ["staff:invoices:create", "role", "staff:invoices:update", "role"]);
  }
});

test("ADMIN-1 factures : admins entreprise passent, volume 422 et conflit 409 restent", async () => {
  for (const role of ["COMPANY_ADMIN", "MINI_ADMIN"]) {
    const exportCalls: string[] = [];
    const exported = await load("src/app/api/invoices/export/route.ts", role, exportCalls).GET!(watched(exportCalls));
    assert.equal(exported.status, 200);
    assert.equal(await exported.text(), "csv");

    const invoiceCalls: string[] = [];
    const invoice = load("src/app/api/orders/[id]/invoice/route.ts", role, invoiceCalls);
    assert.equal((await invoice.POST!(bodyRequest(invoiceCalls), context(invoiceCalls))).status, 200);
    assert.equal((await invoice.PATCH!(bodyRequest(invoiceCalls), context(invoiceCalls))).status, 200);
    assert.equal(invoiceCalls.includes("create"), true);
    assert.equal(invoiceCalls.includes("pay"), true);
  }

  const tooLarge = await load("src/app/api/invoices/export/route.ts", "COMPANY_ADMIN", [], "ACCOUNTING_EXPORT_TOO_LARGE").GET!(
    new Request("http://local/api/invoices/export")
  );
  assert.equal(tooLarge.status, 422);
  assert.equal((await tooLarge.json()).error, "Export trop volumineux : réduisez la période ou filtrez le statut.");

  const conflict = await load("src/app/api/orders/[id]/invoice/route.ts", "MINI_ADMIN", [], "INVOICE_STATUS_CONFLICT").PATCH!(
    new Request("http://local/api/orders/order-1/invoice", { method: "PATCH", body: "{}" }),
    context([])
  );
  assert.equal(conflict.status, 409);
  assert.equal((await conflict.json()).error, "Cette facture a changé ou ne peut pas être réglée. Rechargez-la.");
});
