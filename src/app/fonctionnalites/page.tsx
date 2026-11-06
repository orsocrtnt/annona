import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Building2,
  Check,
  ClipboardList,
  FileCheck2,
  MapPinned,
  PackageCheck,
  Route,
  ShieldCheck,
  Truck,
  UserRound,
} from "lucide-react";
import { APP_NAME } from "@/lib/constants";
import { PUBLIC_CAPABILITIES } from "@/domains/growth/public-capabilities";
import { GrowthShell } from "@/features/landing/growth-shell";

export const metadata: Metadata = {
  title: `Fonctionnalités — ${APP_NAME}`,
  description: "Ce que le client, l'équipe de dispatch et le livreur peuvent faire aujourd'hui avec Annona.",
};

const sectionVisuals = {
  client: {
    icon: UserRound,
    eyebrow: "Côté client",
    description: "Commander, suivre et récupérer la preuve sans appeler personne.",
    card: "border-border bg-gradient-to-b from-[#eef6f1] to-white dark:bg-none dark:bg-card",
    iconClass: "bg-[#e3f7ec] dark:bg-brand-subtle text-brand",
  },
  dispatch: {
    icon: Building2,
    eyebrow: "Côté équipe",
    description: "Recevoir les commandes, affecter les bons livreurs et garder la main sur la journée.",
    card: "border-[#cdeedb] dark:border-border bg-gradient-to-b from-[#effbf4] to-white dark:bg-none dark:bg-card",
    iconClass: "bg-[#e3f7ec] dark:bg-brand-subtle text-brand",
  },
  driver: {
    icon: Truck,
    eyebrow: "Côté terrain",
    description: "Savoir où aller, livrer et laisser une preuve claire, depuis le téléphone.",
    card: "border-[#f2dfb8] dark:border-border bg-gradient-to-b from-[#fdf4e4] to-white dark:bg-none dark:bg-card",
    iconClass: "bg-[#f2dfb8] dark:bg-[#3a2f1c] text-[#7a5410] dark:text-[#f0b45c]",
  },
} as const;

/** Une livraison de bout en bout : résumé des phrases détaillées plus bas, rien de plus. */
const journey = [
  { icon: ClipboardList, title: "La commande arrive", text: "Portail client, lien de commande, ou e-mail et WhatsApp en option." },
  { icon: MapPinned, title: "L’équipe affecte", text: "Livreurs proposés, carte en direct et tournées." },
  { icon: PackageCheck, title: "Le livreur livre", text: "Prise en charge, photo et signature à la remise." },
  { icon: FileCheck2, title: "Le client est informé", text: "Suivi, arrivée estimée, preuve en PDF et facture." },
] as const;

const trackingStates = [
  ["Position datée", "Chaque point affiché porte son heure."],
  ["Position estimée", "Entre deux signaux, elle est signalée comme telle."],
  ["Signal perdu", "Après 3 min sans signal, le livreur s’arrête sur la carte."],
] as const;

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#08783f] dark:focus-visible:ring-ring focus-visible:ring-offset-2";

export default function FonctionnalitesPage() {
  return (
    <GrowthShell active="fonctionnalites">
      <main id="main-content" tabIndex={-1} className="pb-20">
        <section className="mx-auto max-w-4xl px-5 pb-10 pt-14 text-center sm:px-6 sm:pb-14 sm:pt-20">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/80 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.16em] text-brand shadow-sm">
            <Route className="h-3.5 w-3.5" aria-hidden />
            Du premier clic à la livraison
          </div>
          <h1 className="mx-auto mt-6 max-w-3xl text-balance text-4xl font-bold tracking-[-0.04em] text-foreground sm:text-5xl lg:text-6xl">
            Chacun voit l’essentiel. Tout le monde avance ensemble.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
            Une même livraison traverse trois espaces : le client qui commande, l’équipe qui organise et le livreur sur le terrain. Voici ce que chacun peut faire aujourd’hui.
          </p>
          <nav aria-label="Aller à un espace" className="mt-7 flex flex-wrap justify-center gap-2">
            {PUBLIC_CAPABILITIES.map((section) => (
              <a
                key={section.id}
                href={`#${section.id}`}
                className={`inline-flex min-h-11 items-center rounded-full border border-border bg-card px-4 text-sm font-semibold text-foreground hover:bg-[#f0f4f1] dark:hover:bg-secondary ${focusRing}`}
              >
                {sectionVisuals[section.id].eyebrow}
              </a>
            ))}
          </nav>
        </section>

        <section aria-labelledby="journey-title" className="mx-auto max-w-6xl px-5 sm:px-6">
          <h2 id="journey-title" className="sr-only">Une livraison, de bout en bout</h2>
          <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {journey.map((step, index) => {
              const Icon = step.icon;
              return (
                <li key={step.title} className="relative rounded-2xl border border-border bg-card p-5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e3f7ec] text-brand dark:bg-brand-subtle" aria-hidden>
                      <Icon className="h-5 w-5" strokeWidth={1.8} />
                    </span>
                    <span className="text-xs font-bold tracking-[0.15em] text-muted-foreground">{String(index + 1).padStart(2, "0")}</span>
                  </div>
                  <p className="mt-4 font-bold text-foreground">{step.title}</p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">{step.text}</p>
                </li>
              );
            })}
          </ol>
        </section>

        <div className="mx-auto mt-12 grid max-w-6xl gap-5 px-5 sm:px-6">
          {PUBLIC_CAPABILITIES.map((section) => {
            const visual = sectionVisuals[section.id];
            const Icon = visual.icon;
            return (
              <section
                key={section.id}
                id={section.id}
                aria-labelledby={`${section.id}-title`}
                className={`scroll-mt-6 overflow-hidden rounded-[1.75rem] border ${visual.card} p-5 shadow-[0_18px_60px_rgba(14,19,16,0.07)] sm:p-8`}
              >
                <div className="grid gap-6 lg:grid-cols-[0.75fr_1.25fr] lg:gap-10">
                  <div>
                    <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${visual.iconClass}`} aria-hidden>
                      <Icon className="h-6 w-6" strokeWidth={1.8} />
                    </div>
                    <p className="mt-5 text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">{visual.eyebrow}</p>
                    <h2 id={`${section.id}-title`} className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                      {section.title}
                    </h2>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground sm:text-base">{visual.description}</p>
                  </div>
                  <ul className="grid gap-x-6 gap-y-3 border-t border-border pt-5 sm:grid-cols-2 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
                    {section.claims.map((claim) => (
                      <li key={claim.text} className="flex gap-3 text-sm leading-6 text-[#3b443e] dark:text-text-secondary">
                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-card text-brand shadow-sm ring-1 ring-border" aria-hidden>
                          <Check className="h-3 w-3" strokeWidth={2.4} />
                        </span>
                        <span>
                          {claim.text}
                          {claim.badge ? (
                            <span className="ml-2 inline-flex rounded-full bg-[#f0f4f1] px-2 py-0.5 align-middle text-[11px] font-semibold text-[#4a544d] dark:bg-secondary dark:text-text-secondary">
                              {claim.badge}
                            </span>
                          ) : null}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </section>
            );
          })}
        </div>

        <section className="mx-auto mt-12 max-w-6xl px-5 sm:px-6">
          <div className="overflow-hidden rounded-[1.75rem] bg-[#0e1310] text-white shadow-[0_24px_70px_rgba(14,19,16,0.18)] dark:bg-secondary dark:shadow-none dark:ring-1 dark:ring-border">
            <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[0.75fr_1.25fr] lg:items-center lg:p-10">
              <div>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-[#dfe5e1]" aria-hidden>
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <h2 className="mt-5 text-2xl font-bold tracking-tight sm:text-3xl">Un suivi honnête, même quand le signal manque.</h2>
                <p className="mt-3 text-sm leading-6 text-white/65 sm:text-base">
                  Une position peut être absente ou périmée. Dans ce cas, elle n’est jamais affichée comme si elle était encore fiable.
                </p>
              </div>
              <ul className="grid gap-3 sm:grid-cols-3">
                {trackingStates.map(([title, text]) => (
                  <li key={title} className="rounded-2xl border border-white/10 bg-white/[0.07] p-4">
                    <p className="font-bold">{title}</p>
                    <p className="mt-1 text-sm leading-6 text-white/60">{text}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="mx-auto mt-12 max-w-4xl px-5 text-center sm:px-6">
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Envie de l’essayer avec votre équipe ?</h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
            Nous ouvrons votre espace avec vous et vous accompagnons jusqu’à la première livraison.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href="/contact" className={`inline-flex min-h-12 items-center gap-2 rounded-xl bg-[#0e1310] px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-[#232a26] dark:bg-foreground dark:text-background dark:hover:bg-foreground/90 ${focusRing}`}>
              Demander un pilote
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            <Link href="/#demo" className={`inline-flex min-h-12 items-center rounded-xl border border-[#d5ddd8] dark:border-input bg-card px-5 py-3 text-sm font-bold text-foreground hover:bg-[#f0f4f1] dark:hover:bg-secondary ${focusRing}`}>
              Voir la mini-démo
            </Link>
            <Link href="/login" className="inline-flex min-h-12 items-center px-3 py-3 text-sm font-bold text-[#4a544d] dark:text-text-secondary underline decoration-[#a3aca6] underline-offset-4 hover:text-foreground">
              Connexion
            </Link>
          </div>
        </section>
      </main>
    </GrowthShell>
  );
}
