"use client";

import { useState } from "react";
import { AlertTriangle, Activity } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAdminOperationJobs, useAdminServiceHealth } from "@/features/admin/hooks";
import { isInitialQueryLoading } from "@/lib/query/is-initial-loading";

const STATUSES = [
  { value: "PENDING", label: "En attente" },
  { value: "PROCESSING", label: "En cours" },
  { value: "SUCCEEDED", label: "Réussi" },
  { value: "FAILED", label: "Échoué" },
] as const;
const TYPES = [
  { value: "AUTO_DISPATCH", label: "Dispatch automatique" },
  { value: "CLIENT_NOTIFICATION", label: "Notification client" },
  { value: "DELIVERY_INVOICE", label: "Facture à la livraison" },
] as const;
const statusLabel = Object.fromEntries(STATUSES.map((item) => [item.value, item.label]));
const typeLabel = Object.fromEntries(TYPES.map((item) => [item.value, item.label]));
const dateFormat = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });
const healthLabel = { ok: "Disponible", degraded: "Dégradé", down: "Indisponible" } as const;

function formatDate(value: string | null) {
  return value ? dateFormat.format(new Date(value)) : "—";
}

function healthVariant(status: keyof typeof healthLabel) {
  if (status === "down") return "destructive" as const;
  if (status === "degraded") return "warning" as const;
  return "success" as const;
}

function HealthPanel() {
  const { data, isLoading, error } = useAdminServiceHealth();
  if (isInitialQueryLoading(isLoading, data)) {
    return <p className="text-sm text-muted-foreground">Contrôle des services en cours.</p>;
  }
  if (error || !data) {
    return <EmptyState icon={AlertTriangle} title="Santé indisponible" description="Impossible de contrôler les services." />;
  }
  const checks = [
    { label: "Global", status: data.status, detail: null },
    { label: "Base", status: data.database.status, detail: `${data.database.durationMs} ms` },
    { label: "Stockage", status: data.storage.status, detail: `${data.storage.durationMs} ms` },
    { label: "File", status: data.queue.status, detail: `${data.queue.failed ?? "—"} échoués, ${data.queue.stale ?? "—"} bloqués` },
  ] as const;
  return (
    <section className="space-y-3" aria-label="Santé des services">
      <div className="flex flex-wrap gap-3">
        {checks.map((check) => (
          <div key={check.label} className="min-w-36 rounded-lg border px-4 py-3">
            <p className="text-sm text-muted-foreground">{check.label}</p>
            <Badge variant={healthVariant(check.status)}>{healthLabel[check.status]}</Badge>
            {check.detail ? <p className="mt-1 text-sm">{check.detail}</p> : null}
          </div>
        ))}
      </div>
      <p className="text-sm text-muted-foreground">Contrôlé le {formatDate(data.checkedAt)} UTC</p>
    </section>
  );
}

export default function AdminOperationsPage() {
  const [draftQuery, setDraftQuery] = useState("");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [type, setType] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const { data, isLoading, error } = useAdminOperationJobs({ q, status, type, page, pageSize });
  const jobsLoading = isInitialQueryLoading(isLoading, data);
  const pageCount = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Exploitation</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          File technique en lecture seule. Un traitement en cours verrouillé depuis dix minutes est signalé comme bloqué.
        </p>
      </div>
      <HealthPanel />
      <form className="flex flex-wrap items-end gap-3" onSubmit={(event) => { event.preventDefault(); setQ(draftQuery.trim()); setPage(1); }}>
        <label className="grid gap-1 text-sm">
          Entreprise
          <Input value={draftQuery} maxLength={80} placeholder="Nom" onChange={(event) => setDraftQuery(event.target.value)} />
        </label>
        <label className="grid gap-1 text-sm">
          Statut
          <Select value={status || "ALL"} onValueChange={(value) => { setStatus(value === "ALL" ? "" : value); setPage(1); }}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Tous</SelectItem>
              {STATUSES.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </label>
        <label className="grid gap-1 text-sm">
          Type
          <Select value={type || "ALL"} onValueChange={(value) => { setType(value === "ALL" ? "" : value); setPage(1); }}>
            <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Tous</SelectItem>
              {TYPES.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </label>
        <Button type="submit" variant="outline">Rechercher</Button>
      </form>
      {jobsLoading ? <PageSkeleton /> : error || !data ? (
        <EmptyState icon={AlertTriangle} title="Traitements indisponibles" description="Impossible de charger la file technique." />
      ) : data.total === 0 ? (
        <EmptyState icon={Activity} title="Aucun traitement" description="Aucun job ne correspond à ces filtres." />
      ) : (
        <Table surface>
          <TableHeader>
            <TableRow>
              <TableHead>Entreprise</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Tentatives</TableHead>
              <TableHead>Prochaine tentative</TableHead>
              <TableHead>Verrou</TableHead>
              <TableHead>Terminé</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.rows.map((row) => (
              <TableRow key={row.id} data-stale={row.stale ? "true" : "false"} data-failed={row.status === "FAILED" ? "true" : "false"}>
                <TableCell className="font-medium">{row.company ?? "Plateforme"}</TableCell>
                <TableCell>{typeLabel[row.type]}</TableCell>
                <TableCell>
                  <Badge variant={row.status === "FAILED" ? "destructive" : row.stale ? "brand" : "secondary"}>
                    {row.stale ? "Bloqué" : statusLabel[row.status]}
                  </Badge>
                </TableCell>
                <TableCell>{row.attempts} / {row.maxAttempts}</TableCell>
                <TableCell>{formatDate(row.nextAttemptAt)}</TableCell>
                <TableCell>{formatDate(row.lockedAt)}</TableCell>
                <TableCell>{formatDate(row.completedAt)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      {data ? <div className="flex flex-wrap items-center justify-between gap-3">
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
      </div> : null}
    </div>
  );
}
