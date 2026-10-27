import type { CSSProperties } from "react";
import Link from "next/link";
import { Plus_Jakarta_Sans } from "next/font/google";
import { Building2, Truck, UserRound } from "lucide-react";
import { APP_NAME } from "@/lib/constants";
import { PublicTopNavbar } from "@/features/landing/public-top-navbar";

/**
 * Accueil public — sobre, sans assets.
 * Explique l’outil : pilotage des livraisons (admin · client · chauffeur).
 */
const display = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-landing",
  display: "swap",
});

const t = {
  accent: "#3d5a73",
  accentDark: "#243447",
  accentSubtle: "#e8eef3",
  background: "#f6f7f9",
  foreground: "#121820",
  muted: "#5c6b7a",
  border: "#d8dee6",
  surface: "#ffffff",
} as const;

const spaces = [
  {
    icon: Building2,
    title: "Entreprise",
    text: "Pilotez commandes, dispatch, flotte et facturation depuis un seul tableau de bord.",
    href: "/login",
    cta: "Connexion entreprise",
  },
  {
    icon: UserRound,
    title: "Client",
    text: "Passez des commandes, suivez vos livraisons et consultez vos factures en autonomie.",
    href: "/login/client",
    cta: "Espace client",
  },
  {
    icon: Truck,
    title: "Chauffeur",
    text: "Recevez vos missions, naviguez vers les arrêts et validez les livraisons sur le terrain.",
    href: "/login/driver",
    cta: "Espace chauffeur",
  },
] as const;

export function HomeLanding() {
  return (
    <div
      className={`${display.variable} home-landing`}
      style={
        {
          "--hl-accent": t.accent,
          "--hl-accent-dark": t.accentDark,
          "--hl-fg": t.foreground,
          "--hl-muted": t.muted,
          "--hl-border": t.border,
          fontFamily: "var(--font-landing), ui-sans-serif, system-ui, sans-serif",
          backgroundColor: t.background,
          color: t.foreground,
        } as CSSProperties
      }
    >
      <div
        className="pointer-events-none fixed inset-0 -z-10"
        aria-hidden
        style={{
          background: `
            radial-gradient(ellipse 80% 50% at 50% -10%, ${t.accentSubtle} 0%, transparent 55%),
            linear-gradient(180deg, #fafbfc 0%, ${t.background} 40%, #eef1f5 100%)
          `,
        }}
      />

      <PublicTopNavbar />

      <main id="main-content" tabIndex={-1}>
        {/* Hero — une composition : marque, message, CTA */}
        <section className="mx-auto max-w-3xl px-5 pb-16 pt-16 text-center sm:px-6 sm:pb-20 sm:pt-24">
          <h1 className="home-landing-reveal home-landing-reveal-1 home-landing-brand font-bold tracking-tight">
            {APP_NAME}
          </h1>
          <p className="home-landing-reveal home-landing-reveal-2 mx-auto mt-5 max-w-xl text-lg leading-relaxed sm:text-xl" style={{ color: t.muted }}>
            La plateforme qui relie votre équipe, vos clients et vos chauffeurs
            pour piloter les livraisons du début à la fin.
          </p>
          <div className="home-landing-reveal home-landing-reveal-3 mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/login"
              className="inline-flex min-h-11 items-center rounded-md px-6 py-3 text-sm font-semibold text-white transition-[opacity,transform] duration-200 hover:opacity-95 active:scale-[0.98]"
              style={{ backgroundColor: t.accent }}
            >
              Accéder à la plateforme
            </Link>
            <Link
              href="/login/client"
              className="inline-flex min-h-11 items-center rounded-md border px-6 py-3 text-sm font-semibold transition-colors hover:bg-white"
              style={{ borderColor: t.border, color: t.foreground, backgroundColor: t.surface }}
            >
              Espace client
            </Link>
          </div>
        </section>

        {/* À quoi ça sert */}
        <section
          className="border-y"
          style={{ borderColor: t.border, backgroundColor: t.surface }}
        >
          <div className="mx-auto max-w-3xl px-5 py-14 sm:px-6 sm:py-16">
            <h2 className="text-sm font-semibold uppercase tracking-[0.18em]" style={{ color: t.accent }}>
              L’outil
            </h2>
            <p className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl" style={{ color: t.accentDark }}>
              Remplacez les échanges éparpillés par un fil unique.
            </p>
            <p className="mt-4 max-w-2xl text-base leading-relaxed sm:text-lg" style={{ color: t.muted }}>
              {APP_NAME} centralise la prise de commande, l’affectation des
              chauffeurs, le suivi des livraisons et les factures. Chaque
              acteur voit ce dont il a besoin — sans tableurs ni appels à
              répéter.
            </p>
          </div>
        </section>

        {/* Trois espaces */}
        <section className="mx-auto max-w-3xl px-5 py-14 sm:px-6 sm:py-16">
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em]" style={{ color: t.accent }}>
            Trois espaces
          </h2>
          <p className="mt-3 text-xl font-semibold tracking-tight sm:text-2xl" style={{ color: t.accentDark }}>
            Une plateforme, trois entrées.
          </p>

          <ul className="mt-10 divide-y" style={{ borderColor: t.border }}>
            {spaces.map((space) => {
              const Icon = space.icon;
              return (
                <li
                  key={space.title}
                  className="flex flex-col gap-4 py-8 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between sm:gap-8"
                  style={{ borderColor: t.border }}
                >
                  <div className="flex gap-4">
                    <span
                      className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-md"
                      style={{ backgroundColor: t.accentSubtle, color: t.accent }}
                      aria-hidden
                    >
                      <Icon className="h-5 w-5" strokeWidth={1.75} />
                    </span>
                    <div>
                      <h3 className="text-base font-semibold">{space.title}</h3>
                      <p className="mt-1.5 max-w-md text-sm leading-relaxed sm:text-base" style={{ color: t.muted }}>
                        {space.text}
                      </p>
                    </div>
                  </div>
                  <Link
                    href={space.href}
                    className="shrink-0 self-start text-sm font-semibold underline-offset-4 hover:underline sm:mt-1"
                    style={{ color: t.accent }}
                  >
                    {space.cta}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>

        {/* CTA final */}
        <section
          className="border-t"
          style={{
            borderColor: t.border,
            background: `linear-gradient(160deg, ${t.accentDark} 0%, #15202b 100%)`,
          }}
        >
          <div className="mx-auto max-w-3xl px-5 py-14 text-center sm:px-6 sm:py-16">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-white/50">
              {APP_NAME}
            </p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              Prêt à piloter vos livraisons ?
            </h2>
            <p className="mx-auto mt-3 max-w-md text-sm text-white/65 sm:text-base">
              Connectez-vous avec le compte fourni par votre administrateur, ou
              créez un compte entreprise.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/login"
                className="inline-flex min-h-11 items-center rounded-md bg-white px-6 py-3 text-sm font-semibold transition-opacity hover:opacity-95"
                style={{ color: t.accentDark }}
              >
                Connexion entreprise
              </Link>
              <Link
                href="/login/client"
                className="inline-flex min-h-11 items-center rounded-md border border-white/25 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10"
              >
                Portail client
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="px-5 py-6 sm:px-6" style={{ color: t.muted }}>
        <div className="mx-auto flex max-w-3xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm">
            <span className="font-semibold" style={{ color: t.foreground }}>
              {APP_NAME}
            </span>
            <span> — pilotage des livraisons B2B</span>
          </p>
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
            <Link href="/login" className="transition-opacity hover:opacity-70">
              Entreprise
            </Link>
            <Link href="/login/client" className="transition-opacity hover:opacity-70">
              Client
            </Link>
            <Link href="/login/driver" className="transition-opacity hover:opacity-70">
              Chauffeur
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
