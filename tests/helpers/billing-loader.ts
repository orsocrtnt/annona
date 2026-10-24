import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import type { PrismaClient } from "@prisma/client";
const nativeRequire = createRequire(import.meta.url);

/** Exercise production modules with only external side effects replaced; no emails/auth/network in local tests. */
export function loadBilling(db: PrismaClient | object = {}) {
  const cache = new Map<string, { exports: Record<string, unknown> }>();
  const stubs: Record<string, unknown> = {
    "server-only": {},
    "@/services/prisma/client": { prisma: db },
    "@/services/supabase/admin": {},
    "@/services/supabase/password-link": {},
    "@/lib/auth/email-links": {},
    "@/lib/email/transactional-email": {},
    "@/domains/operations/operation-job.service": { enqueueOperationJob: async () => ({ id: null }), kickOperationJob: () => undefined },
  };
  function load(path: string): unknown {
    const filename = resolve(path);
    if (cache.has(filename)) return cache.get(filename)!.exports;
    const module = { exports: {} }; cache.set(filename, module);
    const source = ts.transpileModule(readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    runInNewContext(source, { module, exports: module.exports, Buffer, Date, Error, Map, Set, JSON, Math, console, URL, URLSearchParams, AbortSignal, process, fetch, Response, setTimeout, clearTimeout, require: (name: string) => {
      if (name in stubs) return stubs[name];
      if (name.startsWith("@/")) return load(resolve("src", `${name.slice(2)}.ts`));
      if (name.startsWith(".")) return load(resolve(dirname(filename), `${name}.ts`));
      return nativeRequire(name);
    } }, { filename });
    return module.exports;
  }
  return {
    core: load("src/domains/billing/billing-core.ts") as typeof import("../../src/domains/billing/billing-core"),
    stripe: load("src/domains/billing/stripe-sandbox.ts") as typeof import("../../src/domains/billing/stripe-sandbox"),
    service: load("src/domains/billing/billing.service.ts") as typeof import("../../src/domains/billing/billing.service"),
  };
}
