"use client";

import { useState } from "react";
import { AlertTriangle, HeadphonesIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAdminSupportTickets } from "@/features/admin/hooks";
import { isInitialQueryLoading } from "@/lib/query/is-initial-loading";

const STATUSES = [
  { value: "OPEN", label: "Ouvert" },
  { value: "IN_PROGRESS", label: "En cours" },
  { value: "RESOLVED", label: "Résolu" },
  { value: "CLOSED", label: "Fermé" },
] as const;

const PRIORITIES = [
  { value: "LOW", label: "Basse" },
  { value: "NORMAL", label: "Normale" },
  { value: "HIGH", label: "Haute" },
  { value: "URGENT", label: "Urgente" },
] as const;

const statusLabel = Object.fromEntries(STATUSES.map((item) => [item.value, item.label]));
const priorityLabel = Object.fromEntries(PRIORITIES.map((item) => [item.value, item.label]));
const dateFormat = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });

export default function AdminSupportPage() {
  const [draftQuery, setDraftQuery] = useState("");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const { data, isLoading, error } = useAdminSupportTickets({ q, status, priority, page, pageSize });

  if (isInitialQueryLoading(isLoading, data)) return <PageSkeleton />;

  if (error || !data) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Tickets indisponibles"
        description="Impossible de charger la file de support de la plateforme."
      />
    );
  }

  const pageCount = Math.max(1, Math.ceil(data.total / data.pageSize));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Support plateforme</h1>
        <p className="mt-1 text-sm text-muted-foreground max-md:hidden">
          Métadonnées des tickets. Le sujet, les messages et l’identité du client ne sont pas affichés.
        </p>
      </div>

      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          setQ(draftQuery.trim());
          setPage(1);
        }}
      >
        <label className="grid gap-1 text-sm">
          Entreprise
          <Input value={draftQuery} maxLength={80} placeholder="Nom" onChange={(event) => setDraftQuery(event.target.value)} />
        </label>
        <label className="grid gap-1 text-sm">
          Statut
          <Select value={status || "ALL"} onValueChange={(value) => { setStatus(value === "ALL" ? "" : value); setPage(1); }}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Tous</SelectItem>
              {STATUSES.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </label>
        <label className="grid gap-1 text-sm">
          Priorité
          <Select value={priority || "ALL"} onValueChange={(value) => { setPriority(value === "ALL" ? "" : value); setPage(1); }}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Toutes</SelectItem>
              {PRIORITIES.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </label>
        <Button type="submit" variant="outline">Rechercher</Button>
      </form>

      {data.total === 0 ? (
        <EmptyState icon={HeadphonesIcon} title="Aucun ticket" description="Aucun ticket ne correspond à ces filtres." />
      ) : (
        <Table surface>
          <TableHeader>
            <TableRow>
              <TableHead>Entreprise</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Priorité</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Commande</TableHead>
              <TableHead>Livraison</TableHead>
              <TableHead>Créé</TableHead>
              <TableHead>Mis à jour</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium">{row.company}</TableCell>
                <TableCell><Badge variant={row.status === "OPEN" ? "success" : "secondary"}>{statusLabel[row.status]}</Badge></TableCell>
                <TableCell>{priorityLabel[row.priority]}</TableCell>
                <TableCell>{row.contactType === "DRIVER" ? "Livreur" : row.contactType === "ADMIN" ? "Admin" : "—"}</TableCell>
                <TableCell>{row.relatedOrderReference ?? "—"}</TableCell>
                <TableCell>{row.relatedDeliveryReference ?? "—"}</TableCell>
                <TableCell>{dateFormat.format(new Date(row.createdAt))}</TableCell>
                <TableCell>{dateFormat.format(new Date(row.updatedAt))}</TableCell>
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
