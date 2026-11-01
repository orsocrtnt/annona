"use client";

import { useState } from "react";
import { AlertTriangle, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAdminIncidents } from "@/features/admin/hooks";
import { isInitialQueryLoading } from "@/lib/query/is-initial-loading";

const VISIBILITIES = [
  { value: "INTERNAL", label: "Interne" },
  { value: "SHARED", label: "Partagé" },
] as const;
const STATES = {
  OPEN: "Ouvert",
  ACKNOWLEDGED: "Pris en compte",
  RESOLVED: "Résolu",
  CLOSED: "Clôturé",
} as const;
const dateFormat = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });

export default function AdminIncidentsPage() {
  const [draftQuery, setDraftQuery] = useState("");
  const [q, setQ] = useState("");
  const [visibility, setVisibility] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const { data, isLoading, error } = useAdminIncidents({ q, visibility, page, pageSize });

  if (isInitialQueryLoading(isLoading, data)) return <PageSkeleton />;
  if (error || !data) {
    return <EmptyState icon={AlertTriangle} title="Incidents indisponibles" description="Impossible de charger les incidents." />;
  }

  const pageCount = Math.max(1, Math.ceil(data.total / data.pageSize));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Incidents</h1>
        <p className="mt-1 text-sm text-muted-foreground max-md:hidden">
          Métadonnées des incidents déjà enregistrés. Lecture seule, sans contenu.
        </p>
      </div>
      <form className="flex flex-wrap items-end gap-3" onSubmit={(event) => { event.preventDefault(); setQ(draftQuery.trim()); setPage(1); }}>
        <label className="grid gap-1 text-sm">
          Entreprise
          <Input value={draftQuery} maxLength={80} placeholder="Nom" onChange={(event) => setDraftQuery(event.target.value)} />
        </label>
        <label className="grid gap-1 text-sm">
          Visibilité
          <Select value={visibility || "ALL"} onValueChange={(value) => { setVisibility(value === "ALL" ? "" : value); setPage(1); }}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Toutes</SelectItem>
              {VISIBILITIES.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </label>
        <Button type="submit" variant="outline">Rechercher</Button>
      </form>
      {data.total === 0 ? (
        <EmptyState icon={ShieldAlert} title="Aucun incident" description="Aucun incident ne correspond à ces filtres." />
      ) : (
        <Table surface>
          <TableHeader>
            <TableRow>
              <TableHead>Entreprise</TableHead>
              <TableHead>Commande</TableHead>
              <TableHead>Visibilité</TableHead>
              <TableHead>État</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium">{row.company}</TableCell>
                <TableCell>{row.orderReference}</TableCell>
                <TableCell>{row.visibility === "INTERNAL" ? "Interne" : "Partagé"}</TableCell>
                <TableCell>
                  <Badge variant={row.state === "OPEN" ? "destructive" : "secondary"}>{STATES[row.state]}</Badge>
                </TableCell>
                <TableCell>{dateFormat.format(new Date(row.createdAt))}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm">
          Lignes
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
