"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, Building2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAdminCompanies } from "@/features/admin/hooks";
import { isInitialQueryLoading } from "@/lib/query/is-initial-loading";

const STATUSES = [
  { value: "ACTIVE", label: "Active" },
  { value: "INACTIVE", label: "Inactive" },
  { value: "SUSPENDED", label: "Suspendue" },
  { value: "TRIAL", label: "Essai" },
] as const;
const statusLabel = Object.fromEntries(STATUSES.map((item) => [item.value, item.label]));
const dateFormat = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeZone: "UTC" });

export default function CompaniesPage() {
  const [draftQuery, setDraftQuery] = useState("");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const { data, isLoading, error } = useAdminCompanies({ q, status, page, pageSize });

  if (isInitialQueryLoading(isLoading, data)) return <PageSkeleton />;
  if (error || !data) {
    return <EmptyState icon={AlertTriangle} title="Entreprises indisponibles" description="Impossible de charger les entreprises." />;
  }

  const pageCount = Math.max(1, Math.ceil(data.total / data.pageSize));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Entreprises</h1>
        <p className="mt-1 text-sm text-muted-foreground">Liste en lecture seule des entreprises de la plateforme.</p>
      </div>
      <form className="flex flex-wrap items-end gap-3" onSubmit={(event) => { event.preventDefault(); setQ(draftQuery.trim()); setPage(1); }}>
        <label className="grid gap-1 text-sm">
          Nom
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
        <Button type="submit" variant="outline">Rechercher</Button>
      </form>
      {data.total === 0 ? (
        <EmptyState icon={Building2} title="Aucune entreprise" description="Aucune entreprise ne correspond à ces filtres." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Entreprise</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Créée</TableHead>
              <TableHead>Utilisateurs</TableHead>
              <TableHead>Livraisons</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium">
                  <Link href={`/companies/${row.id}`}>{row.name}</Link>
                </TableCell>
                <TableCell>
                  <Badge variant={row.status === "ACTIVE" ? "success" : row.status === "TRIAL" ? "brand" : "secondary"}>
                    {statusLabel[row.status]}
                  </Badge>
                </TableCell>
                <TableCell>{dateFormat.format(new Date(row.createdAt))}</TableCell>
                <TableCell>{row.userCount}</TableCell>
                <TableCell>{row.deliveryCount}</TableCell>
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
