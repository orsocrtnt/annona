import type { Metadata } from "next";
import Link from "next/link";
import { BellRing, Check, Clock } from "lucide-react";
import { APP_NAME } from "@/lib/constants";
import { GrowthShell } from "@/features/landing/growth-shell";
import { WaitlistForm } from "@/features/landing/waitlist-form";

export const metadata: Metadata = {
  title: `Tarifs — ${APP_NAME}`,
  description: "TutelLiv arrive bientôt : inscrivez-vous sur la liste d'attente pour faire partie des premières entreprises.",
};

/**
 * Page provisoire (5 novembre 2026, demande du propriétaire) : les formules ne sont pas encore publiées.
 * L'ancienne grille, lue dans le catalogue, est dans l'historique Git (commit 5f87f2f et avant).
 */
const promises = [
  "Prévenu en priorité à l’ouverture.",
  "Aucun engagement, aucun paiement.",
  "Un échange avec nous pour préparer votre démarrage.",
] as const;

export default function TarifsPage() {
  return (
    <GrowthShell active="tarifs">
      <main id="main-content" tabIndex={-1} className="pb-20">
        <section className="mx-auto grid max-w-6xl gap-10 px-5 pb-14 pt-14 sm:px-6 sm:pt-20 lg:grid-cols-[0.9fr_1.1fr] lg:items-start lg:gap-14">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/80 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.16em] text-brand shadow-sm">
              <Clock className="h-3.5 w-3.5" aria-hidden />
              Bientôt disponible
            </div>
            <h1 className="mt-6 text-balance text-4xl font-bold tracking-[-0.04em] text-foreground sm:text-5xl lg:text-6xl">
              TutelLiv arrive bientôt.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">
              Nos formules seront publiées à l’ouverture. Vous voulez faire partie des premières entreprises à l’utiliser ? Inscrivez-vous sur la liste d’attente.
            </p>
            <ul className="mt-8 space-y-3">
              {promises.map((promise) => (
                <li key={promise} className="flex gap-3 text-sm leading-6 text-[#3b443e] dark:text-text-secondary sm:text-base">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-card text-brand shadow-sm ring-1 ring-border" aria-hidden>
                    <Check className="h-3 w-3" strokeWidth={2.4} />
                  </span>
                  <span>{promise}</span>
                </li>
              ))}
            </ul>
            <div className="mt-8 hidden items-center gap-3 rounded-2xl border border-border bg-card/80 p-4 text-sm text-muted-foreground lg:flex">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#e3f7ec] text-brand dark:bg-brand-subtle" aria-hidden>
                <BellRing className="h-5 w-5" />
              </span>
              <span>
                Une question avant l’ouverture ?{" "}
                <Link href="/contact" className="font-semibold text-foreground underline underline-offset-4">
                  Écrivez-nous
                </Link>
                .
              </span>
            </div>
          </div>
          <WaitlistForm />
        </section>
      </main>
    </GrowthShell>
  );
}
