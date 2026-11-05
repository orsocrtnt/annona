import Link from "next/link";
import { ArrowRight, Flag } from "lucide-react";
import { HomeCard } from "@/features/admin/home/home-card";
import type { AdminHomePilots } from "@/domains/admin/admin-home.service";

const numberFormat = new Intl.NumberFormat("fr-FR");

/** ADMIN-ESPACE lot 4 : ligne « pilotes en cours » de l'accueil, sous les 4 chiffres clés (grille inchangée). */
export function AdminPilotsLine({ pilots }: { pilots: AdminHomePilots | null }) {
  return (
    <HomeCard as="section" aria-labelledby="admin-pilots-title" className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:py-4">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#e3f7ec] text-brand dark:bg-brand-subtle" aria-hidden>
          <Flag className="h-[18px] w-[18px]" />
        </span>
        <div className="min-w-0">
          <h2 id="admin-pilots-title" className="text-sm font-semibold text-muted-foreground">Pilotes en cours</h2>
          {pilots ? (
            <p className="text-foreground">
              <span className="text-2xl font-bold tabular-nums tracking-tight">{numberFormat.format(pilots.inProgress)}</span>{" "}
              <span className="ml-1 text-sm text-muted-foreground">
                {numberFormat.format(pilots.preparing)} en préparation · {numberFormat.format(pilots.finished)} sorti{pilots.finished > 1 ? "s" : ""}
              </span>
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">Indisponible : lecture des pilotes impossible.</p>
          )}
        </div>
      </div>
      <Link
        href="/admin/pilots"
        className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-lg text-sm font-semibold text-brand hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Voir les pilotes
        <ArrowRight className="h-4 w-4" aria-hidden />
      </Link>
    </HomeCard>
  );
}
