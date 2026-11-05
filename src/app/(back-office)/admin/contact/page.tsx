"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useContactMessages } from "@/features/admin/contact-messages";
import { markContactVisited } from "@/features/admin/contact-last-visit";
import { isInitialQueryLoading } from "@/lib/query/is-initial-loading";

const dateFormat = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Paris" });

export default function AdminContactMessagesPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const { data, isLoading, error } = useContactMessages(page, pageSize);
  // ADMIN-ESPACE : une fois les messages affichés, la pastille « nouveaux messages » repart de zéro
  // (date gardée dans ce navigateur seulement).
  const loaded = Boolean(data);
  useEffect(() => {
    if (loaded) markContactVisited();
  }, [loaded]);

  if (isInitialQueryLoading(isLoading, data)) return <PageSkeleton />;
  if (error || !data) {
    return <EmptyState icon={AlertTriangle} title="Messages indisponibles" description="Impossible de charger les messages Contact." />;
  }

  const pageCount = Math.max(1, Math.ceil(data.total / data.pageSize));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Messages Contact</h1>
        <p className="mt-1 text-sm text-muted-foreground max-md:hidden">
          Demandes reçues par le formulaire public, les plus récentes d&apos;abord. Lecture seule ; répondez depuis votre messagerie.
        </p>
      </div>
      {data.total === 0 ? (
        <EmptyState icon={Inbox} title="Aucun message" description="Aucune demande n'a encore été envoyée par le formulaire Contact." />
      ) : (
        <ul className="space-y-3">
          {data.items.map((row) => (
            <li key={row.id} className="rounded-lg border bg-background p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-medium">
                  {row.name}
                  {row.company && <span className="font-normal text-muted-foreground"> · {row.company}</span>}
                </p>
                <time className="text-xs text-muted-foreground" dateTime={row.createdAt}>{dateFormat.format(new Date(row.createdAt))}</time>
              </div>
              <p className="mt-1 break-all text-sm">
                <a className="text-brand hover:underline" href={`mailto:${row.email}`}>{row.email}</a>
                {row.phone && <span className="text-muted-foreground"> · {row.phone}</span>}
              </p>
              <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6">{row.message}</p>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm">
          Messages
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
    </div>
  );
}
