import Link from "next/link";
import { Clock } from "lucide-react";
import { fullDateLabel, relativeDayLabel } from "@/lib/format/relative-day";
import { isOrderOverdue } from "@/lib/orders/overdue";

/**
 * Cellules de tableau partagées par le back-office et le portail : une ligne se
 * reconnaît à ce qui parle (client, adresse), la référence reste en petit dessous
 * pour la recherche et les échanges avec le support.
 */
export function TableIdentityCell({
  href,
  title,
  subtitle,
  reference,
}: {
  href: string;
  title: string;
  subtitle?: string | null;
  reference: string;
}) {
  return (
    <Link
      href={href}
      // Lignes parfois cliquables en entier : le lien ne déclenche pas aussi la ligne.
      onClick={(event) => event.stopPropagation()}
      className="group block min-w-0 rounded-md py-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2"
    >
      <span className="block truncate font-medium text-foreground group-hover:underline" title={title}>
        {title}
      </span>
      {subtitle && (
        <span className="block truncate text-xs text-muted-foreground" title={subtitle}>
          {subtitle}
        </span>
      )}
      <span className="block truncate text-xs tabular-nums text-muted-foreground">{reference}</span>
    </Link>
  );
}

export function TableRelativeDateCell({ date }: { date: string }) {
  return (
    <time dateTime={date} title={fullDateLabel(date)} className="whitespace-nowrap text-muted-foreground">
      {relativeDayLabel(date)}
    </time>
  );
}

/** Échéance ; un retard se voit sans lire la date (texte + icône, pas la couleur seule). */
export function TableDueCell({
  status,
  date,
  deadline,
}: {
  status: string;
  date?: string | null;
  /** Échéance qui fait foi pour le retard (date demandée par le client), si différente de la date affichée. */
  deadline?: string | null;
}) {
  if (!date) return <span className="text-muted-foreground">—</span>;
  const late = isOrderOverdue(status, deadline ?? date);
  return (
    <div className="whitespace-nowrap">
      <time dateTime={date} title={fullDateLabel(date)} className={late ? "font-medium text-[#b3352a]" : undefined}>
        {relativeDayLabel(date, undefined, { withTime: true })}
      </time>
      {late && (
        <span className="mt-0.5 flex items-center gap-1 text-xs font-medium text-[#b3352a]">
          <Clock className="h-3 w-3" aria-hidden="true" />
          En retard
        </span>
      )}
    </div>
  );
}
