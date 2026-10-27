import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check, ChevronDown, Gauge, Sparkles, Users } from "lucide-react";
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
    border: "border-[#e4e8e5]",
    wash: "from-[#eef6f1] to-white",
    icon: "bg-[#e3f7ec] text-[#08783f]",
  },
  PRO: {
    eyebrow: "Pour structurer",
    border: "border-[#8fe3b5]",
    wash: "from-[#e3f7ec] to-white",
    icon: "bg-[#08783f] text-white",
  },
  BUSINESS: {
    eyebrow: "Pour aller plus loin",
    border: "border-[#ecd6a8]",
    wash: "from-[#fdf4e4] to-white",
    icon: "bg-[#f2dfb8] text-[#7a5410]",
  },
} as const;

export default async function TarifsPage() {
  try {
    const pricing = toPublicPricing(await getActiveSignupCatalog());
    return (
      <GrowthShell active="tarifs">
        <main id="main-content" tabIndex={-1} className="pb-20">
          <section className="mx-auto max-w-4xl px-5 pb-12 pt-14 text-center sm:px-6 sm:pb-16 sm:pt-20">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#e4e8e5] bg-white/80 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.16em] text-[#08783f] shadow-sm">
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
              Des formules lisibles
            </div>
            <h1 className="mx-auto mt-6 max-w-3xl text-balance text-4xl font-bold tracking-[-0.04em] text-[#0e1310] sm:text-5xl lg:text-6xl">
              Choisissez le rythme qui vous ressemble.
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-[#68726b] sm:text-lg">
              Trois formules pour organiser les commandes, le dispatch et le suivi — sans cacher les quotas ni les options.
            </p>
            <p className="mt-4 text-xs font-medium text-[#68726b]">
              {`Catalogue ${pricing.catalogCode} · Prix HT · TVA ${pricing.vatRateBps / 100} % · TTC indicatif sur la formule seule`}
            </p>
          </section>

          <section aria-label="Formules" className="mx-auto grid max-w-6xl gap-5 px-5 sm:px-6 lg:grid-cols-3 lg:items-stretch">
            {pricing.plans.map((plan) => {
              const tone = planTone[plan.code];
              return (
                <article
                  key={plan.code}
                  className={`flex h-full flex-col overflow-hidden rounded-[1.75rem] border ${tone.border} bg-gradient-to-b ${tone.wash} p-5 shadow-[0_18px_60px_rgba(14,19,16,0.08)] sm:p-6`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#68726b]">{tone.eyebrow}</p>
                      <h2 className="mt-2 text-2xl font-bold tracking-tight text-[#0e1310]">{plan.name}</h2>
                    </div>
                    <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${tone.icon}`} aria-hidden>
                      <Gauge className="h-5 w-5" strokeWidth={1.8} />
                    </span>
                  </div>

                  <div className="mt-6 border-b border-[#e4e8e5] pb-6">
                    <div className="flex items-end gap-2">
                      <strong className="text-4xl font-bold tracking-[-0.05em] text-[#0e1310]">{money(plan.monthlyHtCents)}</strong>
                      <span className="pb-1 text-sm font-medium text-[#68726b]">HT / mois</span>
                    </div>
                    <p className="mt-2 text-sm text-[#68726b]">{money(plan.annualHtCents)} HT / an</p>
                    <p className="mt-1 text-xs text-[#68726b]">
                      {money(plan.monthlyTtcCents)} TTC / mois · {money(plan.annualTtcCents)} TTC / an
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 py-5">
                    <div className="rounded-2xl border border-white/80 bg-white/70 p-3">
                      <Users className="h-4 w-4 text-[#08783f]" aria-hidden />
                      <p className="mt-2 text-xs text-[#68726b]">Livreurs</p>
                      <p className="mt-1 text-sm font-bold text-[#0e1310]">
                        {plan.unlimitedDriverSeats ? "Usage mesuré" : `${plan.includedDriverSeats} inclus`}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/80 bg-white/70 p-3">
                      <Gauge className="h-4 w-4 text-[#08783f]" aria-hidden />
                      <p className="mt-2 text-xs text-[#68726b]">Commandes</p>
                      <p className="mt-1 text-sm font-bold text-[#0e1310]">{plan.includedMonthlyOrders} / mois</p>
                    </div>
                  </div>

                  <div className="space-y-3 text-sm text-[#3b443e]">
                    <p className="flex gap-2.5">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#08783f]" aria-hidden />
                      <span>
                        {plan.unlimitedDriverSeats
                          ? "Livreurs en usage mesuré, plafond non chiffré dans le catalogue."
                          : `Plafond de ${cap(plan.maxDriverSeats)} livreurs.`}
                      </span>
                    </p>
                    <p className="flex gap-2.5">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#08783f]" aria-hidden />
                      <span>Admins : {plan.includedAdminSeats} inclus, plafond {cap(plan.maxAdminSeats)}.</span>
                    </p>
                    <p className="flex gap-2.5">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#08783f]" aria-hidden />
                      <span>Dispatchers : {plan.includedDispatcherSeats} inclus, plafond {cap(plan.maxDispatcherSeats)}.</span>
                    </p>
                    <p className="flex gap-2.5">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#08783f]" aria-hidden />
                      <span>Dépassement commande : {money(plan.orderOverageUnitPriceCents)} HT.</span>
                    </p>
                  </div>

                  <div className="mt-5 rounded-2xl bg-white/75 p-4 ring-1 ring-[#e4e8e5]">
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#68726b]">Fonctions incluses</p>
                    <p className="mt-2 text-sm leading-6 text-[#3b443e]">
                      {plan.includedFeatureLabels.length === 0
                        ? "Aucune fonction premium incluse."
                        : plan.includedFeatureLabels.join(" · ")}
                    </p>
                  </div>

                  {/* Options repliées : la carte se lit d'abord par sa formule, le détail chiffré reste à un clic. */}
                  {plan.options.length === 0 ? (
                    <div className="mt-3 rounded-2xl bg-white/75 p-4 ring-1 ring-[#e4e8e5]">
                      <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#68726b]">Options disponibles</p>
                      <p className="mt-2 text-sm text-[#3b443e]">Aucune option en plus de la formule.</p>
                    </div>
                  ) : (
                    <details className="group mt-3 rounded-2xl bg-white/75 ring-1 ring-[#e4e8e5]">
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-2xl p-4 text-xs font-bold uppercase tracking-[0.14em] text-[#68726b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                        <span>
                          Options disponibles <span className="text-[#0e1310]">({plan.options.length})</span>
                        </span>
                        <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180 motion-reduce:transition-none" aria-hidden />
                      </summary>
                      <ul className="space-y-2 px-4 pb-4 text-sm text-[#3b443e]">
                        {plan.options.map((option) => (
                          <li key={option.code} className="border-t border-[#e4e8e5] pt-2 first:border-0 first:pt-0">
                            <span className="font-semibold text-[#0e1310]">{option.name}</span>
                            <span className="block text-xs text-[#68726b]">
                              {money(option.monthlyPriceCents)} HT / mois · {money(option.annualPriceCents)} HT / an
                            </span>
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}

                  <div className="mt-3 min-h-24 rounded-2xl bg-[#0e1310] p-4 text-white">
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
                      className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-4 py-3 text-center text-sm font-bold shadow-sm transition-[transform,background-color] active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#08783f] focus-visible:ring-offset-2 ${
                        plan.code === "PRO"
                          ? "bg-[#00d46a] text-[#0e1310] hover:bg-[#00c262]"
                          : "bg-[#0e1310] text-white hover:bg-[#232a26]"
                      }`}
                      href={`/register?plan=${plan.code}&interval=MONTHLY`}
                    >
                      Choisir {plan.name} au mois
                      <ArrowRight className="h-4 w-4" aria-hidden />
                    </Link>
                    <Link
                      className="inline-flex min-h-12 items-center justify-center rounded-xl border border-[#d5ddd8] bg-white px-4 py-3 text-center text-sm font-bold text-[#0e1310] transition-colors hover:bg-[#f0f4f1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#08783f] focus-visible:ring-offset-2"
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
            <div className="rounded-[1.75rem] border border-[#e4e8e5] bg-white/85 p-6 shadow-sm sm:p-8">
              <div className="grid gap-6 md:grid-cols-[0.8fr_1.2fr] md:items-start">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#08783f]">Bon à savoir</p>
                  <h2 className="mt-3 text-2xl font-bold tracking-tight text-[#0e1310]">Les règles restent simples.</h2>
                </div>
                <div className="grid gap-4 text-sm leading-6 text-[#4a544d] sm:grid-cols-3">
                  <p>Le pilote gratuit est créé à part. Ce n’est pas une formule du catalogue et cette page ne le déclenche pas.</p>
                  <p>La découverte premium concerne Starter et Pro. Business et l’assistance prioritaire n’en font pas partie.</p>
                  <p>L’inscription utilise le parcours fictif déjà en place. Aucun encaissement fournisseur n’est lancé ici.</p>
                </div>
              </div>
            </div>
          </section>

          <div className="mx-auto mt-8 max-w-6xl px-5 text-center sm:px-6">
            <Link href="/" className="text-sm font-semibold text-[#4a544d] underline decoration-[#a3aca6] underline-offset-4 hover:text-[#0e1310]">
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
          <div className="w-full rounded-[1.75rem] border border-[#e4e8e5] bg-white p-8 text-center shadow-sm">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f0f4f1] text-[#08783f]" aria-hidden>
              <Gauge className="h-6 w-6" />
            </div>
            <h1 className="mt-5 text-3xl font-bold tracking-tight">Tarifs</h1>
            <p className="mt-3 text-[#68726b]">Les tarifs sont indisponibles.</p>
            <p className="mt-6">
              <Link className="font-semibold text-[#08783f] underline underline-offset-4" href="/">Retour à l’accueil</Link>
            </p>
          </div>
        </main>
      </GrowthShell>
    );
  }
}
