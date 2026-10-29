import assert from "node:assert/strict";
import test from "node:test";
import { renderSupabaseAuthTemplate, renderTextEmailHtml } from "../src/lib/email/email-template";
import { sendTransactionalEmail } from "../src/lib/email/transactional-email";

test("le HTML échappe le contenu métier et ne lie que les URL http(s)", () => {
  const html = renderTextEmailHtml({
    subject: "Facture <b>F-1</b>",
    text: "Société <script>alert(1)</script> & fils\njavascript:alert(1) https://app.example.test/x?a=1&b=2.",
  });
  assert.ok(!html.includes("<script>"));
  assert.ok(!html.includes("<b>F-1</b>"));
  assert.match(html, /Facture &lt;b&gt;F-1&lt;\/b&gt;/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt; &amp; fils/);
  assert.ok(!/href="javascript:/i.test(html));
  assert.match(html, /href="https:\/\/app\.example\.test\/x\?a=1&amp;b=2"/);
  assert.ok(!html.includes('b=2."'), "la ponctuation finale reste hors du lien");
});

test("la ligne « Libellé : URL » devient le bouton principal, le reste garde ses paragraphes", () => {
  const html = renderTextEmailHtml({
    subject: "Livraison effectuée",
    text: "La livraison L-42 est terminée.\nPreuve de livraison (signature, photo, PDF) : https://app.example.test/portal/deliveries/d1\n\nL’équipe TutelLiv",
  });
  assert.match(html, /<a href="https:\/\/app\.example\.test\/portal\/deliveries\/d1"[^>]*>Preuve de livraison \(signature, photo, PDF\)<\/a>/);
  assert.equal((html.match(/<p /g) ?? []).length, 3, "deux paragraphes + lien de secours");
  assert.match(html, /L’équipe TutelLiv/);
  assert.ok(!html.includes("Message de recette"));
  assert.equal(html, renderTextEmailHtml({
    subject: "Livraison effectuée",
    text: "La livraison L-42 est terminée.\nPreuve de livraison (signature, photo, PDF) : https://app.example.test/portal/deliveries/d1\n\nL’équipe TutelLiv",
  }), "rendu déterministe pour une reprise sous la même clé");
});

test("le transport envoie texte et HTML ; le mode test affiche le bandeau de recette", async () => {
  let body: Record<string, unknown> = {};
  await sendTransactionalEmail(
    { to: "client@example.test", subject: "Bienvenue sur TutelLiv", text: "Bonjour,", idempotencyKey: "k:1", replayWindowStart: null },
    {
      env: { EMAIL_DELIVERY_MODE: "test", EMAIL_TEST_RECIPIENT: "owner@example.test", RESEND_API_KEY: "test-key", MAIL_FROM: "TutelLiv <no-reply@example.test>" },
      signal: new AbortController().signal,
      fetcher: async (_url, init) => {
        body = JSON.parse(String(init?.body));
        return { ok: true, status: 200 };
      },
    }
  );
  assert.equal(typeof body.text, "string");
  assert.match(String(body.html), /^<!doctype html>/);
  assert.match(String(body.html), /Message de recette TutelLiv destiné à client@example\.test/);
  assert.match(String(body.html), /<h1[^>]*>Bienvenue sur TutelLiv<\/h1>/);
});

test("les modèles Supabase pointent vers /reset-password avec le TokenHash et le bon type", () => {
  for (const type of ["signup", "invite", "recovery"] as const) {
    const { subject, html } = renderSupabaseAuthTemplate(type);
    assert.ok(subject.includes("TutelLiv"));
    assert.ok(html.includes(`href="{{ .SiteURL }}/reset-password#token_hash={{ .TokenHash }}&amp;type=${type}"`), type);
    assert.ok(!html.includes("ConfirmationURL"));
    assert.ok(!/<img/i.test(html), "aucune image distante ni pixel de suivi");
  }
});
