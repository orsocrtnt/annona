import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { NextResponse } from "next/server";

function load(file: string, role: string, calls: string[], missing = false) {
  const module = { exports: {} as {
    GET?: (request: Request, context?: { params: Promise<{ id: string }> }) => Promise<Response>;
    PATCH?: unknown;
  } };
  const source = ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const dependencies: Record<string, unknown> = {
    "next/server": { NextResponse },
    "@/lib/api/auth-guard": {
      requireStaffRole: async (permission: string) => {
        calls.push(`staff:${permission}`);
        return { context: { user: { role: { systemRole: role } } } };
      },
      requireRole: (context: { user: { role: { systemRole: string } } }, roles: string[]) => {
        calls.push("role");
        assert.equal([...roles].join(","), "COMPANY_ADMIN,MINI_ADMIN,DISPATCHER");
        return roles.includes(context.user.role.systemRole)
          ? null
          : NextResponse.json({ error: "Accès refusé" }, { status: 403 });
      },
      getCompanyId: () => { calls.push("company"); return "company-1"; },
    },
    "@/lib/api/route-handler": {
      withApiHandler: async (handler: () => Promise<Response>) => handler(),
    },
    "@/domains/delivery/delivery.service": {
      getCompanyDeliveries: async () => { calls.push("list"); return [{ id: "delivery-1" }]; },
      getCompanyDeliveryById: async () => {
        calls.push("detail");
        return missing ? null : { id: "delivery-1", podPhotoPath: "pod.jpg", reference: "L-1", status: "IN_DELIVERY", order: { requestedDeliveryDate: null } };
      },
      adminUpdateDelivery: async () => { calls.push("patch"); return null; },
    },
    "@/domains/delivery/delivery-timing": {
      deliveryTiming: (input: { hasProof: boolean }) => { calls.push(`timing:${input.hasProof}`); return { late: false }; },
    },
    "@/lib/validations/delivery": { adminUpdateDeliverySchema: { safeParse: () => ({ success: false }) } },
    "@/lib/storage/pod": {
      getPodPhotoSignedUrl: async () => { calls.push("sign"); return "https://signed.example/pod"; },
    },
  };
  runInNewContext(source, {
    Error, URL, exports: module.exports, module,
    require: (id: string) => {
      assert.ok(id in dependencies, `Unexpected dependency ${id}`);
      return dependencies[id];
    },
  });
  return module.exports;
}

function watched(url: string, calls: string[]) {
  const request = new Request(url);
  return new Proxy(request, {
    get(target, prop, receiver) {
      if (prop === "url") calls.push("url");
      return Reflect.get(target, prop, receiver);
    },
  });
}

function context(calls: string[]) {
  return {
    params: {
      then(onFulfilled: (value: { id: string }) => unknown) {
        calls.push("params");
        return Promise.resolve({ id: "delivery-1" }).then(onFulfilled);
      },
    } as Promise<{ id: string }>,
  };
}

test("ADMIN-1 livraisons : lecture refusée avant URL, entreprise et signature", async () => {
  const listCalls: string[] = [];
  const list = load("src/app/api/deliveries/route.ts", "SUPER_ADMIN", listCalls);
  assert.equal((await list.GET!(watched("http://local/api/deliveries?unassigned=true", listCalls))).status, 403);
  assert.deepEqual(listCalls, ["staff:deliveries:read", "role"]);

  const detailCalls: string[] = [];
  const detail = load("src/app/api/deliveries/[id]/route.ts", "SUPER_ADMIN", detailCalls);
  assert.equal((await detail.GET!(new Request("http://local/api/deliveries/delivery-1"), context(detailCalls))).status, 403);
  assert.deepEqual(detailCalls, ["staff:deliveries:read", "role"]);
});

test("ADMIN-1 livraisons : les trois rôles conservent la réponse", async () => {
  for (const role of ["COMPANY_ADMIN", "MINI_ADMIN", "DISPATCHER"]) {
    const listCalls: string[] = [];
    const list = await load("src/app/api/deliveries/route.ts", role, listCalls).GET!(
      watched("http://local/api/deliveries?unassigned=true", listCalls)
    );
    assert.equal(list.status, 200);
    assert.equal(listCalls.includes("url"), true);
    assert.deepEqual(await list.json(), { data: [{ id: "delivery-1" }], success: true });

    const detailCalls: string[] = [];
    const detail = await load("src/app/api/deliveries/[id]/route.ts", role, detailCalls).GET!(
      new Request("http://local/api/deliveries/delivery-1"),
      context(detailCalls)
    );
    assert.equal(detail.status, 200);
    assert.equal(detailCalls.includes("sign"), true);
    assert.equal((await detail.json()).data.podPhotoUrl, "https://signed.example/pod");
  }

  const missing = await load("src/app/api/deliveries/[id]/route.ts", "COMPANY_ADMIN", [], true).GET!(
    new Request("http://local/api/deliveries/delivery-1"),
    context([])
  );
  assert.equal(missing.status, 404);
  assert.equal((await missing.json()).error, "Livraison introuvable");
});
