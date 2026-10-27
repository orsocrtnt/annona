"use client";

import { useState } from "react";
import { AlertTriangle, ScrollText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAdminAccessEvents } from "@/features/admin/hooks";
import { isInitialQueryLoading } from "@/lib/query/is-initial-loading";

const RESOURCES = [
  "OVERVIEW",
  "SAAS_HEALTH",
  "SERVICE_HEALTH",
  "COMPANIES",
  "COMPANY_DETAIL",
  "USERS",
  "SUBSCRIPTIONS",
  "SUPPORT_TICKETS",
  "OPERATION_JOBS",
  "INCIDENTS",
  "ACCESS_EVENTS",
] as const;

const DECISIONS = [
  { value: "ALLOWED", label: "Autorisé" },
  { value: "DENIED", label: "Refusé" },
] as const;

const dateFormat = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });

export default function AdminAccessEventsPage() {
  const [resource, setResource] = useState("");
  const [decision, setDecision] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const { data, isLoading, error } = useAdminAccessEvents({ resource, decision, page, pageSize });

  if (isInitialQueryLoading(isLoading, data)) return <PageSkeleton />;

  if (error || !data) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Journal indisponible"
        description="Impossible de charger le journal des accès plateforme."
      />
    );
  }

  const pageCount = Math.max(1, Math.ceil(data.total / data.pageSize));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{"Journal d'accès"}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Lecture seule. Identifiant interne, rôle, ressource et décision.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="grid gap-1 text-sm">
          Ressource
          <Select value={resource || "ALL"} onValueChange={(value) => { setResource(value === "ALL" ? "" : value); setPage(1); }}>
            <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Toutes</SelectItem>
              {RESOURCES.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
            </SelectContent>
          </Select>
        </label>
        <label className="grid gap-1 text-sm">
          Décision
          <Select value={decision || "ALL"} onValueChange={(value) => { setDecision(value === "ALL" ? "" : value); setPage(1); }}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Toutes</SelectItem>
              {DECISIONS.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </label>
      </div>

      {data.total === 0 ? (
        <EmptyState icon={ScrollText} title="Aucun accès journalisé" description="Aucune entrée ne correspond à ces filtres." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Acteur</TableHead>
              <TableHead>Rôle</TableHead>
              <TableHead>Ressource</TableHead>
              <TableHead>Décision</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>{dateFormat.format(new Date(row.occurredAt))}</TableCell>
                <TableCell className="font-medium">{row.actorId}</TableCell>
                <TableCell>{row.role}</TableCell>
                <TableCell>{row.resource}</TableCell>
                <TableCell>{row.decision}</TableCell>
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
