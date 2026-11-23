import Link from "next/link";
import { AlertTriangle, ArrowRight, CheckCircle2, XCircle } from "lucide-react";
import { HomeCard } from "@/features/admin/home/home-card";
import { cn } from "@/lib/utils";
import type { AdminHomeHealth } from "@/domains/admin/admin-home.service";

/** Voyant : la couleur s'accompagne toujours d'une icône et d'un mot. */
const LEVELS = {
  green: { label: "Tout va bien", icon: CheckCircle2, dot: "bg-brand", text: "text-brand", surface: "bg-brand-subtle" },
  orange: { label: "À surveiller", icon: AlertTriangle, dot: "bg-warning", text: "text-warning", surface: "bg-warning-subtle" },
  red: { label: "Panne", icon: XCircle, dot: "bg-error", text: "text-error", surface: "bg-error-subtle" },
} as const;

const timeFormat = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" });

export function AdminHealthSignal({ health }: { health: AdminHomeHealth }) {
  const level = LEVELS[health.level];
  const Icon = level.icon;
  return (
    <HomeCard aria-labelledby="admin-health-title" className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-start gap-4">
        <span className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl", level.surface)} aria-hidden>
          <Icon className={cn("h-6 w-6", level.text)} />
        </span>
        <div className="min-w-0">
          <h2 id="admin-health-title" className="flex items-start gap-2 text-lg font-bold leading-snug tracking-tight text-foreground">
            {/* RETOURS-1, remarque 11 : la pastille ne rétrécit plus et reste alignée sur la première ligne du titre. */}
            <span className={cn("mt-2 h-2.5 w-2.5 shrink-0 rounded-full", level.dot)} aria-hidden />
            <span>Santé de la plateforme : {level.label}</span>
          </h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            {health.sentence}
            {health.checkedAt && <> Vérifié à {timeFormat.format(new Date(health.checkedAt))}.</>}
          </p>
        </div>
      </div>
      <Link
        href="/admin/operations"
        className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-full border border-border bg-card px-4 text-sm font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:hover:bg-secondary max-sm:w-full"
      >
        Ouvrir Exploitation
        <ArrowRight className="h-4 w-4" aria-hidden />
      </Link>
    </HomeCard>
  );
}
