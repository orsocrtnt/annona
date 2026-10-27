import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";

type Res = { status: number; body?: unknown; headers?: Record<string, string> };
type Route = { GET(request: Request): Promise<Res>; POST(request: Request): Promise<Res>; DELETE(): Promise<Res> };

function loadRoute(options: { role?: string; serviceError?: string; logo?: Buffer | null } = {}) {
  const calls: string[] = [];
  class FakeResponse {
    status: number; body: unknown; headers?: Record<string, string>;
    constructor(body: unknown, init?: { status?: number; headers?: Record<string, string> }) {
      this.body = body; this.status = init?.status ?? 200; this.headers = init?.headers;
    }
    static json(body: unknown, init?: { status?: number }) { return { status: init?.status ?? 200, body }; }
  }
  const context = { user: { companyId: "company_a" }, role: options.role ?? "COMPANY_ADMIN" };
  const deps: Record<string, unknown> = {
    "next/server": { NextResponse: FakeResponse },
    "@/lib/api/auth-guard": {
      requireAuth: async () => ({ context }),
      requireStaffRole: async () => ({ context }),
      requireRole: (ctx: typeof context, roles: string[]) => (roles.includes(ctx.role) ? null : FakeResponse.json({ error: "Accès refusé" }, { status: 403 })),
      getCompanyId: (ctx: typeof context) => ctx.user.companyId,
    },
    "@/domains/company/company-logo.service": {
      setCompanyLogo: async () => { calls.push("set"); if (options.serviceError) throw new Error(options.serviceError); return { width: 480, height: 96 }; },
      removeCompanyLogo: async () => { calls.push("remove"); },
      readCompanyLogo: async () => options.logo ?? null,
      companyHasLogo: async () => Boolean(options.logo),
    },
    "@/lib/storage/company-logo": { MAX_LOGO_UPLOAD_BYTES: 2 * 1024 * 1024 },
  };
  const loaded = { exports: {} };
  const js = ts.transpileModule(readFileSync(resolve("src/app/api/company/logo/route.ts"), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  runInNewContext(js, {
    Error, Number, Buffer, Uint8Array, File, Promise, URL, console: { error: () => undefined },
    exports: loaded.exports, module: loaded, require: (id: string) => deps[id],
  });
  return { route: loaded.exports as Route, calls };
}

function upload(bytes: Buffer | null) {
  const form = new FormData();
  if (bytes) form.set("logo", new File([new Uint8Array(bytes)], "logo.png", { type: "image/png" }));
  return new Request("http://local.test/api/company/logo", { method: "POST", body: form });
}

test("seuls l'admin et le mini-admin peuvent changer le logo", async () => {
  const { route, calls } = loadRoute({ role: "DISPATCHER" });
  assert.equal((await route.POST(upload(Buffer.from("x")))).status, 403);
  assert.equal((await route.DELETE()).status, 403);
  assert.deepEqual(calls, []);
});

test("fichier absent ou trop lourd : refus avant d'appeler le service", async () => {
  const { route, calls } = loadRoute();
  assert.equal((await route.POST(upload(null))).status, 400);
  assert.equal((await route.POST(upload(Buffer.alloc(2 * 1024 * 1024 + 1)))).status, 413);
  assert.deepEqual(calls, []);
});

test("en démo, le refus du service devient un 403 explicite", async () => {
  const { route } = loadRoute({ serviceError: "LOGO_DEMO_DISABLED" });
  const res = await route.POST(upload(Buffer.from("x")));
  assert.equal(res.status, 403);
  assert.match(JSON.stringify(res.body), /démonstration/);
});

test("un envoi valide renvoie la taille du logo enregistré", async () => {
  const { route, calls } = loadRoute();
  const res = await route.POST(upload(Buffer.from("x")));
  assert.equal(res.status, 200);
  assert.deepEqual(calls, ["set"]);
});

const get = (query = "") => new Request(`http://local.test/api/company/logo${query}`);

test("le logo se lit en PNG privé, ou 404 s'il n'y en a pas", async () => {
  assert.equal((await loadRoute({ logo: null }).route.GET(get())).status, 404);
  const res = await loadRoute({ logo: Buffer.from("png") }).route.GET(get());
  assert.equal(res.status, 200);
  assert.equal(res.headers?.["Content-Type"], "image/png");
  assert.match(res.headers?.["Cache-Control"] ?? "", /^private/);
});

test("la lecture méta dit seulement s'il y a un logo, toujours en 200", async () => {
  const none = await loadRoute({ logo: null }).route.GET(get("?meta=1"));
  assert.equal(none.status, 200);
  assert.match(JSON.stringify(none.body), /"hasLogo":false/);
  assert.match(JSON.stringify((await loadRoute({ logo: Buffer.from("png") }).route.GET(get("?meta=1"))).body), /"hasLogo":true/);
});
