import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { fullDateLabel, relativeDayLabel } from "@/lib/format/relative-day";

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/** En-tête d'une fiche personne : retour, initiales, nom, et comment la joindre. */
export function PersonHeader({
  backHref,
  name,
  contact,
  role,
}: {
  backHref: string;
  name: string;
  contact: string;
  role: string;
}) {
  return (
    <div>
      <Button variant="ghost" size="sm" className="mb-3 -ml-2" asChild>
        <Link href={backHref}>
          <ArrowLeft className="mr-1 h-4 w-4" aria-hidden="true" />
          Retour
        </Link>
      </Button>
      <div className="flex min-w-0 items-center gap-4">
        <span
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#eef4f0] text-sm font-semibold text-foreground"
          aria-hidden="true"
        >
          {initialsOf(name)}
        </span>
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{role}</p>
          <h1 className="truncate text-2xl font-semibold tracking-tight">{name}</h1>
          <p className="truncate text-sm text-muted-foreground" title={contact}>
            {contact}
          </p>
        </div>
      </div>
    </div>
  );
}

/** `inline` : en milieu de phrase (« créée aujourd'hui 06:38 »), sans majuscule. */
export function RelativeTime({ date, withTime = true, inline = false }: { date: string; withTime?: boolean; inline?: boolean }) {
  const label = relativeDayLabel(date, undefined, { withTime });
  return (
    <time dateTime={date} title={fullDateLabel(date)}>
      {inline ? label.charAt(0).toLowerCase() + label.slice(1) : label}
    </time>
  );
}

/**
 * Une ligne de fiche : un titre lisible (adresse, client), le détail dessous, la
 * référence en petit, l'état à droite. Cliquable si `href` est fourni.
 */
export function RecordRow({
  title,
  detail,
  meta,
  aside,
  href,
}: {
  title: string;
  detail?: React.ReactNode;
  meta?: React.ReactNode;
  aside?: React.ReactNode;
  href?: string;
}) {
  const body = (
    <>
      <div className="min-w-0">
        <p className="truncate font-medium text-foreground" title={title}>
          {title}
        </p>
        {detail && <p className="truncate text-sm text-muted-foreground">{detail}</p>}
        {meta && <p className="truncate text-xs tabular-nums text-muted-foreground">{meta}</p>}
      </div>
      {aside && <div className="flex shrink-0 items-center gap-2">{aside}</div>}
    </>
  );
  const className = "flex items-center justify-between gap-3 rounded-xl border border-border p-3 text-sm";
  return href ? (
    <Link
      href={href}
      className={cn(
        className,
        "transition-colors hover:bg-[#f5f8f6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2"
      )}
    >
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}

/** Fil d'activité : un point par événement, l'heure, le détail ; la référence en petit. */
export function ActivityList({
  items,
  empty,
}: {
  items: { title: string; detail?: string | null; reference?: string | null; at: string }[];
  empty: string;
}) {
  if (!items.length) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <ol className="space-y-3">
      {items.map((item, index) => (
        <li key={index} className="flex gap-3 text-sm">
          <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#0e1310]" aria-hidden="true" />
          <div className="min-w-0">
            <p className="font-medium text-foreground">{item.title}</p>
            {item.detail && <p className="text-muted-foreground">{item.detail}</p>}
            <p className="text-xs tabular-nums text-muted-foreground">
              <RelativeTime date={item.at} />
              {item.reference ? ` · ${item.reference}` : ""}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
