import type { RoundJournalEntry } from "@/domains/round/round.types";
import { deadlineLabel } from "@/lib/format/delivery-date";
import { fr } from "@/lib/i18n/fr";

const t = fr.rounds;

/** RG-10 : journal des modifications des tournées du jour (qui, quand, quoi). */
export function RoundJournal({ entries }: { entries: RoundJournalEntry[] }) {
  return (
    <section aria-labelledby="round-journal" className="space-y-2" data-testid="round-journal">
      <h2 id="round-journal" className="text-lg font-semibold">{t.journal}</h2>
      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t.journalEmpty}</p>
      ) : (
        <ol className="divide-y rounded-xl border bg-card">
          {entries.slice(0, 50).map((entry) => (
            <li key={entry.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-2.5 text-sm" data-testid="round-journal-entry">
              <span className="font-medium">{t.actions[entry.action] ?? entry.action}</span>
              {entry.roundName ? <span className="text-muted-foreground">{entry.roundName}</span> : null}
              {entry.details.length > 0 ? <span className="min-w-0 basis-full sm:basis-auto">{entry.details.join(" · ")}</span> : null}
              <span className="ml-auto text-xs text-muted-foreground">
                {entry.actorName ?? t.system} · {deadlineLabel(entry.at)}
                {entry.afterCutoff ? ` · ${t.journalAfterCutoff}` : ""}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
