"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, ClipboardList } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAdminSubscriptions } from "@/features/admin/hooks";
import { isInitialQueryLoading } from "@/lib/query/is-initial-loading";

const PLANS = [
  { value: "STARTER", label: "Starter" },
  { value: "PRO", label: "Pro" },
  { value: "BUSINESS", label: "Business" },
] as const;

const STATUSES = [
  { value: "PENDING_PAYMENT", label: "En attente de paiement" },
  { value: "ACTIVE", label: "Actif" },
  { value: "PAST_DUE", label: "Impayé" },
  { value: "RESTRICTED", label: "Restreint" },
  { value: "READ_ONLY", label: "Lecture seule" },
  { value: "CANCEL_AT_PERIOD_END", label: "Résiliation programmée" },
  { value: "CANCELLED", label: "Résilié" },
  { value: "EXPIRED", label: "Expiré" },
] as const;

const planLabel = Object.fromEntries(PLANS.map((plan) => [plan.value, plan.label]));
const statusLabel = Object.fromEntries(STATUSES.map((status) => [status.value, status.label]));
const FOLLOW_UP = {
  CURRENT: "À jour",
  REMIND: "À relancer",
  ENDING: "Résiliation en cours",
  STOPPED: "Ne paie plus",
} as const;
const dateFormat = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeZone: "UTC" });
const euroFormat = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });

function formatDate(value: string | null) {
  return value ? dateFormat.format(new Date(value)) : "—";
}

export default function AdminSubscriptionsPage() {
  const [draftQuery, setDraftQuery] = useState("");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [plan, setPlan] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const { data, isLoading, error } = useAdminSubscriptions({ q, status, plan, page, pageSize });

  if (isInitialQueryLoading(isLoading, data)) return <PageSkeleton />;

  if (error || !data) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Souscriptions indisponibles"
        description="Impossible de charger la liste des souscriptions commerciales."
      />
    );
  }

  const pageCount = Math.max(1, Math.ceil(data.total / data.pageSize));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Souscriptions</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {"Lecture seule des souscriptions commerciales. HT enregistré : prix de la formule et des options. Le suivi dit qui relancer. Aucun paiement Stripe n'est lu."}
        </p>
      </div>

      <dl className="grid gap-3 sm:grid-cols-4">
        <div>
          <dt className="text-sm text-muted-foreground">À jour</dt>
          <dd className="mt-1 text-2xl font-semibold">{data.summary.current}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">À relancer</dt>
          <dd className="mt-1 text-2xl font-semibold">{data.summary.remind}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">Résiliation en cours</dt>
          <dd className="mt-1 text-2xl font-semibold">{data.summary.ending}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">Ne paie plus</dt>
          <dd className="mt-1 text-2xl font-semibold">{data.summary.stopped}</dd>
        </div>
      </dl>

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
          <Input
            value={draftQuery}
            onChange={(event) => setDraftQuery(event.target.value)}
            placeholder="Nom"
            maxLength={80}
          />
        </label>
        <label className="grid gap-1 text-sm">
          Formule
          <Select
            value={plan || "ALL"}
            onValueChange={(value) => {
              setPlan(value === "ALL" ? "" : value);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Toutes</SelectItem>
              {PLANS.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </label>
        <label className="grid gap-1 text-sm">
          Statut
          <Select
            value={status || "ALL"}
            onValueChange={(value) => {
              setStatus(value === "ALL" ? "" : value);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Tous</SelectItem>
              {STATUSES.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </label>
        <Button type="submit" variant="outline">Rechercher</Button>
      </form>

      {data.total === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="Aucune souscription"
          description="Aucune souscription commerciale ne correspond à ces filtres."
        />
      ) : (
        <Table surface>
          <TableHeader>
            <TableRow>
              <TableHead>Entreprise</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Formule</TableHead>
              <TableHead>Suivi</TableHead>
              <TableHead>HT enregistré</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Périodicité</TableHead>
              <TableHead>Période</TableHead>
              <TableHead>Commandes</TableHead>
              <TableHead>Alerte</TableHead>
              <TableHead>Options et sièges</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium">
                  <Link href={`/companies/${row.companyId}`}>{row.company}</Link>
                </TableCell>
                <TableCell>{row.email ?? "—"}{row.phone ? ` · ${row.phone}` : ""}</TableCell>
                <TableCell>{row.plan ? planLabel[row.plan] : "Non déterminée"}</TableCell>
                <TableCell>{FOLLOW_UP[row.followUp]}</TableCell>
                <TableCell>{euroFormat.format(row.amountCents / 100)}</TableCell>
                <TableCell>
                  <Badge variant={row.status === "ACTIVE" ? "success" : "secondary"}>{statusLabel[row.status]}</Badge>
                </TableCell>
                <TableCell>{row.interval === "ANNUAL" ? "Annuel" : row.interval === "MONTHLY" ? "Mensuel" : "—"}</TableCell>
                <TableCell>{formatDate(row.periodStart)} – {formatDate(row.periodEnd)}</TableCell>
                <TableCell>{row.orders.consumed} / {row.orders.included} <span className="text-muted-foreground">(+{row.orders.overage})</span></TableCell>
                <TableCell>
                  {row.orders.included <= 0 ? "—" : row.usageAlertPercent === 120 ? "120 % ou plus" : row.usageAlertPercent === 100 ? "100 %" : row.usageAlertPercent === 80 ? "80 %" : "Sous 80 %"}
                </TableCell>
                <TableCell>
                  {row.quantities.options.map((option) => `${option.code} × ${option.quantity}`).join(", ") || "Aucune option"}
                  {" · "}
                  livreurs {row.quantities.seats.DRIVER_SEAT}, admins {row.quantities.seats.ADMIN_SEAT}, dispatchers {row.quantities.seats.DISPATCHER_SEAT}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm">
          Lignes
          <Select
            value={String(pageSize)}
            onValueChange={(value) => {
              setPageSize(Number(value));
              setPage(1);
            }}
          >
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
