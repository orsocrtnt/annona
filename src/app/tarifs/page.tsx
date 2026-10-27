import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check, Gauge, Sparkles, Users } from "lucide-react";
import { APP_NAME } from "@/lib/constants";
import { toPublicPricing } from "@/domains/growth/public-pricing";
import { getActiveSignupCatalog } from "@/domains/signup/signup.service";
import { GrowthShell } from "@/features/landing/growth-shell";

export const metadata: Metadata = {
  title: `Tarifs — ${APP_NAME}`,
  description: "Formules Starter, Pro et Business lues sur le catalogue actif.",
};

const euro = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });

function money(cents: number) {
  return euro.format(cents / 100);
}

function cap(value: number | null) {
  return value == null ? "non chiffré" : String(value);
}

const planTone = {
  STARTER: {
    eyebrow: "Pour démarrer",
    border: "border-[#d9e3ea]",
    wash: "from-[#eef4f7] to-white",
    icon: "bg-[#dfeaf1] text-[#3d5a73]",
  },
  PRO: {
    eyebrow: "Pour structurer",
    border: "border-[#b9c9d6]",
    wash: "from-[#e2edf3] to-white",
    icon: "bg-[#3d5a73] text-white",
  },
  BUSINESS: {
    eyebrow: "Pour aller plus loin",
    border: "border-[#ded5c9]",
    wash: "from-[#f3ebe2] to-white",
    icon: "bg-[#eadfce] text-[#765d42]",
  },
} as const;

export default async function TarifsPage() {
  try {
    const pricing = toPublicPricing(await getActiveSignupCatalog());
    return (
      <GrowthShell active="tarifs">
        <main id="main-content" tabIndex={-1} className="pb-20">
          <section className="mx-auto max-w-4xl px-5 pb-12 pt-14 text-center sm:px-6 sm:pb-16 sm:pt-20">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#d8dee6] bg-white/80 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.16em] text-[#3d5a73] shadow-sm">
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
              Des formules lisibles
            </div>
            <h1 className="mx-auto mt-6 max-w-3xl text-balance text-4xl font-bold tracking-[-0.04em] text-[#172334] sm:text-5xl lg:text-6xl">
              Choisissez le rythme qui vous ressemble.
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-[#617080] sm:text-lg">
              Trois formules pour organiser les commandes, le dispatch et le suivi — sans cacher les quotas ni les options.
            </p>
            <p className="mt-4 text-xs font-medium text-[#7a8694]">
              {`Catalogue ${pricing.catalogCode} · Prix HT · TVA ${pricing.vatRateBps / 100} % · TTC indicatif sur la formule seule`}
            </p>
          </section>

          <section aria-label="Formules" className="mx-auto grid max-w-6xl gap-5 px-5 sm:px-6 lg:grid-cols-3 lg:items-stretch">
            {pricing.plans.map((plan) => {
              const tone = planTone[plan.code];
              return (
                <article
                  key={plan.code}
                  className={`flex h-full flex-col overflow-hidden rounded-[1.75rem] border ${tone.border} bg-gradient-to-b ${tone.wash} p-5 shadow-[0_18px_60px_rgba(36,52,71,0.08)] sm:p-6`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#6b7785]">{tone.eyebrow}</p>
                      <h2 className="mt-2 text-2xl font-bold tracking-tight text-[#172334]">{plan.name}</h2>
                    </div>
                    <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${tone.icon}`} aria-hidden>
                      <Gauge className="h-5 w-5" strokeWidth={1.8} />
                    </span>
                  </div>

                  <div className="mt-6 border-b border-[#d8dee6] pb-6">
                    <div className="flex items-end gap-2">
                      <strong className="text-4xl font-bold tracking-[-0.05em] text-[#172334]">{money(plan.monthlyHtCents)}</strong>
                      <span className="pb-1 text-sm font-medium text-[#697786]">HT / mois</span>
                    </div>
                    <p className="mt-2 text-sm text-[#697786]">{money(plan.annualHtCents)} HT / an</p>
                    <p className="mt-1 text-xs text-[#85909c]">
                      {money(plan.monthlyTtcCents)} TTC / mois · {money(plan.annualTtcCents)} TTC / an
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 py-5">
                    <div className="rounded-2xl border border-white/80 bg-white/70 p-3">
                      <Users className="h-4 w-4 text-[#3d5a73]" aria-hidden />
                      <p className="mt-2 text-xs text-[#6b7785]">Livreurs</p>
                      <p className="mt-1 text-sm font-bold text-[#243447]">
                        {plan.unlimitedDriverSeats ? "Usage mesuré" : `${plan.includedDriverSeats} inclus`}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/80 bg-white/70 p-3">
                      <Gauge className="h-4 w-4 text-[#3d5a73]" aria-hidden />
                      <p className="mt-2 text-xs text-[#6b7785]">Commandes</p>
                      <p className="mt-1 text-sm font-bold text-[#243447]">{plan.includedMonthlyOrders} / mois</p>
                    </div>
                  </div>

                  <div className="space-y-3 text-sm text-[#425263]">
                    <p className="flex gap-2.5">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#3d7a62]" aria-hidden />
                      <span>
                        {plan.unlimitedDriverSeats
                          ? "Livreurs en usage mesuré, plafond non chiffré dans le catalogue."
                          : `Plafond de ${cap(plan.maxDriverSeats)} livreurs.`}
                      </span>
                    </p>
                    <p className="flex gap-2.5">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#3d7a62]" aria-hidden />
                      <span>Admins : {plan.includedAdminSeats} inclus, plafond {cap(plan.maxAdminSeats)}.</span>
                    </p>
                    <p className="flex gap-2.5">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#3d7a62]" aria-hidden />
                      <span>Dispatchers : {plan.includedDispatcherSeats} inclus, plafond {cap(plan.maxDispatcherSeats)}.</span>
                    </p>
                    <p className="flex gap-2.5">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#3d7a62]" aria-hidden />
                      <span>Dépassement commande : {money(plan.orderOverageUnitPriceCents)} HT.</span>
                    </p>
                  </div>

                  <div className="mt-5 rounded-2xl bg-white/75 p-4 ring-1 ring-[#dfe4e9]">
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#6b7785]">Fonctions incluses</p>
                    <p className="mt-2 text-sm leading-6 text-[#425263]">
                      {plan.includedFeatureLabels.length === 0
                        ? "Aucune fonction premium incluse."
                        : plan.includedFeatureLabels.join(" · ")}
                    </p>
                  </div>

                  <div className="mt-3 rounded-2xl bg-white/75 p-4 ring-1 ring-[#dfe4e9]">
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#6b7785]">Options disponibles</p>
                    {plan.options.length === 0 ? (
                      <p className="mt-2 text-sm text-[#425263]">Aucune option en plus de la formule.</p>
                    ) : (
                      <ul className="mt-2 space-y-2 text-sm text-[#425263]">
                        {plan.options.map((option) => (
                          <li key={option.code} className="border-t border-[#e4e8ec] pt-2 first:border-0 first:pt-0">
                            <span className="font-semibold text-[#243447]">{option.name}</span>
                            <span className="block text-xs text-[#758290]">
                              {money(option.monthlyPriceCents)} HT / mois · {money(option.annualPriceCents)} HT / an
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="mt-3 min-h-24 rounded-2xl bg-[#243447] p-4 text-white">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-white/65">
                      <Sparkles className="h-3.5 w-3.5" aria-hidden />
                      Découverte
                    </div>
                    <p className="mt-2 text-sm leading-6 text-white/85">
                      {plan.discovery
                        ? `${pricing.discoveryDays} jours avec ${pricing.discoveryFeatures.join(", ")}. Les quotas restent ceux de la formule.`
                        : "Pas de découverte premium sur cette formule."}
                    </p>
                  </div>

                  <div className="mt-auto grid gap-2 pt-5">
                    <Link
                      className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#243447] px-4 py-3 text-center text-sm font-bold text-white shadow-sm transition-[transform,background-color] hover:bg-[#182535] active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3d5a73] focus-visible:ring-offset-2"
                      href={`/register?plan=${plan.code}&interval=MONTHLY`}
                    >
                      Choisir {plan.name} au mois
                      <ArrowRight className="h-4 w-4" aria-hidden />
                    </Link>
                    <Link
                      className="inline-flex min-h-12 items-center justify-center rounded-xl border border-[#cdd5dd] bg-white px-4 py-3 text-center text-sm font-bold text-[#243447] transition-colors hover:bg-[#f3f6f8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3d5a73] focus-visible:ring-offset-2"
                      href={`/register?plan=${plan.code}&interval=ANNUAL`}
                    >
                      Choisir à l’année
                    </Link>
                  </div>
                </article>
              );
            })}
          </section>

          <section className="mx-auto mt-12 max-w-6xl px-5 sm:px-6">
            <div className="rounded-[1.75rem] border border-[#d8dee6] bg-white/85 p-6 shadow-sm sm:p-8">
              <div className="grid gap-6 md:grid-cols-[0.8fr_1.2fr] md:items-start">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#3d5a73]">Bon à savoir</p>
                  <h2 className="mt-3 text-2xl font-bold tracking-tight text-[#172334]">Les règles restent simples.</h2>
                </div>
                <div className="grid gap-4 text-sm leading-6 text-[#5f6d7b] sm:grid-cols-3">
                  <p>Le pilote gratuit est créé à part. Ce n’est pas une formule du catalogue et cette page ne le déclenche pas.</p>
                  <p>La découverte premium concerne Starter et Pro. Business et l’assistance prioritaire n’en font pas partie.</p>
                  <p>L’inscription utilise le parcours fictif déjà en place. Aucun encaissement fournisseur n’est lancé ici.</p>
                </div>
              </div>
            </div>
          </section>

          <div className="mx-auto mt-8 max-w-6xl px-5 text-center sm:px-6">
            <Link href="/" className="text-sm font-semibold text-[#506070] underline decoration-[#aab6c1] underline-offset-4 hover:text-[#243447]">
              Retour à l’accueil
            </Link>
          </div>
        </main>
      </GrowthShell>
    );
  } catch {
    return (
      <GrowthShell active="tarifs">
        <main id="main-content" tabIndex={-1} className="mx-auto flex min-h-[60vh] max-w-3xl items-center px-5 py-16 sm:px-6">
          <div className="w-full rounded-[1.75rem] border border-[#d8dee6] bg-white p-8 text-center shadow-sm">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#e8eef3] text-[#3d5a73]" aria-hidden>
              <Gauge className="h-6 w-6" />
            </div>
            <h1 className="mt-5 text-3xl font-bold tracking-tight">Tarifs</h1>
            <p className="mt-3 text-[#667382]">Les tarifs sont indisponibles.</p>
            <p className="mt-6">
              <Link className="font-semibold text-[#3d5a73] underline underline-offset-4" href="/">Retour à l’accueil</Link>
            </p>
          </div>
        </main>
      </GrowthShell>
    );
  }
}
