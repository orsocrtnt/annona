"use client";

import { useEffect, useId, useState } from "react";
import { Building2, Loader2, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useAdminCompanies } from "@/features/admin/hooks";

export type PickedCompany = { id: string; name: string } | null;

const MAX_SHOWN = 8;

/** Choix de l'entreprise TutelLiv liée : recherche par nom (liste plateforme), facultatif. */
export function PilotCompanyPicker({ value, onChange }: { value: PickedCompany; onChange: (company: PickedCompany) => void }) {
  const inputId = useId();
  const [draft, setDraft] = useState("");
  const [q, setQ] = useState("");
  useEffect(() => {
    const timer = window.setTimeout(() => setQ(draft.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [draft]);
  const enabled = q.length >= 2;
  const { data, isFetching, error } = useAdminCompanies({ q, page: 1, pageSize: 25 }, enabled);

  if (value) {
    return (
      <div className="flex min-h-11 items-center justify-between gap-2 rounded-xl border border-border bg-background px-3 py-2">
        <span className="flex min-w-0 items-center gap-2 text-sm font-semibold text-foreground">
          <Building2 className="h-4 w-4 shrink-0 text-brand" aria-hidden />
          <span className="truncate">{value.name}</span>
        </span>
        <button
          type="button"
          onClick={() => onChange(null)}
          className="inline-flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-lg px-2 text-sm font-semibold text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="h-4 w-4" aria-hidden />
          Retirer
        </button>
      </div>
    );
  }

  const rows = enabled ? (data?.rows ?? []).slice(0, MAX_SHOWN) : [];
  return (
    <div>
      <label htmlFor={inputId} className="sr-only">Rechercher une entreprise TutelLiv</label>
      <Input
        id={inputId}
        type="search"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        placeholder="Nom de l'entreprise (facultatif)"
        maxLength={80}
        autoComplete="off"
        className="min-h-11"
      />
      {enabled && (
        <div className="mt-2" aria-live="polite">
          {isFetching && !data ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Recherche…
            </p>
          ) : error ? (
            <p className="text-sm text-muted-foreground">Liste des entreprises indisponible.</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune entreprise ne porte ce nom.</p>
          ) : (
            <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
              {rows.map((company) => (
                <li key={company.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange({ id: company.id, name: company.name });
                      setDraft("");
                    }}
                    className="flex min-h-11 w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm text-foreground hover:bg-[#f0f4f1] focus-visible:bg-[#f0f4f1] focus-visible:outline-none dark:hover:bg-secondary dark:focus-visible:bg-secondary"
                  >
                    <span className="min-w-0 truncate font-semibold">{company.name}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {company.deliveryCount} livraison{company.deliveryCount > 1 ? "s" : ""}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
