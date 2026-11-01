"use client";

import { useState } from "react";
import { AlertTriangle, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAdminUsers } from "@/features/admin/hooks";
import { isInitialQueryLoading } from "@/lib/query/is-initial-loading";

const ROLES = [
  { value: "SUPER_ADMIN", label: "Super admin" },
  { value: "COMPANY_ADMIN", label: "Administrateur" },
  { value: "MINI_ADMIN", label: "Mini-admin" },
  { value: "DISPATCHER", label: "Dispatcher" },
  { value: "DRIVER", label: "Livreur" },
  { value: "CLIENT", label: "Client" },
] as const;
const STATUSES = [
  { value: "ACTIVE", label: "Actif" },
  { value: "INACTIVE", label: "Inactif" },
  { value: "SUSPENDED", label: "Suspendu" },
  { value: "PENDING_VERIFICATION", label: "En vérification" },
] as const;
const roleLabel = Object.fromEntries(ROLES.map((item) => [item.value, item.label]));
const statusLabel = Object.fromEntries(STATUSES.map((item) => [item.value, item.label]));
const dateFormat = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeZone: "UTC" });

export default function AdminUsersPage() {
  const [draftQuery, setDraftQuery] = useState("");
  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const { data, isLoading, error } = useAdminUsers({ q, role, status, page, pageSize });

  if (isInitialQueryLoading(isLoading, data)) return <PageSkeleton />;
  if (error || !data) {
    return <EmptyState icon={AlertTriangle} title="Comptes indisponibles" description="Impossible de charger les comptes." />;
  }

  const pageCount = Math.max(1, Math.ceil(data.total / data.pageSize));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Comptes</h1>
        <p className="mt-1 text-sm text-muted-foreground max-md:hidden">Consultation en lecture seule. Aucune action de gestion.</p>
      </div>
      <form className="flex flex-wrap items-end gap-3" onSubmit={(event) => { event.preventDefault(); setQ(draftQuery.trim()); setPage(1); }}>
        <label className="grid gap-1 text-sm">
          Recherche
          <Input value={draftQuery} maxLength={80} placeholder="Nom ou entreprise" onChange={(event) => setDraftQuery(event.target.value)} />
        </label>
        <label className="grid gap-1 text-sm">
          Rôle
          <Select value={role || "ALL"} onValueChange={(value) => { setRole(value === "ALL" ? "" : value); setPage(1); }}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Tous</SelectItem>
              {ROLES.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
            </SelectContent>
          </Select>
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
        <Button type="submit" variant="outline">Rechercher</Button>
      </form>
      {data.total === 0 ? (
        <EmptyState icon={Users} title="Aucun compte" description="Aucun compte ne correspond à ces filtres." />
      ) : (
        <Table surface>
          <TableHeader>
            <TableRow>
              <TableHead>Nom</TableHead>
              <TableHead>Rôle</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Entreprise</TableHead>
              <TableHead>Créé</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium">{row.name}</TableCell>
                <TableCell>{roleLabel[row.role]}</TableCell>
                <TableCell><Badge variant="secondary">{statusLabel[row.status]}</Badge></TableCell>
                <TableCell>{row.company ?? "—"}</TableCell>
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
