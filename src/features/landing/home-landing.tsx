import Link from "next/link";
import { ArrowRight, MapPinned, MessageSquareText, Workflow } from "lucide-react";
import { sora } from "@/app/(client-portal)/portal-font";
import { APP_NAME, SUPPORT_EMAIL } from "@/lib/constants";
import type { PublicPricing } from "@/domains/growth/public-pricing";
import { PublicTopNavbar } from "@/features/landing/public-top-navbar";
import { MissionMap } from "@/features/landing/mission-map";
import { MissionLine } from "@/features/landing/mission-line";
import { ghostButton, inkButton, primaryButton } from "@/features/landing/landing-styles";

/**
 * Accueil public — direction B « Ligne de mission » (LANDING-2), Light Menthe et Dark « Encre + Pastel ».
 * Uniquement des faits produit : données fictives de la mini-démo, prix lus sur le catalogue actif,
 * aucun logo client ni chiffre marketing.
 */

const benefits = [
  { icon: MapPinned, title: "Suivi des livraisons", text: "Chaque commande suivie, étape par étape." },
  { icon: MessageSquareText, title: "Moins d'appels", text: "Vos clients suivent leur commande eux-mêmes." },
  { icon: Workflow, title: "Un seul fil", text: "De la commande à la facture, sans tableur." },
] as const;

const count = new Intl.NumberFormat("fr-FR");

/** Prix du catalogue : sans centimes quand le montant est rond, sinon au centime. */
function price(cents: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

const sectionTitle = "mt-3 text-balance text-[clamp(30px,4.4vw,52px)] font-bold leading-[1.04] tracking-[-0.035em]";
const kicker = "text-[13px] font-semibold text-brand";
const footerLink =
  "inline-flex min-h-11 items-center rounded-md px-1.5 text-text-secondary hover:text-foreground hover:underline hover:underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function PricingGlance({ pricing }: { pricing: PublicPricing | null }) {
  if (!pricing || pricing.plans.length === 0) {
    return (
      <div className="mt-12 rounded-3xl border border-border bg-card p-6 sm:p-8">
        <p className="text-text-secondary">Les tarifs ne sont pas disponibles pour le moment.</p>
        <Link href="/tarifs" className="mt-2 inline-flex min-h-11 items-center font-semibold text-brand underline-offset-4 hover:underline">
          Voir la page Tarifs
        </Link>
      </div>
    );
  }
  return (
    <>
      <div className="mt-12 overflow-hidden rounded-3xl border border-border bg-card" role="table" aria-label="Formules">
        <div
          className="hidden grid-cols-[1.1fr_1fr_1fr_1fr_1.8fr] gap-4 bg-secondary px-7 py-3.5 text-xs font-semibold tracking-[0.02em] text-muted-foreground min-[1000px]:grid"
          role="row"
        >
          <span role="columnheader">Formule</span>
          <span role="columnheader">Prix HT / mois</span>
          <span role="columnheader">Livreurs inclus</span>
          <span role="columnheader">Commandes incluses / mois</span>
          <span role="columnheader">Inclus</span>
        </div>
        {pricing.plans.map((plan) => (
          <div
            key={plan.code}
            role="row"
            className="grid grid-cols-2 items-center gap-x-4 gap-y-1.5 border-t border-border p-5 max-[999px]:[&:nth-child(2)]:border-t-0 min-[1000px]:grid-cols-[1.1fr_1fr_1fr_1fr_1.8fr] min-[1000px]:gap-4 min-[1000px]:px-7 min-[1000px]:py-[22px]"
          >
            <h3 role="rowheader" className="text-xl font-semibold tracking-[-0.02em]">
              {plan.name}
            </h3>
            <p role="cell" className="text-right text-[28px] font-bold tracking-[-0.04em] min-[1000px]:text-left">
              {price(plan.monthlyHtCents)}{" "}
              <small className="text-[13px] font-medium tracking-normal text-muted-foreground">HT / mois</small>
            </p>
            <p role="cell">
              {plan.unlimitedDriverSeats ? (
                // Même libellé que /tarifs pour un catalogue sans plafond de livreurs.
                <>
                  <span className="text-muted-foreground min-[1000px]:sr-only">Livreurs : </span>Usage mesuré
                </>
              ) : (
                <>
                  {count.format(plan.includedDriverSeats)}{" "}
                  <span className="text-muted-foreground min-[1000px]:sr-only">livreurs inclus</span>
                </>
              )}
            </p>
            <p role="cell">
              {count.format(plan.includedMonthlyOrders)}{" "}
              <span className="text-muted-foreground min-[1000px]:sr-only">commandes incluses / mois</span>
            </p>
            <p role="cell" className="col-span-2 text-sm text-text-secondary min-[1000px]:col-span-1 min-[1000px]:text-base">
              {plan.includedFeatureLabels.length > 0
                ? plan.includedFeatureLabels.join(", ")
                : plan.options.length > 0
                  ? "L'essentiel, options à la carte"
                  : "L'essentiel"}
            </p>
          </div>
        ))}
      </div>
      <p className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
        <span>{`Prix HT · TVA ${pricing.vatRateBps / 100} %.`}</span>
        <Link href="/tarifs" className="inline-flex min-h-11 items-center font-semibold text-brand underline-offset-4 hover:underline">
          Quotas, options, annuel et TTC
          <ArrowRight className="ml-1 h-4 w-4" aria-hidden />
        </Link>
      </p>
    </>
  );
}

export function HomeLanding({ pricing }: { pricing: PublicPricing | null }) {
  return (
    <div
      className={`${sora.variable} min-h-screen bg-background pb-24 text-foreground sm:pb-0`}
      style={{ fontFamily: "var(--font-sora), ui-sans-serif, system-ui, sans-serif" }}
    >
      <PublicTopNavbar />

      <main id="main-content" tabIndex={-1} className="focus:outline-none">
        <div className="mx-auto w-[min(1240px,100%-32px)]">
          <section
            aria-labelledby="hero-title"
            className="grid items-center gap-9 pb-[72px] pt-10 min-[1000px]:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] min-[1000px]:gap-12 min-[1000px]:pb-24 min-[1000px]:pt-14"
          >
            <div>
              <p className={kicker}>Pilotage des livraisons B2B</p>
              <h1
                id="hero-title"
                className="mt-4 text-balance text-[clamp(40px,5.6vw,76px)] font-bold leading-[0.98] tracking-[-0.045em]"
              >
                De la commande à la facture, sur une seule ligne.
              </h1>
              <p className="mt-[22px] max-w-[520px] text-lg text-text-secondary">
                Commandes, dispatch, suivi et factures au même endroit, avec un espace pour votre équipe, vos clients et
                vos chauffeurs.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <a href="#ligne" className={inkButton}>
                  Voir la démo
                </a>
                <Link href="/login" className={ghostButton}>
                  Se connecter
                </Link>
              </div>
              <ul className="mt-7 flex flex-wrap gap-2" aria-label="Les trois espaces">
                {["Entreprise", "Client", "Chauffeur"].map((space) => (
                  <li
                    key={space}
                    className="inline-flex min-h-8 items-center gap-2 rounded-full border border-border px-3 text-[13px] text-text-secondary"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden />
                    {space}
                  </li>
                ))}
              </ul>
            </div>
            <MissionMap />
          </section>
        </div>

        <section id="ligne" aria-labelledby="line-title" className="scroll-mt-24 pb-20 sm:pb-28">
          <div className="mx-auto w-[min(1240px,100%-32px)]">
            <MissionLine />
          </div>
        </section>

        <section aria-labelledby="why-title" className="pb-20 sm:pb-28">
          <div className="mx-auto w-[min(1240px,100%-32px)]">
            <h2 id="why-title" className={`${sectionTitle} mb-10 mt-0`}>
              Ce que vous y gagnez.
            </h2>
            <ul className="grid border-y border-border min-[1000px]:grid-cols-3">
              {benefits.map(({ icon: Icon, title, text }) => (
                <li
                  key={title}
                  className="grid gap-2.5 border-t border-border py-7 first:border-t-0 min-[1000px]:border-l min-[1000px]:border-t-0 min-[1000px]:px-8 min-[1000px]:py-10 min-[1000px]:first:border-l-0 min-[1000px]:first:pl-0"
                >
                  <Icon className="h-7 w-7 text-brand" strokeWidth={1.7} aria-hidden />
                  <h3 className="text-[22px] font-semibold tracking-[-0.02em]">{title}</h3>
                  <p className="text-text-secondary">{text}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="tarifs" aria-labelledby="price-title" className="scroll-mt-24 pb-20 sm:pb-28">
          <div className="mx-auto w-[min(1240px,100%-32px)]">
            <p className={kicker}>Tarifs</p>
            <h2 id="price-title" className={sectionTitle}>
              Trois formules, lisibles d&apos;un regard.
            </h2>
            <PricingGlance pricing={pricing} />
          </div>
        </section>

        <section id="contact" aria-labelledby="contact-title" className="scroll-mt-24 pb-20 sm:pb-28">
          <div className="mx-auto w-[min(1240px,100%-32px)]">
            <div className="grid items-center gap-8 rounded-[28px] bg-[#0e1310] px-6 py-9 text-[#f5f8f6] dark:border dark:border-border dark:bg-card dark:text-foreground min-[1000px]:grid-cols-[1fr_auto] min-[1000px]:p-14">
              <div>
                <h2 id="contact-title" className={`${sectionTitle} mt-0`}>
                  Parlons de vos livraisons.
                </h2>
                <p className="mt-3.5 max-w-[600px] text-lg opacity-80">
                  Une question, une démonstration accompagnée ou un pilote : décrivez votre activité, nous répondons par
                  e-mail.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link href="/contact" className={`${primaryButton} focus-visible:ring-offset-[#0e1310] dark:focus-visible:ring-offset-card`}>
                  Nous écrire
                </Link>
                {SUPPORT_EMAIL ? (
                  <a
                    href={`mailto:${SUPPORT_EMAIL}`}
                    className="inline-flex min-h-[52px] items-center justify-center rounded-[14px] border border-[rgba(127,127,127,0.45)] px-6 text-[15px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {SUPPORT_EMAIL}
                  </a>
                ) : null}
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="pb-12 pt-10 text-sm text-muted-foreground">
        <div className="mx-auto flex w-[min(1240px,100%-32px)] flex-wrap items-center justify-between gap-4 border-t border-border pt-6">
          <p>
            <strong className="text-foreground">{APP_NAME}</strong> — pilotage des livraisons B2B
          </p>
          <nav aria-label="Pied de page" className="flex flex-wrap gap-x-2 gap-y-1">
            <Link href="/fonctionnalites" className={footerLink}>Fonctionnalités</Link>
            <Link href="/tarifs" className={footerLink}>Tarifs</Link>
            <Link href="/demonstration" className={footerLink}>Démonstration</Link>
            <Link href="/contact" className={footerLink}>Contact</Link>
            <Link href="/login?espace=entreprise" className={footerLink}>Entreprise</Link>
            <Link href="/login/client" className={footerLink}>Client</Link>
            <Link href="/login/driver" className={footerLink}>Chauffeur</Link>
          </nav>
        </div>
      </footer>

      <nav
        aria-label="Actions rapides"
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-[1fr_1.3fr_1fr] gap-2 border-t border-border bg-card px-3 pb-[calc(10px+env(safe-area-inset-bottom))] pt-2.5 sm:hidden"
      >
        <a href="#ligne" className="grid min-h-12 place-items-center rounded-[14px] bg-secondary text-sm font-semibold text-foreground">
          Démo
        </a>
        <Link href="/login" className="grid min-h-12 place-items-center rounded-[14px] bg-foreground text-sm font-semibold text-background">
          Se connecter
        </Link>
        <a href="#contact" className="grid min-h-12 place-items-center rounded-[14px] bg-secondary text-sm font-semibold text-foreground">
          Contact
        </a>
      </nav>
    </div>
  );
}
