import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Building2, Check, Route, ShieldCheck, Truck, UserRound } from "lucide-react";
import { APP_NAME } from "@/lib/constants";
import { PUBLIC_CAPABILITIES } from "@/domains/growth/public-capabilities";
import { GrowthShell } from "@/features/landing/growth-shell";

export const metadata: Metadata = {
  title: `Fonctionnalités — ${APP_NAME}`,
  description: "Ce que le client, le dispatch et le livreur peuvent déjà faire.",
};

const sectionVisuals = {
  client: {
    icon: UserRound,
    eyebrow: "Côté client",
    description: "Commander, suivre et échanger sans perdre le fil.",
    card: "border-[#e4e8e5] bg-gradient-to-b from-[#eef6f1] to-white",
    iconClass: "bg-[#e3f7ec] text-[#08783f]",
  },
  dispatch: {
    icon: Building2,
    eyebrow: "Côté équipe",
    description: "Organiser les missions et partager les bonnes informations.",
    card: "border-[#cdeedb] bg-gradient-to-b from-[#effbf4] to-white",
    iconClass: "bg-[#e3f7ec] text-[#08783f]",
  },
  driver: {
    icon: Truck,
    eyebrow: "Côté terrain",
    description: "Prendre en charge, livrer et laisser une preuve claire.",
    card: "border-[#f2dfb8] bg-gradient-to-b from-[#fdf4e4] to-white",
    iconClass: "bg-[#f2dfb8] text-[#7a5410]",
  },
} as const;

export default function FonctionnalitesPage() {
  return (
    <GrowthShell active="fonctionnalites">
      <main id="main-content" tabIndex={-1} className="pb-20">
        <section className="mx-auto max-w-4xl px-5 pb-12 pt-14 text-center sm:px-6 sm:pb-16 sm:pt-20">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#e4e8e5] bg-white/80 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.16em] text-[#08783f] shadow-sm">
            <Route className="h-3.5 w-3.5" aria-hidden />
            Du premier clic à la livraison
          </div>
          <h1 className="mx-auto mt-6 max-w-3xl text-balance text-4xl font-bold tracking-[-0.04em] text-[#0e1310] sm:text-5xl lg:text-6xl">
            Chacun voit l’essentiel. Tout le monde avance ensemble.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-[#68726b] sm:text-lg">
            Une même livraison traverse trois espaces simples : celui du client, de l’équipe qui organise et du livreur sur le terrain.
          </p>
        </section>

        <section aria-label="Fonctionnalités par espace" className="mx-auto grid max-w-6xl gap-5 px-5 sm:px-6 lg:grid-cols-3">
          {PUBLIC_CAPABILITIES.map((section) => {
            const visual = sectionVisuals[section.id];
            const Icon = visual.icon;
            return (
              <article key={section.id} className={`overflow-hidden rounded-[1.75rem] border ${visual.card} p-5 shadow-[0_18px_60px_rgba(14,19,16,0.07)] sm:p-6`}>
                <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${visual.iconClass}`} aria-hidden>
                  <Icon className="h-6 w-6" strokeWidth={1.8} />
                </div>
                <p className="mt-5 text-xs font-bold uppercase tracking-[0.16em] text-[#68726b]">{visual.eyebrow}</p>
                <h2 className="mt-2 text-2xl font-bold tracking-tight text-[#0e1310]">{section.title}</h2>
                <p className="mt-2 min-h-12 text-sm leading-6 text-[#68726b]">{visual.description}</p>
                <ul className="mt-6 space-y-3 border-t border-[#e4e8e5] pt-5">
                  {section.claims.map((claim) => (
                    <li key={claim.text} className="flex gap-3 text-sm leading-6 text-[#3b443e]">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white text-[#08783f] shadow-sm ring-1 ring-[#e4e8e5]" aria-hidden>
                        <Check className="h-3 w-3" strokeWidth={2.4} />
                      </span>
                      <span>{claim.text}</span>
                    </li>
                  ))}
                </ul>
              </article>
            );
          })}
        </section>

        <section className="mx-auto mt-12 max-w-6xl px-5 sm:px-6">
          <div className="overflow-hidden rounded-[1.75rem] bg-[#0e1310] text-white shadow-[0_24px_70px_rgba(14,19,16,0.18)]">
            <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[0.75fr_1.25fr] lg:items-center lg:p-10">
              <div>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-[#dfe5e1]" aria-hidden>
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <h2 className="mt-5 text-2xl font-bold tracking-tight sm:text-3xl">Un suivi honnête, même quand le signal manque.</h2>
                <p className="mt-3 text-sm leading-6 text-white/65 sm:text-base">
                  Une position peut être absente ou périmée. Dans ce cas, les coordonnées ne sont pas affichées comme si elles étaient encore fiables.
                </p>
              </div>
              <ol className="grid gap-3 sm:grid-cols-3">
                {[
                  ["01", "Le client", "crée sa commande"],
                  ["02", "L’équipe", "organise la mission"],
                  ["03", "Le livreur", "confirme la remise"],
                ].map(([number, title, text]) => (
                  <li key={number} className="rounded-2xl border border-white/10 bg-white/[0.07] p-4">
                    <span className="text-xs font-bold tracking-[0.15em] text-[#b3bab6]">{number}</span>
                    <p className="mt-4 font-bold">{title}</p>
                    <p className="mt-1 text-sm text-white/60">{text}</p>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        <section className="mx-auto mt-12 max-w-4xl px-5 text-center sm:px-6">
          <h2 className="text-2xl font-bold tracking-tight text-[#0e1310]">Envie de voir comment tout s’assemble ?</h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-[#68726b]">
            Parcourez la démonstration, comparez les formules ou démarrez une inscription.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href="/demonstration" className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-[#0e1310] px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-[#232a26] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#08783f] focus-visible:ring-offset-2">
              Voir la démonstration
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            <Link href="/tarifs" className="inline-flex min-h-12 items-center rounded-xl border border-[#d5ddd8] bg-white px-5 py-3 text-sm font-bold text-[#0e1310] hover:bg-[#f0f4f1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#08783f] focus-visible:ring-offset-2">
              Comparer les tarifs
            </Link>
            <Link href="/register" className="inline-flex min-h-12 items-center rounded-xl border border-[#d5ddd8] bg-white px-5 py-3 text-sm font-bold text-[#0e1310] hover:bg-[#f0f4f1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#08783f] focus-visible:ring-offset-2">
              Inscription
            </Link>
            <Link href="/login" className="inline-flex min-h-12 items-center px-3 py-3 text-sm font-bold text-[#4a544d] underline decoration-[#a3aca6] underline-offset-4 hover:text-[#0e1310]">
              Connexion
            </Link>
          </div>
        </section>
      </main>
    </GrowthShell>
  );
}
