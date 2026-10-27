import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Bike,
  Building2,
  Check,
  MapPinned,
  Package,
  PhoneOff,
  Sparkles,
  Truck,
  UserRound,
  Workflow,
} from "lucide-react";
import { APP_NAME } from "@/lib/constants";
import { DELIVERY_CATEGORY_LABELS, PORTAL_CATEGORY_DESCRIPTIONS } from "@/lib/constants/delivery";
import { PublicTopNavbar } from "@/features/landing/public-top-navbar";
import { cn } from "@/lib/utils";

/**
 * Accueil public — DA Menthe (planche « Landing en deux modes », version claire).
 * Uniquement des faits produit : captures réelles de l'application, aucun logo client,
 * aucun chiffre marketing non mesuré.
 */

const primaryCta =
  "group inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-[0_10px_30px_rgba(0,212,106,0.25)] transition-[background-color,transform] duration-200 hover:bg-[#00c262] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transition-none";
const inkCta =
  "group inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#0e1310] px-6 text-sm font-semibold text-white transition-[background-color,transform] duration-200 hover:bg-[#232a26] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transition-none";
const secondaryCta =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-border bg-white px-6 text-sm font-semibold text-foreground transition-colors hover:bg-[#f0f4f1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";
const arrow = "h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none";

const promises = [
  { icon: MapPinned, title: "Suivi en temps réel", text: "Livraisons et chauffeurs sur une même carte" },
  { icon: PhoneOff, title: "Moins d'appels", text: "Vos clients suivent leur commande eux-mêmes" },
  { icon: Workflow, title: "Un seul fil", text: "De la commande à la facture, sans tableur" },
] as const;

const spaces = [
  {
    icon: Building2,
    title: "Entreprise",
    text: "Commandes, dispatch, flotte et facturation dans un seul tableau de bord.",
    href: "/login",
    cta: "Connexion entreprise",
  },
  {
    icon: UserRound,
    title: "Client",
    text: "Commander, suivre ses livraisons et retrouver ses factures en autonomie.",
    href: "/login/client",
    cta: "Espace client",
  },
  {
    icon: Truck,
    title: "Chauffeur",
    text: "Recevoir ses missions, naviguer vers chaque arrêt, valider la livraison.",
    href: "/login/driver",
    cta: "Espace chauffeur",
  },
] as const;

const tracking = [
  "Position des chauffeurs pendant leurs missions",
  "Statut mis à jour à chaque étape",
  "Suivi partagé avec votre client",
  "Preuve de livraison et historique de chaque commande",
] as const;

const categories = [
  { icon: Package, category: "STANDARD" },
  { icon: Bike, category: "COURIER" },
  { icon: Sparkles, category: "SPECIAL_MISSION" },
] as const;

function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-[#cdeedb] bg-[#effbf4] px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-brand",
        className
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-[#00d46a]" aria-hidden />
      {children}
    </p>
  );
}

/** Capture réelle de l'application dans un cadre de fenêtre. */
function ProductShot({ src, alt, priority = false }: { src: string; alt: string; priority?: boolean }) {
  return (
    <figure className="overflow-hidden rounded-[22px] border border-black/[0.07] bg-white p-1.5 shadow-[0_30px_80px_rgba(14,19,16,0.12)]">
      <div className="flex items-center gap-1.5 px-3 py-2" aria-hidden>
        <span className="h-2.5 w-2.5 rounded-full bg-[#e4e8e5]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#e4e8e5]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#e4e8e5]" />
      </div>
      <Image
        src={src}
        alt={alt}
        width={1600}
        height={1000}
        priority={priority}
        sizes="(min-width: 1024px) 640px, 100vw"
        className="h-auto w-full rounded-[16px]"
      />
    </figure>
  );
}

export function HomeLanding() {
  return (
    <div className="home-landing min-h-screen bg-background text-foreground">
      <div
        className="pointer-events-none fixed inset-0 -z-10"
        aria-hidden
        style={{
          background:
            "radial-gradient(ellipse 70% 45% at 15% -5%, #e3f7ec 0%, transparent 60%), radial-gradient(ellipse 50% 40% at 95% 10%, #eef6f1 0%, transparent 60%), #f5f8f6",
        }}
      />

      <PublicTopNavbar />

      <main id="main-content" tabIndex={-1} className="focus:outline-none">
        {/* Promesse + produit */}
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-5 pb-16 pt-10 sm:px-6 sm:pt-16 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-14 lg:pb-24">
          <div>
            <Eyebrow className="home-landing-reveal home-landing-reveal-1">Pilotage des livraisons B2B</Eyebrow>
            <h1 className="home-landing-reveal home-landing-reveal-1 mt-6 text-[clamp(2.75rem,7vw,4.25rem)] font-bold leading-[0.98] tracking-[-0.04em]">
              Simplifiez.
              <br />
              Suivez. <span className="text-brand">Livrez.</span>
            </h1>
            <p className="home-landing-reveal home-landing-reveal-2 mt-6 max-w-lg text-lg leading-relaxed text-muted-foreground">
              {APP_NAME} réunit commandes, dispatch, suivi et factures sur une seule plateforme, avec
              un espace pour votre équipe, vos clients et vos chauffeurs.
            </p>
            <div className="home-landing-reveal home-landing-reveal-3 mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/demonstration" className={primaryCta}>
                Voir la démo
                <ArrowRight className={arrow} aria-hidden />
              </Link>
              <Link href="/fonctionnalites" className={secondaryCta}>
                Découvrir les fonctionnalités
              </Link>
            </div>

            <ul className="home-landing-reveal home-landing-reveal-3 mt-10 grid gap-5 sm:grid-cols-3">
              {promises.map(({ icon: Icon, title, text }) => (
                <li key={title} className="flex gap-3 sm:block">
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#e6f8ee] text-brand"
                    aria-hidden
                  >
                    <Icon className="h-5 w-5" strokeWidth={1.75} />
                  </span>
                  <div>
                    <p className="text-sm font-semibold sm:mt-3">{title}</p>
                    <p className="mt-1 text-sm leading-snug text-muted-foreground">{text}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="home-landing-reveal home-landing-reveal-2">
            <ProductShot
              src="/landing/produit-tableau-de-bord.webp"
              alt="Tableau de bord TutelLiv : livraisons en retard, sans livreur, à démarrer et en route, puis la carte des livreurs en direct."
              priority
            />
          </div>
        </section>

        {/* Trois espaces (à la place d'un bandeau de logos) */}
        <section aria-labelledby="spaces-title" className="border-y border-border bg-white/70">
          <div className="mx-auto max-w-6xl px-5 py-12 sm:px-6">
            <h2 id="spaces-title" className="text-center text-sm font-semibold text-muted-foreground">
              Une plateforme, trois espaces
            </h2>
            <ul className="mt-8 grid gap-4 md:grid-cols-3">
              {spaces.map(({ icon: Icon, title, text, href, cta }) => (
                <li key={title} className="flex gap-4 rounded-2xl border border-border bg-white p-5">
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#f0f4f1] text-foreground"
                    aria-hidden
                  >
                    <Icon className="h-5 w-5" strokeWidth={1.75} />
                  </span>
                  <div className="min-w-0">
                    <h3 className="font-semibold">{title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{text}</p>
                    <Link
                      href={href}
                      className="mt-3 inline-flex items-center gap-1 rounded-sm text-sm font-semibold text-brand underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {cta}
                      <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Suivi en temps réel */}
        <section aria-labelledby="tracking-title" className="mx-auto max-w-6xl px-5 py-16 sm:px-6 lg:py-24">
          <div className="grid items-center gap-10 rounded-[28px] border border-border bg-white p-4 shadow-[0_20px_60px_rgba(14,19,16,0.05)] sm:p-6 lg:grid-cols-2 lg:gap-14 lg:p-10">
            <ProductShot
              src="/landing/produit-carte.webp"
              alt="Carte des livraisons TutelLiv : liste des livraisons actives par client et adresse, statuts, et livreurs positionnés sur Paris."
            />
            <div className="px-1 pb-2 sm:px-0">
              <Eyebrow>Suivi en temps réel</Eyebrow>
              <h2 id="tracking-title" className="mt-5 text-3xl font-bold leading-tight tracking-[-0.03em] sm:text-4xl">
                Une visibilité complète sur vos opérations
              </h2>
              <p className="mt-4 text-base leading-relaxed text-muted-foreground">
                Voyez où en est chaque livraison, repérez les retards avant qu&apos;ils ne deviennent
                des appels, et partagez l&apos;avancement avec vos clients.
              </p>
              <ul className="mt-6 space-y-3">
                {tracking.map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm">
                    <span
                      className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#00d46a] text-[#0e1310]"
                      aria-hidden
                    >
                      <Check className="h-3.5 w-3.5" strokeWidth={3} />
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
              <Link href="/demonstration" className={cn(inkCta, "mt-8")}>
                Découvrir le suivi en direct
                <ArrowRight className={arrow} aria-hidden />
              </Link>
            </div>
          </div>
        </section>

        {/* Pour chaque type de livraison */}
        <section aria-labelledby="categories-title" className="mx-auto max-w-6xl px-5 pb-16 sm:px-6 lg:pb-24">
          <div className="text-center">
            <h2 id="categories-title" className="text-3xl font-bold tracking-[-0.03em] sm:text-4xl">
              Pensée pour chaque livraison
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-base text-muted-foreground">
              Achat livré, collecte ou mission sur mesure : le même suivi, de la commande à la facture.
            </p>
          </div>
          <ul className="mt-10 grid gap-4 md:grid-cols-3">
            {categories.map(({ icon: Icon, category }) => (
              <li key={category} className="flex flex-col rounded-2xl border border-border bg-white p-6">
                <span
                  className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#e6f8ee] text-brand"
                  aria-hidden
                >
                  <Icon className="h-5 w-5" strokeWidth={1.75} />
                </span>
                <h3 className="mt-4 font-semibold">{DELIVERY_CATEGORY_LABELS[category]}</h3>
                <p className="mt-1 flex-1 text-sm leading-relaxed text-muted-foreground">
                  {PORTAL_CATEGORY_DESCRIPTIONS[category]}
                </p>
                <Link
                  href="/fonctionnalites"
                  className="mt-4 inline-flex items-center gap-1 self-start rounded-sm text-sm font-semibold text-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  En savoir plus
                  <span className="sr-only"> sur : {DELIVERY_CATEGORY_LABELS[category]}</span>
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {/* Appel final */}
        <section aria-labelledby="cta-title" className="mx-auto max-w-6xl px-5 pb-20 sm:px-6">
          <div className="rounded-[28px] border border-[#cdeedb] bg-[linear-gradient(135deg,#effbf4_0%,#ffffff_70%)] px-6 py-12 text-center sm:px-10">
            <h2 id="cta-title" className="text-3xl font-bold tracking-[-0.03em] sm:text-4xl">
              Prêt à piloter vos livraisons ?
            </h2>
            <p className="mx-auto mt-3 max-w-md text-base text-muted-foreground">
              Faites le tour de la démonstration, ou créez votre compte entreprise.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link href="/register" className={primaryCta}>
                Créer un compte entreprise
                <ArrowRight className={arrow} aria-hidden />
              </Link>
              <Link href="/demonstration" className={secondaryCta}>
                Voir la démo
              </Link>
            </div>
            <p className="mt-6 text-sm text-muted-foreground">
              Déjà équipé ?{" "}
              <Link
                href="/login"
                className="rounded-sm font-semibold text-foreground underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Se connecter
              </Link>
            </p>
          </div>
        </section>
      </main>

      <footer className="border-t border-border bg-white/70 px-5 py-8 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{APP_NAME}</span>
            <span> — pilotage des livraisons B2B</span>
          </p>
          <nav aria-label="Pied de page" className="flex flex-wrap gap-x-5 gap-y-2 text-sm font-medium text-muted-foreground">
            <Link href="/fonctionnalites" className="hover:text-foreground hover:underline hover:underline-offset-4">
              Fonctionnalités
            </Link>
            <Link href="/tarifs" className="hover:text-foreground hover:underline hover:underline-offset-4">
              Tarifs
            </Link>
            <Link href="/login" className="hover:text-foreground hover:underline hover:underline-offset-4">
              Entreprise
            </Link>
            <Link href="/login/client" className="hover:text-foreground hover:underline hover:underline-offset-4">
              Client
            </Link>
            <Link href="/login/driver" className="hover:text-foreground hover:underline hover:underline-offset-4">
              Chauffeur
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
