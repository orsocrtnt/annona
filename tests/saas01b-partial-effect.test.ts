import assert from "node:assert/strict";
import test from "node:test";
import { loadBilling } from "./helpers/billing-loader";

const { stripe } = loadBilling();
const env: NodeJS.ProcessEnv = { NODE_ENV: "test", SIGNUP_PAYMENT_ADAPTER: "stripe-sandbox", STRIPE_SECRET_KEY: "sk_test_unit_only", STRIPE_WEBHOOK_SECRET: "whsec_unit_only" };
const target = { hash: "target", quote: { planName: "Starter", catalogCode: "C9", totalHtCents: 7900, billingInterval: "MONTHLY", vatRateBps: 2000 } } as never;

// Fournisseur simulé : `reject` désigne la requête POST refusée en 400.
function provider(reject: string | null, schedule: string | null = null) {
  const posts: string[] = [];
  const fetcher = async (url: string | URL, init?: RequestInit) => {
    const path = new URL(String(url)).pathname.replace("/v1/", "");
    if ((init?.method ?? "GET") === "GET") {
      return Response.json({ id: "sub_test", livemode: false, schedule, pending_update: null, cancel_at_period_end: false, items: { data: [{ id: "si", price: { id: "price_old" }, quantity: 1 }] } });
    }
    posts.push(path);
    if (path === reject) return Response.json({ error: { message: "refusé" } }, { status: 400 });
    return Response.json({ id: path === "subscription_schedules" ? "sched_new" : `obj_${posts.length}`, livemode: false, current_phase: { start_date: 1, end_date: 2 } });
  };
  return { posts, billing: new stripe.StripeSandboxProvider(fetcher as typeof fetch, env) };
}

test("SAAS-01B : un refus de la première étape d'un changement au renouvellement n'a rien appliqué", async () => {
  const { billing, posts } = provider("subscription_schedules");
  await assert.rejects(billing.schedule("sub_test", target, "key"), /^Error: BILLING_PROVIDER_REJECTED$/);
  assert.deepEqual(posts, ["subscription_schedules"]);
});

test("SAAS-01B : un refus après la création du calendrier signale un effet partiel", async () => {
  const { billing, posts } = provider("subscription_schedules/sched_new");
  await assert.rejects(billing.schedule("sub_test", target, "key"), /^Error: BILLING_PARTIAL_EFFECT$/);
  assert.equal(posts[0], "subscription_schedules", "le calendrier existe déjà chez le fournisseur");
  const prices = provider("prices");
  await assert.rejects(prices.billing.schedule("sub_test", target, "key"), /^Error: BILLING_PARTIAL_EFFECT$/, "le prix cible est créé après le calendrier");
});

test("SAAS-01B : résiliation refusée sans calendrier = rien appliqué ; après libération du calendrier = effet partiel", async () => {
  const simple = provider("subscriptions/sub_test");
  await assert.rejects(simple.billing.cancel("sub_test", "key"), /^Error: BILLING_PROVIDER_REJECTED$/);
  const released = provider("subscriptions/sub_test", "sched_old");
  await assert.rejects(released.billing.cancel("sub_test", "key"), /^Error: BILLING_PARTIAL_EFFECT$/);
  assert.deepEqual(released.posts, ["subscription_schedules/sched_old/release", "subscriptions/sub_test"]);
  const releaseRefused = provider("subscription_schedules/sched_old/release", "sched_old");
  await assert.rejects(releaseRefused.billing.cancel("sub_test", "key"), /^Error: BILLING_PROVIDER_REJECTED$/, "rien n'est appliqué si la libération elle-même est refusée");
});
