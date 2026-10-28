import assert from "node:assert/strict";
import test from "node:test";
import { z } from "zod";
import { NextResponse } from "next/server";
import { ApiRouteError, withApiHandler } from "../src/lib/api/route-handler";

// SEC-3 : seules les erreurs métier connues sont renvoyées au client ;
// le détail technique reste dans le journal serveur.
async function run(t: test.TestContext, error: unknown) {
  const logged: unknown[][] = [];
  t.mock.method(console, "error", (...args: unknown[]) => { logged.push(args); });
  const response = await withApiHandler(async () => { throw error; });
  return { status: response.status, body: await response.json() as { error: string; success: boolean }, logged };
}

test("erreur technique (Prisma, connexion) : message générique, détail seulement dans le journal", async (t) => {
  const internal = new Error("Invalid `prisma.user.findMany()` invocation: Can't reach database server at db.internal:5432");
  const { status, body, logged } = await run(t, internal);
  assert.equal(status, 500);
  assert.equal(body.error, "Erreur interne du serveur");
  assert.equal(body.success, false);
  assert.doesNotMatch(JSON.stringify(body), /prisma|5432|invocation/);
  assert.equal(logged.length, 1);
  assert.equal(logged[0]![1], internal);
});

test("code métier interne non répertorié : jamais renvoyé brut", async (t) => {
  const { status, body } = await run(t, new Error("DELIVERY_ASSIGNMENT_CONFLICT"));
  assert.equal(status, 500);
  assert.equal(body.error, "Erreur interne du serveur");
});

test("valeur non Error levée : message générique", async (t) => {
  const { status, body } = await run(t, "secret-string");
  assert.equal(status, 500);
  assert.equal(body.error, "Erreur interne du serveur");
});

test("ApiRouteError : message destiné à l'utilisateur et statut conservés", async (t) => {
  const { status, body } = await run(t, new ApiRouteError("Adresse introuvable.", 404));
  assert.equal(status, 404);
  assert.equal(body.error, "Adresse introuvable.");
  const fallback = await run(t, new ApiRouteError("Données invalides."));
  assert.equal(fallback.status, 400);
});

test("codes connus : traduits en français avec le bon statut", async (t) => {
  for (const [code, expected] of [
    ["SAAS_FEATURE_NOT_AVAILABLE", 403],
    ["SAAS_ACCOUNT_READ_ONLY", 403],
    ["ACCOUNT_UNAVAILABLE", 403],
    ["COMPANY_NOT_FOUND", 404],
  ] as const) {
    const { status, body } = await run(t, new Error(code));
    assert.equal(status, expected, code);
    assert.doesNotMatch(body.error, /^[A-Z_]+$/, code);
  }
});

test("ZodError et JSON invalide : 400 sans détail interne", async (t) => {
  const parsed = z.object({ id: z.string() }).strict().safeParse({ id: 1, extra: true });
  assert.equal(parsed.success, false);
  const zod = await run(t, parsed.error);
  assert.equal(zod.status, 400);
  assert.equal(zod.body.error, "Données invalides.");
  let syntax: unknown;
  try { JSON.parse("{"); } catch (error) { syntax = error; }
  const json = await run(t, syntax);
  assert.equal(json.status, 400);
  assert.doesNotMatch(json.body.error, /JSON at position|Unexpected/);
});

test("succès : réponse inchangée", async () => {
  const response = await withApiHandler(async () => NextResponse.json({ ok: true }, { status: 201 }));
  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), { ok: true });
});
