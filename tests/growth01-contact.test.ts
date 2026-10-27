import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { NextResponse } from "next/server";
import {
  CONTACT_GLOBAL_LIMIT,
  CONTACT_SOURCE_LIMIT,
  CONTACT_WINDOW_MS,
  contactSourceFromHeaders,
  contactSourceHash,
  listContactMessages,
  parseContactListParams,
  submitContactMessage,
} from "../src/domains/growth/contact.service";

const secret = "test-secret";
const now = new Date("2026-10-27T10:00:00.000Z");
const valid = { name: "Camille Martin", email: " Camille@Example.invalid ", company: "Transports Exemple", phone: "+33 6 00 00 00 00", message: "Nous livrons 300 colis par jour, pouvez-vous nous rappeler ?" };

function memoryDb(existing: Array<{ sourceHash: string; createdAt: Date }> = []) {
  const rows = [...existing] as Array<Record<string, unknown> & { sourceHash: string; createdAt: Date }>;
  const counts: Array<Record<string, unknown>> = [];
  return {
    rows,
    counts,
    db: {
      contactMessage: {
        count: async ({ where }: { where: { sourceHash?: string; createdAt: { gte: Date } } }) => {
          counts.push(where);
          return rows.filter((row) => row.createdAt >= where.createdAt.gte && (!where.sourceHash || row.sourceHash === where.sourceHash)).length;
        },
        create: async ({ data }: { data: Record<string, unknown> & { sourceHash: string } }) => {
          rows.push({ ...data, createdAt: now });
          return data;
        },
      },
    } as never,
  };
}

test("GROWTH-1 contact : un message valide est normalisé et stocké sans adresse IP", async () => {
  const memory = memoryDb();
  assert.deepEqual(await submitContactMessage(valid, "203.0.113.7", { now, secret, db: memory.db }), { status: "accepted" });
  assert.equal(memory.rows.length, 1);
  const stored = memory.rows[0]!;
  assert.equal(stored.email, "camille@example.invalid");
  assert.equal(stored.sourceHash, contactSourceHash("203.0.113.7", secret));
  assert.equal(JSON.stringify(stored).includes("203.0.113.7"), false, "l'IP n'est jamais stockée");
  assert.equal("website" in stored, false);
  assert.deepEqual(memory.counts.map((where) => (where.createdAt as { gte: Date }).gte.getTime()), [now.getTime() - CONTACT_WINDOW_MS, now.getTime() - CONTACT_WINDOW_MS]);
});

test("GROWTH-1 contact : champs invalides refusés, pot de miel silencieux", async () => {
  for (const [body, field] of [
    [{ ...valid, email: "pas-un-email" }, "email"],
    [{ ...valid, message: "court" }, "message"],
    [{ ...valid, name: "A" }, "name"],
    [{ ...valid, phone: "<script>" }, "phone"],
    [{ ...valid, extra: "champ inconnu" }, ""],
    [null, ""],
  ] as const) {
    const memory = memoryDb();
    const result = await submitContactMessage(body, "198.51.100.1", { now, secret, db: memory.db });
    assert.equal(result.status, "invalid");
    if (field) assert.equal((result as { field: string }).field, field);
    assert.equal(memory.rows.length, 0);
  }
  const robot = memoryDb();
  assert.deepEqual(await submitContactMessage({ ...valid, website: "https://spam.invalid" }, "198.51.100.2", { now, secret, db: robot.db }), { status: "accepted" });
  assert.equal(robot.rows.length, 0, "un robot ne voit aucune différence et rien n'est écrit");
  assert.equal(robot.counts.length, 0);
});

test("GROWTH-1 contact : 3 messages par source et 50 au total par heure glissante", async () => {
  const sourceHash = contactSourceHash("192.0.2.9", secret);
  const recent = Array.from({ length: CONTACT_SOURCE_LIMIT }, () => ({ sourceHash, createdAt: new Date(now.getTime() - 10 * 60_000) }));
  const limited = memoryDb(recent);
  assert.deepEqual(await submitContactMessage(valid, "192.0.2.9", { now, secret, db: limited.db }), { status: "rate_limited" });
  assert.deepEqual(await submitContactMessage(valid, "192.0.2.10", { now, secret, db: limited.db }), { status: "accepted" }, "une autre source passe");

  const old = memoryDb(Array.from({ length: CONTACT_SOURCE_LIMIT }, () => ({ sourceHash, createdAt: new Date(now.getTime() - CONTACT_WINDOW_MS - 1) })));
  assert.deepEqual(await submitContactMessage(valid, "192.0.2.9", { now, secret, db: old.db }), { status: "accepted" }, "la fenêtre est glissante");

  const flood = memoryDb(Array.from({ length: CONTACT_GLOBAL_LIMIT }, (_, index) => ({ sourceHash: `other-${index}`, createdAt: now })));
  assert.deepEqual(await submitContactMessage(valid, "192.0.2.11", { now, secret, db: flood.db }), { status: "rate_limited" });
});

test("GROWTH-1 contact : empreinte à secret obligatoire et source lue sur le proxy", async () => {
  assert.notEqual(contactSourceHash("192.0.2.1", "a"), contactSourceHash("192.0.2.1", "b"));
  assert.match(contactSourceHash("192.0.2.1", secret), /^[a-f0-9]{64}$/);
  await assert.rejects(submitContactMessage(valid, "192.0.2.1", { now, secret: "", db: memoryDb().db }), /CONTACT_SOURCE_SECRET_MISSING/);
  assert.equal(contactSourceFromHeaders(new Headers({ "x-forwarded-for": "203.0.113.5, 10.0.0.1" })), "203.0.113.5");
  assert.equal(contactSourceFromHeaders(new Headers({ "x-real-ip": "203.0.113.6" })), "203.0.113.6");
  assert.equal(contactSourceFromHeaders(new Headers()), "unknown");
});

test("GROWTH-1 contact : la boîte plateforme pagine sans exposer l'empreinte", async () => {
  assert.deepEqual(parseContactListParams(new URLSearchParams("page=2&pageSize=50")), { query: { page: 2, pageSize: 50 } });
  assert.ok("error" in parseContactListParams(new URLSearchParams("pageSize=10")));
  assert.ok("error" in parseContactListParams(new URLSearchParams("page=0")));
  let findArgs: Record<string, unknown> = {};
  const result = await listContactMessages({ page: 2, pageSize: 25 }, {
    contactMessage: {
      count: async () => 30,
      findMany: async (args: Record<string, unknown>) => { findArgs = args; return []; },
    },
  } as never);
  assert.deepEqual(result, { items: [], total: 30, page: 2, pageSize: 25 });
  assert.equal(findArgs.skip, 25);
  assert.equal(findArgs.take, 25);
  assert.deepEqual(findArgs.orderBy, [{ createdAt: "desc" }, { id: "desc" }]);
  assert.equal("sourceHash" in (findArgs.select as Record<string, unknown>), false);
});

test("GROWTH-1 contact : la route publique répond 202, 400, 429 ou 503 sans détail interne", async () => {
  const source = ts.transpileModule(readFileSync("src/app/api/contact/route.ts", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  for (const [outcome, status] of [["accepted", 202], ["invalid", 400], ["rate_limited", 429], ["throw", 503]] as const) {
    const module = { exports: {} as { POST: (request: Request) => Promise<Response> } };
    const seen: string[] = [];
    runInNewContext(source, {
      module, exports: module.exports, console: { error: () => undefined },
      require: (id: string) => {
        if (id === "next/server") return { NextResponse };
        if (id === "@/domains/growth/contact.service") return {
          contactSourceFromHeaders: (headers: Headers) => headers.get("x-forwarded-for") ?? "unknown",
          submitContactMessage: async (_body: unknown, from: string) => {
            seen.push(from);
            if (outcome === "throw") throw new Error("db down: secret detail");
            return outcome === "invalid" ? { status: "invalid", field: "email" } : { status: outcome };
          },
        };
        throw new Error(id);
      },
    });
    const response = await module.exports.POST(new Request("http://local/api/contact", {
      method: "POST", body: JSON.stringify(valid), headers: { "x-forwarded-for": "203.0.113.9" },
    }));
    assert.equal(response.status, status, outcome);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(JSON.stringify(await response.json()).includes("secret detail"), false);
    assert.deepEqual(seen, ["203.0.113.9"]);
    if (status === 429) assert.equal(response.headers.get("retry-after"), "3600");
  }
});

test("GROWTH-1 contact : la boîte plateforme est en lecture seule, réservée au back-office", async () => {
  const { adminNavItems, companyNavItems, miniAdminNavItems } = await import("../src/features/navigation/nav-config");
  assert.equal(adminNavItems.find((item) => item.title === "Messages Contact")?.href, "/admin/contact");
  assert.equal([...companyNavItems, ...miniAdminNavItems].some((item) => item.href === "/admin/contact"), false);
  const page = readFileSync("src/app/(back-office)/admin/contact/page.tsx", "utf8");
  const fields = [...page.matchAll(/row\.(\w+)/g)].map((match) => match[1]);
  assert.deepEqual([...new Set(fields)].sort(), ["company", "createdAt", "email", "id", "message", "name", "phone"]);
  for (const absent of ["sourceHash", "dangerouslySetInnerHTML", "Supprimer", "useMutation"]) assert.equal(page.includes(absent), false, absent);
  const client = readFileSync("src/features/admin/contact-messages.ts", "utf8");
  assert.equal(client.includes('fetch(`/api/admin/contact-messages?${params.toString()}`, { cache: "no-store" })'), true);
  assert.equal(/method:/.test(client), false, "aucune écriture");
});
