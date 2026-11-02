import Link from "next/link";
import { BrandLogo } from "@/components/brand/brand-logo";
import { APP_NAME } from "@/lib/constants";
import { PublicTopNavbar } from "@/features/landing/public-top-navbar";
import { ActionsRace } from "@/features/landing/actions-race";
import { LandingDemo } from "@/features/landing/landing-demo";
import { landingGhostButton, landingMintButton } from "@/features/landing/landing-styles";

/**
 * Accueil public (LANDING-3) : copie de la maquette validée par le propriétaire (« TutelLiv — landing
 * assemblée ») — haut de page pour les sociétés de coursiers, la course « combien d'actions pour vous ? »,
 * puis la mini-démo ouverte d'office. Couleurs `--l-*` de la maquette (globals.css), Clair et Sombre.
 * Aucun logo client ni chiffre marketing ; les prix restent sur /tarifs, lus dans le catalogue.
 */

const page = "mx-auto max-w-[1280px] px-4 min-[901px]:px-8";
const sectionKicker = "text-[14px] leading-[20px] font-bold text-[var(--l-brand)]";
const footerLink =
  "inline-flex min-h-11 items-center rounded-md px-1.5 text-[var(--l-mute)] hover:text-[var(--l-ink)] hover:underline hover:underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function HomeLanding() {
  return (
    <div className="landing min-h-screen font-sans">
      <PublicTopNavbar variant="flat" demoHref="#demo" />

      <main id="main-content" tabIndex={-1} className="focus:outline-none">
        <section aria-labelledby="hero-title" className="mx-auto max-w-[1280px] px-5 pb-8 pt-4 text-center min-[901px]:px-8 min-[901px]:pb-16 min-[901px]:pt-[72px]">
          <p className="mb-3.5 hidden items-center rounded-full min-[901px]:inline-flex bg-[var(--l-mint-s)] px-3 py-[7px] text-[13px] font-semibold text-[var(--l-brand)]">
            Pour les sociétés de coursiers et de livraison express
          </p>
          <h1
            id="hero-title"
            className="text-[clamp(30px,8.6vw,40px)] font-extrabold leading-none tracking-[-0.05em] min-[901px]:text-[clamp(34px,4.4vw,60px)]"
          >
            Toute votre société de coursiers,
            <br />
            <span className="text-[var(--l-brand)]">au même endroit.</span>
          </h1>
          <p className="mx-auto mt-3.5 max-w-[560px] text-[16px] leading-[1.45] text-[var(--l-mute)] min-[901px]:text-[18px]">
            Les commandes de vos clients pros, le dispatch, le suivi, les preuves et les factures.
            <span className="hidden min-[901px]:inline"> Pensé pour les équipes de 3 à 20 livreurs.</span>
          </p>
          <div className="mt-[22px] flex flex-wrap justify-center gap-2.5">
            <a href="#demo" className={landingMintButton}>
              Essayer la démo
            </a>
            <Link href="/contact" className={landingGhostButton}>
              Parler à quelqu&apos;un
            </Link>
          </div>
        </section>

        <section aria-labelledby="race-title" className={`${page} min-[901px]:pt-6`}>
          <p className={`${sectionKicker} mb-[26px] hidden min-[901px]:block`}>Le temps gagné</p>
          <ActionsRace />
        </section>

        <section id="demo" aria-labelledby="demo-title" className={`${page} scroll-mt-6 pt-12 min-[901px]:pt-[72px]`}>
          <LandingDemo />
        </section>

        <section id="contact" aria-labelledby="contact-title" className="px-4 pb-16 pt-16 text-center min-[901px]:px-8 min-[901px]:pb-[130px] min-[901px]:pt-[110px]">
          <span className="mb-7 inline-flex [&_img]:!h-[52px] [&_img]:!w-auto">
            <BrandLogo size="md" className="dark:hidden" />
            <BrandLogo size="md" onDark className="hidden dark:inline-flex" />
          </span>
          <h2
            id="contact-title"
            className="text-[clamp(36px,5vw,64px)] font-extrabold leading-none tracking-[-0.05em]"
          >
            Prêt à ranger votre journée&nbsp;?
          </h2>
          <div className="mt-[22px] flex flex-wrap justify-center gap-2.5">
            <Link href="/contact" className={landingMintButton}>
              Demander un pilote
            </Link>
            <Link href="/tarifs" className={landingGhostButton}>
              Voir les tarifs
            </Link>
          </div>
        </section>
      </main>

      <footer className="pb-10 text-[14px] text-[var(--l-mute)]">
        <div className={page}>
          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[var(--l-line)] pt-6">
            <p>
              <strong className="text-[var(--l-ink)]">{APP_NAME}</strong> — pilotage des livraisons B2B
            </p>
            <nav aria-label="Pied de page" className="flex flex-wrap gap-x-2 gap-y-1">
              <Link href="/fonctionnalites" className={footerLink}>Fonctionnalités</Link>
              <Link href="/tarifs" className={footerLink}>Tarifs</Link>
              <Link href="/demonstration" className={footerLink}>Démonstration</Link>
              <Link href="/contact" className={footerLink}>Contact</Link>
              <Link href="/login?espace=entreprise" className={footerLink}>Entreprise</Link>
              <Link href="/login/client" className={footerLink}>Client</Link>
              <Link href="/login/driver" className={footerLink}>Livreur</Link>
              <Link href="/mentions-legales" className={footerLink}>Mentions légales</Link>
              <Link href="/confidentialite" className={footerLink}>Confidentialité</Link>
            </nav>
          </div>
        </div>
      </footer>
    </div>
  );
}
