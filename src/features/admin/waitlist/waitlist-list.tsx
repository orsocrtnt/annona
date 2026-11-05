"use client";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Download, Search, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { updateAdminWaitlistContacted, waitlistFilterParams } from "@/features/admin/api";
import { markWaitlistVisited, readWaitlistLastVisit } from "@/features/admin/contact-last-visit";
import { useAdminWaitlist } from "@/features/admin/hooks";
import { useUrlSearchQuery } from "@/features/admin/use-url-search-query";
import { HomeCard, HOME_CARD_CLASS } from "@/features/admin/home/home-card";
import { campaignLabel } from "@/features/admin/waitlist/waitlist-labels";
import { isInitialQueryLoading } from "@/lib/query/is-initial-loading";
import { cn } from "@/lib/utils";
import type { WaitlistContactedFilter, WaitlistEntry } from "@/domains/growth/waitlist.service";

const dateFormat = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Paris" });
const shortDate = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" });
const numberFormat = new Intl.NumberFormat("fr-FR");

const FILTERS: Array<{ value: WaitlistContactedFilter; label: string }> = [
  { value: "all", label: "Toutes" },
  { value: "no", label: "Pas encore contactées" },
  { value: "yes", label: "Contactées" },
];

interface ContactedToggleProps {
  entry: WaitlistEntry;
  /** Valeur demandée pendant l'enregistrement (affichée tout de suite), sinon `null`. */
  pendingValue: boolean | null;
  onToggle: (entry: WaitlistEntry, contacted: boolean) => void;
}

function ContactedToggle({ entry, pendingValue, onToggle }: ContactedToggleProps) {
  const pending = pendingValue !== null;
  const checked = pending ? pendingValue : entry.contactedAt !== null;
  return (
    <div className="min-w-0">
      <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-sm font-semibold text-foreground">
        <input
          type="checkbox"
          className="h-5 w-5 shrink-0 cursor-pointer accent-[#08783f] disabled:cursor-wait dark:accent-[#2fae6f]"
          checked={checked}
          disabled={pending}
          onChange={(event) => onToggle(entry, event.target.checked)}
          aria-describedby={checked ? `contacted-${entry.id}` : undefined}
        />
        Contacté
      </label>
      {pending && <p className="text-xs text-muted-foreground" aria-live="polite">Enregistrement…</p>}
      {!pending && checked && entry.contactedAt && (
        <p id={`contacted-${entry.id}`} className="text-xs text-muted-foreground">
          le {shortDate.format(new Date(entry.contactedAt))}
          {entry.contactedBy ? ` par ${entry.contactedBy}` : ""}
        </p>
      )}
    </div>
  );
}

function NewChip() {
  return (
    <span className="ml-2 inline-flex items-center rounded-full bg-[#e3f7ec] px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-[#08783f] dark:bg-brand-subtle dark:text-brand">
      Nouveau
    </span>
  );
}

/** ADMIN-ESPACE lot 2 : inscrits, recherche, filtre « contacté », case « contacté » et export CSV. */
export function WaitlistList() {
  const queryClient = useQueryClient();
  const [draftQuery, setDraftQuery] = useState("");
  const [q, setQ] = useState("");
  const [contacted, setContacted] = useState<WaitlistContactedFilter>("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  // ADMIN-ESPACE lot 3 : `?q=` venant de la recherche globale ou de la fiche entreprise.
  useUrlSearchQuery((value) => {
    setDraftQuery(value);
    setQ(value);
    setPage(1);
  });
  const [actionError, setActionError] = useState<string | null>(null);
  // Valeur cochée affichée tout de suite (état local synchrone), jusqu'à la relecture de la liste.
  const [optimistic, setOptimistic] = useState<Record<string, boolean>>({});
  // Dernière visite avant cette ouverture : sert à marquer les inscriptions arrivées depuis.
  const [previousVisit] = useState(() => readWaitlistLastVisit());
  const { data, isLoading, error, isFetching } = useAdminWaitlist({ q, contacted, page, pageSize });

  // Une fois la liste affichée, la pastille « nouvelles inscriptions » repart de zéro (navigateur seulement).
  const loaded = Boolean(data);
  useEffect(() => {
    if (loaded) markWaitlistVisited();
  }, [loaded]);

  const mutation = useMutation({
    mutationFn: ({ id, value }: { id: string; value: boolean }) => updateAdminWaitlistContacted(id, value),
    onMutate: () => setActionError(null),
    onError: (mutationError) => {
      setActionError(mutationError instanceof Error ? mutationError.message : "Enregistrement impossible.");
    },
    onSettled: async (_data, _error, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "waitlist"] });
      setOptimistic((current) => {
        const next = { ...current };
        delete next[variables.id];
        return next;
      });
    },
  });
  const pendingFor = (entry: WaitlistEntry) => optimistic[entry.id] ?? null;
  const toggle = (entry: WaitlistEntry, value: boolean) => {
    setOptimistic((current) => ({ ...current, [entry.id]: value }));
    mutation.mutate({ id: entry.id, value });
  };

  const exportParams = waitlistFilterParams({ q, contacted }).toString();
  const exportHref = `/api/admin/waitlist/export${exportParams ? `?${exportParams}` : ""}`;
  const isNew = (entry: WaitlistEntry) => previousVisit === null || entry.createdAt > previousVisit;

  if (isInitialQueryLoading(isLoading, data)) {
    return <div className={cn(HOME_CARD_CLASS, "h-96 animate-pulse")} aria-busy="true" aria-label="Chargement des inscriptions" />;
  }
  if (error || !data) {
    return <EmptyState icon={AlertTriangle} title="Inscriptions indisponibles" description="Impossible de charger la liste d'attente." />;
  }

  const pageCount = Math.max(1, Math.ceil(data.total / data.pageSize));
  const filterCount: Record<WaitlistContactedFilter, number> = {
    all: data.summary.total,
    yes: data.summary.contacted,
    no: data.summary.notContacted,
  };

  return (
    <HomeCard aria-labelledby="waitlist-list-title" className={cn(isFetching && "opacity-90")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="waitlist-list-title" className="text-lg font-bold tracking-tight text-foreground">Inscrits</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {numberFormat.format(data.summary.total)} au total, dont {numberFormat.format(data.summary.notContacted)} pas encore contacté
            {data.summary.notContacted > 1 ? "s" : ""}.
          </p>
        </div>
        <a
          href={exportHref}
          download
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-border bg-card px-4 text-sm font-semibold text-foreground transition-colors hover:bg-[#f0f4f1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:hover:bg-secondary max-sm:w-full"
        >
          <Download className="h-4 w-4" aria-hidden />
          Exporter en CSV
        </a>
      </div>

      <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div role="group" aria-label="Filtre contacté" className="flex flex-wrap gap-2">
          {FILTERS.map((filter) => (
            <button
              key={filter.value}
              type="button"
              aria-pressed={contacted === filter.value}
              onClick={() => {
                setContacted(filter.value);
                setPage(1);
              }}
              className={cn(
                "inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                contacted === filter.value
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-card text-muted-foreground hover:text-foreground"
              )}
            >
              {filter.label}
              <span className="tabular-nums opacity-80">{numberFormat.format(filterCount[filter.value])}</span>
            </button>
          ))}
        </div>
        <form
          role="search"
          className="flex w-full gap-2 lg:w-auto"
          onSubmit={(event) => {
            event.preventDefault();
            setQ(draftQuery.trim());
            setPage(1);
          }}
        >
          <label className="sr-only" htmlFor="waitlist-search">Rechercher un inscrit</label>
          <Input
            id="waitlist-search"
            type="search"
            value={draftQuery}
            onChange={(event) => setDraftQuery(event.target.value)}
            placeholder="Nom, entreprise, e-mail, téléphone, campagne"
            maxLength={120}
            className="min-h-11 min-w-0 flex-1 lg:w-80"
          />
          <Button type="submit" variant="outline" className="min-h-11 shrink-0" aria-label="Rechercher">
            <Search className="h-4 w-4" aria-hidden />
          </Button>
        </form>
      </div>

      {actionError && (
        <p role="alert" className="mt-4 rounded-xl border border-[#ead1c9] bg-[#fbefeb] px-4 py-3 text-sm font-semibold text-[#8a3b2a] dark:border-border dark:bg-secondary dark:text-error">
          {actionError}
        </p>
      )}

      {data.total === 0 ? (
        <div className="mt-6">
          <EmptyState
            icon={UserPlus}
            title={q ? "Aucun résultat" : contacted === "no" ? "Personne à contacter" : "Aucune inscription"}
            description={
              q
                ? "Aucune inscription ne correspond à cette recherche."
                : contacted === "no"
                  ? "Toutes les inscriptions ont été contactées."
                  : "Aucune inscription dans cette vue."
            }
          />
        </div>
      ) : (
        <>
          {/* Ordinateur : tableau. */}
          <div className="mt-4 overflow-x-auto rounded-2xl border border-border max-md:hidden">
            <table className="w-full text-sm">
              <caption className="sr-only">Inscriptions à la liste d&apos;attente, les plus récentes d&apos;abord</caption>
              <thead className="bg-secondary/60 text-left text-xs text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-2 font-semibold">Inscrit</th>
                  <th scope="col" className="px-4 py-2 font-semibold">Coordonnées</th>
                  <th scope="col" className="px-4 py-2 font-semibold">Inscrit le</th>
                  <th scope="col" className="px-4 py-2 font-semibold">Campagne</th>
                  <th scope="col" className="px-4 py-2 font-semibold">Suivi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.items.map((entry) => (
                  <tr key={entry.id} className="align-top">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-foreground">
                        {entry.name}
                        {isNew(entry) && <NewChip />}
                      </p>
                      <p className="text-muted-foreground">{entry.company ?? "—"}</p>
                    </td>
                    <td className="px-4 py-3">
                      <a className="break-all text-brand hover:underline" href={`mailto:${entry.email}`}>{entry.email}</a>
                      {entry.phone && (
                        <p>
                          <a className="text-muted-foreground hover:underline" href={`tel:${entry.phone.replace(/[^0-9+]/g, "")}`}>{entry.phone}</a>
                        </p>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                      <time dateTime={entry.createdAt}>{dateFormat.format(new Date(entry.createdAt))}</time>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{campaignLabel(entry.campaignCode)}</td>
                    <td className="px-4 py-3">
                      <ContactedToggle entry={entry} pendingValue={pendingFor(entry)} onToggle={toggle} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Téléphone : cartes. */}
          <ul className="mt-4 space-y-3 md:hidden">
            {data.items.map((entry) => (
              <li key={entry.id} className="rounded-2xl border border-border bg-background p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
                  <p className="min-w-0 font-semibold text-foreground">
                    {entry.name}
                    {isNew(entry) && <NewChip />}
                  </p>
                  <time className="text-xs text-muted-foreground" dateTime={entry.createdAt}>{shortDate.format(new Date(entry.createdAt))}</time>
                </div>
                <p className="text-sm text-muted-foreground">{entry.company ?? "—"}</p>
                <p className="mt-2 break-all text-sm">
                  <a className="text-brand hover:underline" href={`mailto:${entry.email}`}>{entry.email}</a>
                </p>
                {entry.phone && (
                  <p className="text-sm">
                    <a className="text-muted-foreground hover:underline" href={`tel:${entry.phone.replace(/[^0-9+]/g, "")}`}>{entry.phone}</a>
                  </p>
                )}
                <p className="mt-1 text-xs text-muted-foreground">Campagne : {campaignLabel(entry.campaignCode)}</p>
                <div className="mt-2 border-t border-border pt-1">
                  <ContactedToggle entry={entry} pendingValue={pendingFor(entry)} onToggle={toggle} />
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm">
          Inscriptions par page
          <Select value={String(pageSize)} onValueChange={(value) => { setPageSize(Number(value)); setPage(1); }}>
            <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="25">25</SelectItem>
              <SelectItem value="50">50</SelectItem>
              <SelectItem value="100">100</SelectItem>
            </SelectContent>
          </Select>
        </label>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Précédent</Button>
          <span className="text-sm text-muted-foreground">Page {page} / {pageCount}</span>
          <Button type="button" variant="outline" disabled={page >= pageCount} onClick={() => setPage((current) => current + 1)}>Suivant</Button>
        </div>
      </div>
    </HomeCard>
  );
}
