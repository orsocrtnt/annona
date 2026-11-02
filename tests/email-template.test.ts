import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { renderSupabaseAuthTemplate, renderTextEmailHtml } from "../src/lib/email/email-template";
import { sendTransactionalEmail } from "../src/lib/email/transactional-email";

test("le HTML échappe le contenu métier et ne lie que les URL http(s)", () => {
  const html = renderTextEmailHtml({
    subject: "Facture <b>F-1</b>",
    text: "Société <script>alert(1)</script> & fils\njavascript:alert(1) https://app.example.test/x?a=1&b=2.",
  });
  assert.ok(!html.includes("<script>"));
  assert.ok(!html.includes("<b>F-1</b>"));
  assert.match(html, /&lt;b&gt;F-1&lt;\/b&gt;/);
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
  assert.match(html, /Si le bouton ne fonctionne pas/);
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
  assert.match(String(body.html), /Tout est prêt/);
});

test("les modèles Supabase pointent vers /reset-password avec le TokenHash et le bon type", () => {
  for (const type of ["signup", "invite", "recovery"] as const) {
    const { subject, html } = renderSupabaseAuthTemplate(type);
    assert.ok(subject.includes("TutelLiv"));
    assert.ok(html.includes(`href="{{ .SiteURL }}/reset-password#token_hash={{ .TokenHash }}&amp;type=${type}"`), type);
    assert.ok(!html.includes("ConfirmationURL"));
    assert.match(html, /<img[^>]+alt="TutelLiv"/);
    assert.equal((html.match(/<img /g) ?? []).length, 1, "logo seul, aucun pixel de suivi");
  }
});


test("les mails reconnus ont leur titre et leur statut sans inventer de données métier", () => {
  const variants = [
    ["Livreur assigné", "Un livreur pour votre livraison.", "LIVREUR ASSIGNÉ"],
    ["Prise en charge", "Votre livraison est prise en charge.", "PRISE EN CHARGE"],
    ["Courses en cours", "Vos courses ont commencé.", "COURSES EN COURS"],
    ["En cours de livraison", "Votre livraison est en route.", "EN COURS DE LIVRAISON"],
    ["Livraison effectuée", "Votre livraison est arrivée.", "LIVRAISON EFFECTUÉE"],
    ["Livraison annulée", "Votre livraison a été annulée.", "LIVRAISON ANNULÉE"],
    ["Livraison non effectuée", "Votre livraison n’a pas pu aboutir.", "LIVRAISON NON EFFECTUÉE"],
    ["Bienvenue sur TutelLiv", "Tout est prêt. À vous de jouer.", "BIENVENUE"],
    ["Facture F-42", "Votre facture est disponible.", "FACTURATION"],
    ["Rappel : facture F-42", "Un rappel pour votre facture.", "RAPPEL DE PAIEMENT"],
  ];
  for (const [subject, heading, badge] of variants) {
    const html = renderTextEmailHtml({ subject: subject!, text: "Contenu réel conservé." });
    assert.ok(html.includes(heading!), subject);
    assert.ok(html.includes(badge!), subject);
    assert.ok(html.includes("Contenu réel conservé."));
    assert.ok(!html.includes("Camille") && !html.includes("148,00"));
    assert.match(html, /alt="TutelLiv"/);
  }
  const unknown = renderTextEmailHtml({ subject: "Information personnalisée", text: "Texte" });
  assert.match(unknown, /<h1[^>]*>Information personnalisée<\/h1>/);
});

test("le récapitulatif utilise les valeurs de la facture et échappe les références", () => {
  const html = renderTextEmailHtml({ subject: "Facture F-<42>", text: "La facture F-<42> (215,80 €) est disponible." });
  assert.ok(!html.includes("F-<42>"));
  assert.match(html, /Référence/);
  assert.match(html, /F-&lt;42&gt;/);
  assert.match(html, /Montant/);
  assert.match(html, /215,80 €/);
});

test("les liens Auth restent propres à chaque type et les mentions de sécurité subsistent", () => {
  for (const type of ["signup", "invite", "recovery"] as const) {
    const { html } = renderSupabaseAuthTemplate(type);
    assert.match(html, /personnel, temporaire et à usage unique/);
    assert.match(html, /background:#0e1310/);
    assert.ok(html.includes(`&amp;type=${type}`));
  }
});


test("la bienvenue reprend entreprise et formule présentes sans en inventer", () => {
  const html = renderTextEmailHtml({ subject: "Bienvenue sur TutelLiv", text: "Votre espace Société <Exemple> est prêt avec l’offre STARTER (annuel)." });
  assert.match(html, /Entreprise/);
  assert.match(html, /Société &lt;Exemple&gt;/);
  assert.match(html, /Facturation/);
  assert.match(html, /Annuelle/);
  const incomplete = renderTextEmailHtml({ subject: "Bienvenue sur TutelLiv", text: "Bonjour" });
  assert.ok(!incomplete.includes("Entreprise") && !incomplete.includes("STARTER"));
});

test("le logo garde un fond clair dédié sans imposer le thème clair au contenu", () => {
  const renders = [
    renderTextEmailHtml({ subject: "Bienvenue sur TutelLiv", text: "Bonjour" }),
    ...(["signup", "invite", "recovery"] as const).map(type => renderSupabaseAuthTemplate(type).html),
  ];
  for (const html of renders) {
    assert.match(html, /<td class="email-logo-header" align="center" bgcolor="#ffffff"[^>]+background-image:linear-gradient\(#ffffff,#ffffff\)[^>]*><img[^>]+alt="TutelLiv"/);
    assert.equal((html.match(/background-image:linear-gradient/g) ?? []).length, 1, "protection limitée au logo");
    assert.equal((html.match(/<img /g) ?? []).length, 1, "pas de second logo caché ni de pixel");
  }
});

test("le bandeau du logo est une image blanche pleine largeur, pour rester blanc dans Outlook", async () => {
  const renders = [
    renderTextEmailHtml({ subject: "Bienvenue sur TutelLiv", text: "Bonjour" }),
    ...(["signup", "invite", "recovery"] as const).map(type => renderSupabaseAuthTemplate(type).html),
  ];
  for (const html of renders) {
    assert.match(html, /<img src="https:\/\/tutelliv\.fr\/brand\/email-bandeau-logo\.png" width="558" height="99" alt="TutelLiv" style="display:block;width:100%;/);
    assert.match(html, /class="email-logo-header"[^>]+border-bottom:1px solid #e4e8e5/, "bandeau visible aussi sur une carte blanche");
  }
  const metadata = await sharp("public/brand/email-bandeau-logo.png").metadata();
  assert.deepEqual([metadata.width, metadata.height, metadata.hasAlpha], [1116, 198, false]);
});
