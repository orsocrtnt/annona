import type { ReactNode } from "react";
import Link from "next/link";
import { sora } from "@/app/(client-portal)/portal-font";
import { BrandLogo } from "@/components/brand/brand-logo";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { PublicSupportLink } from "@/features/support/public-support-link";
import { APP_NAME, SUPPORT_EMAIL } from "@/lib/constants";

const legalLink =
  "inline-flex min-h-11 items-center rounded-md px-1 text-muted-foreground hover:text-foreground hover:underline hover:underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/**
 * Coque des pages de connexion (direction C) : logo, contact et thème en haut, contenu centré, aide en bas.
 * Light Menthe / Dark « Encre + Pastel » par les jetons ; aucune image lourde.
 */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div
      className={`${sora.variable} flex min-h-dvh flex-col bg-background text-foreground`}
      style={{ fontFamily: "var(--font-sora), ui-sans-serif, system-ui, sans-serif" }}
    >
      <header className="mx-auto flex w-full max-w-[1180px] items-center justify-between gap-3 px-4 py-3">
        <Link
          href="/"
          className="inline-flex min-h-11 items-center rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={`Retour à l'accueil ${APP_NAME}`}
        >
          <BrandLogo className="dark:hidden" priority />
          <BrandLogo onDark className="hidden dark:inline-flex" />
        </Link>
        <div className="flex items-center gap-1">
          <ThemeToggle />
        </div>
      </header>

      <div className="grid flex-1 place-items-center px-4 pb-10 pt-6">{children}</div>

      <footer className="px-4 pb-6 text-center text-sm text-muted-foreground">
        {SUPPORT_EMAIL ? (
          <>
            Besoin d&apos;aide ?{" "}
            <PublicSupportLink className="inline-flex min-h-11 items-center font-medium text-text-secondary underline underline-offset-4 hover:text-foreground" />
          </>
        ) : null}
        <nav aria-label="Informations légales" className="flex flex-wrap justify-center gap-x-4">
          <Link href="/mentions-legales" className={legalLink}>Mentions légales</Link>
          <Link href="/confidentialite" className={legalLink}>Confidentialité</Link>
        </nav>
      </footer>
    </div>
  );
}
