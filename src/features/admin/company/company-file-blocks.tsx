import Link from "next/link";
import { ArrowRight, CircleSlash } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { HomeCard } from "@/features/admin/home/home-card";
import { cn } from "@/lib/utils";

/** Briques communes de la fiche entreprise (ADMIN-ESPACE lot 3), direction Menthe, Clair et Sombre. */

export function BlockTitle({ id, title, hint }: { id: string; title: string; hint?: string }) {
  return (
    <div className="min-w-0">
      <h2 id={id} className="text-lg font-bold tracking-tight text-foreground">{title}</h2>
      {hint && <p className="mt-0.5 text-sm text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function Block({
  id,
  title,
  hint,
  action,
  className,
  children,
}: {
  id: string;
  title: string;
  hint?: string;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <HomeCard aria-labelledby={id} className={cn("min-w-0", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <BlockTitle id={id} title={title} hint={hint} />
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </HomeCard>
  );
}

/** Bloc dont la lecture a échoué : jamais de zéro à la place d'un chiffre inconnu. */
export function Unavailable({ what }: { what: string }) {
  return (
    <p className="flex items-center gap-2 rounded-2xl bg-muted px-4 py-3 text-sm text-muted-foreground dark:bg-secondary">
      <CircleSlash className="h-4 w-4 shrink-0" aria-hidden />
      <span>
        <span className="font-semibold text-foreground">Indisponible.</span> {what}
      </span>
    </p>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-2xl bg-brand-subtle px-4 py-3 text-sm text-foreground">{children}</p>;
}

export function Field({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={cn("min-w-0", wide && "sm:col-span-2")}>
      <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">{label}</dt>
      <dd className="mt-1 break-words text-sm text-foreground">{children}</dd>
    </div>
  );
}

export function FieldGrid({ children }: { children: React.ReactNode }) {
  return <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">{children}</dl>;
}

/** Chiffre clé d'un bloc : valeur, libellé, précision. */
export function Stat({ label, value, note, tone }: { label: string; value: string; note?: string; tone?: "brand" | "warning" | "error" }) {
  return (
    <div className="min-w-0 rounded-2xl border border-border bg-background/60 px-4 py-3 dark:bg-background/40">
      <p className="text-xs font-semibold text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-1 text-2xl font-bold tabular-nums tracking-tight text-foreground",
          tone === "brand" && "text-brand",
          tone === "warning" && "text-[#a35a00] dark:text-warning",
          tone === "error" && "text-[#c43b2f] dark:text-error"
        )}
      >
        {value}
      </p>
      {note && <p className="mt-0.5 text-xs text-muted-foreground">{note}</p>}
    </div>
  );
}

/** Jauge « consommé / inclus » ; au-delà de 100 %, la barre est pleine et orange. */
export function LinkButton({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-border bg-card px-4 text-sm font-semibold text-foreground transition-colors hover:bg-[#f0f4f1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:hover:bg-secondary max-sm:w-full"
    >
      {children}
      <ArrowRight className="h-4 w-4" aria-hidden />
    </Link>
  );
}

export function StatusBadge({ status, label }: { status: string; label: string }) {
  return (
    <Badge variant={status === "ACTIVE" ? "success" : status === "TRIAL" ? "brand" : "secondary"}>
      {label}
    </Badge>
  );
}
