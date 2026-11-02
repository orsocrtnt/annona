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
  sendContactAlert,
  submitContactMessage,
} from "../src/domains/growth/contact.service";

const secret = "test-secret";
const now = new Date("2026-10-27T10:00:00.000Z");
const valid = { name: "Camille Martin", email: " Camille@Example.invalid ", company: "Transports Exemple", phone: "+33 6 00 00 00 00", message: "Nous livrons 300 colis par jour, pouvez-vous nous rappeler ?" };

function memoryDb(existing: Array<{ sourceHash: string; createdAt: Date }> = []) {
  const rows = [...existing] as Array<Record<string, unknown> & { sourceHash: string; createdAt: Date }>;
  const counts: Array<Record<string, unknown>> = [];
  const events: string[] = [];
  // Comme PostgreSQL : un tour de boucle entre lecture et écriture laisse les envois s'entrelacer.
  const tick = () => new Promise((done) => setImmediate(done));
  const contactMessage = {
    count: async ({ where }: { where: { sourceHash?: string; createdAt: { gte: Date } } }) => {
      counts.push(where);
      events.push("count");
      await tick();
      return rows.filter((row) => row.createdAt >= where.createdAt.gte && (!where.sourceHash || row.sourceHash === where.sourceHash)).length;
    },
    create: async ({ data }: { data: Record<string, unknown> & { sourceHash: string } }) => {
      events.push("create");
      await tick();
      rows.push({ ...data, createdAt: now });
      return { id: `message-${rows.length}`, ...data };
    },
  };
  // Verrou consultatif simulé : acquis par la requête brute, relâché à la fin de la transaction.
  let tail: Promise<void> = Promise.resolve();
  return {
    rows,
    counts,
    events,
    db: {
      contactMessage,
      $transaction: async <T>(fn: (tx: unknown) => Promise<T>) => {
        let release = () => {};
        const tx = {
          contactMessage,
          $queryRaw: async (strings: TemplateStringsArray) => {
            events.push(`lock:${strings.join("?")}`);
            const previous = tail;
            tail = new Promise<void>((done) => { release = done; });
            await previous;
            return [{ locked: 1 }];
          },
        };
        try {
          return await fn(tx);
        } finally {
          release();
        }
      },
    } as never,
  };
}

test("GROWTH-1 contact : un message valide est normalisé et stocké sans adresse IP", async () => {
  const memory = memoryDb();
  const accepted = await submitContactMessage(valid, "203.0.113.7", { now, secret, db: memory.db });
  assert.deepEqual(accepted, {
    status: "accepted",
    stored: {
      id: "message-1",
      name: "Camille Martin",
      email: "camille@example.invalid",
      company: "Transports Exemple",
      phone: "+33 6 00 00 00 00",
      message: valid.message,
    },
  });
  assert.equal(JSON.stringify(accepted).includes("sourceHash"), false, "l'empreinte ne sort pas du service");
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
  assert.equal((await submitContactMessage(valid, "192.0.2.10", { now, secret, db: limited.db })).status, "accepted", "une autre source passe");

  const old = memoryDb(Array.from({ length: CONTACT_SOURCE_LIMIT }, () => ({ sourceHash, createdAt: new Date(now.getTime() - CONTACT_WINDOW_MS - 1) })));
  assert.equal((await submitContactMessage(valid, "192.0.2.9", { now, secret, db: old.db })).status, "accepted", "la fenêtre est glissante");

  const flood = memoryDb(Array.from({ length: CONTACT_GLOBAL_LIMIT }, (_, index) => ({ sourceHash: `other-${index}`, createdAt: now })));
  assert.deepEqual(await submitContactMessage(valid, "192.0.2.11", { now, secret, db: flood.db }), { status: "rate_limited" });
});

test("GROWTH-1 contact : des envois simultanés ne dépassent ni la limite par source ni la limite globale", async () => {
  // PERF-02 du 27 octobre : 56 envois acceptés sur une rafale de 60 pour une limite de 50.
  const burst = memoryDb();
  const results = await Promise.all(Array.from({ length: 8 }, () => submitContactMessage(valid, "192.0.2.20", { now, secret, db: burst.db })));
  assert.equal(results.filter((result) => result.status === "accepted").length, CONTACT_SOURCE_LIMIT);
  assert.equal(burst.rows.length, CONTACT_SOURCE_LIMIT);
  assert.match(burst.events[0]!, /^lock:SELECT 1 AS locked FROM pg_advisory_xact_lock\(hashtext\('tutelliv:contact-rate-limit'\)\)$/);
  assert.ok(burst.events.every((event, index) => event !== "count" || burst.events.slice(0, index).some((earlier) => earlier.startsWith("lock:"))), "aucun comptage hors verrou");

  const global = memoryDb(Array.from({ length: CONTACT_GLOBAL_LIMIT - 2 }, (_, index) => ({ sourceHash: `other-${index}`, createdAt: now })));
  const spread = await Promise.all(Array.from({ length: 8 }, (_, index) => submitContactMessage(valid, `192.0.2.${30 + index}`, { now, secret, db: global.db })));
  assert.equal(spread.filter((result) => result.status === "accepted").length, 2);
  assert.equal(global.rows.length, CONTACT_GLOBAL_LIMIT);
});

test("GROWTH-1 contact : empreinte à secret obligatoire et source lue sur le proxy", async () => {
  assert.notEqual(contactSourceHash("192.0.2.1", "a"), contactSourceHash("192.0.2.1", "b"));
  assert.match(contactSourceHash("192.0.2.1", secret), /^[a-f0-9]{64}$/);
  await assert.rejects(submitContactMessage(valid, "192.0.2.1", { now, secret: "", db: memoryDb().db }), /CONTACT_SOURCE_SECRET_MISSING/);
  // Vercel écrase l'en-tête : une seule adresse, celle du client.
  assert.equal(contactSourceFromHeaders(new Headers({ "x-forwarded-for": "203.0.113.5" })), "203.0.113.5");
  assert.equal(contactSourceFromHeaders(new Headers({ "x-forwarded-for": "203.0.113.5, 198.51.100.7 " })), "198.51.100.7");
  assert.equal(contactSourceFromHeaders(new Headers({ "x-real-ip": "203.0.113.6" })), "203.0.113.6");
  assert.equal(contactSourceFromHeaders(new Headers({ "x-forwarded-for": " , ", "x-real-ip": "203.0.113.6" })), "203.0.113.6");
  assert.equal(contactSourceFromHeaders(new Headers()), "unknown");
});

test("GROWTH-1 contact : une adresse forgée à gauche de x-forwarded-for ne contourne pas le débit", async () => {
  // Derrière un proxy qui ajoute au lieu d'écraser, seule l'adresse de droite est fiable.
  const { db } = memoryDb();
  const results = [];
  for (let index = 0; index < CONTACT_SOURCE_LIMIT + 1; index += 1) {
    const source = contactSourceFromHeaders(new Headers({ "x-forwarded-for": `192.0.2.${index}, 198.51.100.7` }));
    results.push((await submitContactMessage(valid, source, { now, secret, db })).status);
  }
  assert.deepEqual(results, [...Array(CONTACT_SOURCE_LIMIT).fill("accepted"), "rate_limited"]);
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
  for (const [outcome, status] of [["accepted", 202], ["stored", 202], ["invalid", 400], ["rate_limited", 429], ["throw", 503]] as const) {
    const module = { exports: {} as { POST: (request: Request) => Promise<Response> } };
    const seen: string[] = [];
    const deferred: Array<() => Promise<void>> = [];
    const alerted: unknown[] = [];
    const storedMessage = { id: "message-1", name: "Camille", email: "c@example.invalid", company: null, phone: null, message: "Bonjour, un message." };
    runInNewContext(source, {
      module, exports: module.exports, console: { error: () => undefined },
      require: (id: string) => {
        if (id === "next/server") return { NextResponse, after: (task: () => Promise<void>) => deferred.push(task) };
        if (id === "@/domains/growth/contact.service") return {
          sendContactAlert: async (message: unknown) => { alerted.push(message); return "sent"; },
          contactSourceFromHeaders: (headers: Headers) => headers.get("x-forwarded-for") ?? "unknown",
          submitContactMessage: async (_body: unknown, from: string) => {
            seen.push(from);
            if (outcome === "throw") throw new Error("db down: secret detail");
            if (outcome === "stored") return { status: "accepted", stored: storedMessage };
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
    // L'alerte part après la réponse, et seulement si un message a vraiment été écrit (pas le pot de miel).
    assert.equal(alerted.length, 0, "aucun envoi avant la réponse");
    for (const task of deferred) await task();
    assert.deepEqual(alerted, outcome === "stored" ? [storedMessage] : [], outcome);
  }
});

const alertMessage = { id: "message-7", name: "Camille Martin", email: "camille@example.invalid", company: "Transports Exemple", phone: null, message: "Nous livrons 300 colis par jour." };

test("Alerte Contact : le mail part vers la boîte de l'équipe, avec le message et une clé par message", async () => {
  const sent: Array<Parameters<typeof import("../src/lib/email/transactional-email").sendTransactionalEmail>[0]> = [];
  const result = await sendContactAlert(alertMessage, {
    env: { CONTACT_ALERT_RECIPIENT: " equipe@example.invalid ", NEXT_PUBLIC_APP_URL: "https://app.example.invalid/" },
    send: (async (input) => { sent.push(input); return { status: "sent" }; }) as typeof import("../src/lib/email/transactional-email").sendTransactionalEmail,
  });
  assert.equal(result, "sent");
  assert.equal(sent.length, 1);
  assert.equal(sent[0]!.to, "equipe@example.invalid");
  assert.equal(sent[0]!.subject, "Nouveau message Contact : Transports Exemple");
  assert.equal(sent[0]!.idempotencyKey, "contact-message:message-7");
  assert.equal(sent[0]!.replayWindowStart, null);
  for (const part of ["Camille Martin", "camille@example.invalid", "non indiqué", "Nous livrons 300 colis", "https://app.example.invalid/admin/contact"]) {
    assert.equal(sent[0]!.text.includes(part), true, part);
  }
});

test("Alerte Contact : sans destinataire ou e-mails coupés, rien ne part et rien ne casse", async () => {
  let calls = 0;
  const send = (async () => { calls += 1; return { status: "disabled", mode: "disabled", reason: "disabled" }; }) as unknown as typeof import("../src/lib/email/transactional-email").sendTransactionalEmail;
  assert.equal(await sendContactAlert(alertMessage, { env: {}, send }), "skipped");
  assert.equal(calls, 0, "aucun destinataire : aucun appel");
  assert.equal(await sendContactAlert(alertMessage, { env: { CONTACT_ALERT_RECIPIENT: "equipe@example.invalid" }, send }), "skipped");
  assert.equal(calls, 1);
});

test("Alerte Contact : la boîte dédiée passe avant la boîte de recette", async () => {
  const targets: string[] = [];
  const send = (async (input: { to: string }) => { targets.push(input.to); return { status: "sent" }; }) as unknown as typeof import("../src/lib/email/transactional-email").sendTransactionalEmail;
  await sendContactAlert(alertMessage, { env: { EMAIL_TEST_RECIPIENT: "recette@example.invalid" }, send });
  await sendContactAlert(alertMessage, { env: { CONTACT_ALERT_RECIPIENT: "equipe@example.invalid", EMAIL_TEST_RECIPIENT: "recette@example.invalid" }, send });
  assert.deepEqual(targets, ["recette@example.invalid", "equipe@example.invalid"]);
});

test("Alerte Contact : une panne d'envoi n'est jamais remontée au visiteur et ne journalise pas le message", async () => {
  const logged: unknown[][] = [];
  const original = console.error;
  console.error = (...args: unknown[]) => { logged.push(args); };
  try {
    const result = await sendContactAlert(alertMessage, {
      env: { CONTACT_ALERT_RECIPIENT: "equipe@example.invalid" },
      send: (async () => { throw new Error("EMAIL_PROVIDER_DOWN"); }) as unknown as typeof import("../src/lib/email/transactional-email").sendTransactionalEmail,
    });
    assert.equal(result, "failed");
  } finally {
    console.error = original;
  }
  assert.equal(JSON.stringify(logged).includes("camille@example.invalid"), false);
  assert.equal(JSON.stringify(logged).includes("EMAIL_PROVIDER_DOWN"), true);
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
