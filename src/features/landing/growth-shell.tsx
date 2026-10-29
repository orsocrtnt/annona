import type { ReactNode } from "react";
import Link from "next/link";
import { Plus_Jakarta_Sans } from "next/font/google";
import { APP_NAME } from "@/lib/constants";
import { PublicTopNavbar } from "@/features/landing/public-top-navbar";

const display = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-growth",
  display: "swap",
});

type GrowthPage = "fonctionnalites" | "tarifs" | "demonstration" | "contact";

export function GrowthShell({
  active,
  children,
}: {
  active: GrowthPage;
  children: ReactNode;
}) {
  return (
    <div
      className={`${display.variable} relative min-h-screen overflow-hidden bg-background text-foreground`}
      data-growth-page={active}
      style={{ fontFamily: "var(--font-growth), ui-sans-serif, system-ui, sans-serif" }}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-0 h-[34rem] dark:hidden" aria-hidden>
        <div className="absolute -left-24 top-14 h-72 w-72 rounded-full bg-[#e3f7ec]/70 blur-3xl" />
        <div className="absolute -right-20 top-28 h-80 w-80 rounded-full bg-[#fdf4e4]/70 blur-3xl" />
        <div className="absolute left-1/2 top-0 h-56 w-56 -translate-x-1/2 rounded-full bg-card blur-3xl" />
      </div>

      <PublicTopNavbar />

      <div className="relative z-10">{children}</div>

      <footer className="relative z-10 border-t border-border bg-card/70">
        <div className="mx-auto flex max-w-6xl flex-col gap-5 px-5 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <p className="font-bold tracking-tight">{APP_NAME}</p>
            <p className="mt-1 text-sm text-muted-foreground">Pilotage des livraisons B2B.</p>
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-3 text-sm font-semibold text-[#506070] dark:text-text-secondary">
            <Link href="/" className="hover:text-[#243447] dark:hover:text-foreground hover:underline hover:underline-offset-4">Accueil</Link>
            <Link href="/register" className="hover:text-[#243447] dark:hover:text-foreground hover:underline hover:underline-offset-4">Créer un compte</Link>
            <Link href="/login/client" className="hover:text-[#243447] dark:hover:text-foreground hover:underline hover:underline-offset-4">Espace client</Link>
            <Link href="/login/driver" className="hover:text-[#243447] dark:hover:text-foreground hover:underline hover:underline-offset-4">Espace chauffeur</Link>
            <Link href="/contact" className="hover:text-[#243447] dark:hover:text-foreground hover:underline hover:underline-offset-4">Contact</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
