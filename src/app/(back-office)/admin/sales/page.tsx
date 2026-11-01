"use client";

import { useState, type FormEvent } from "react";
import { AlertTriangle, BadgePercent } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  SALES_CODE_LEVELS,
  useCreateSalesCode,
  useDisableSalesCode,
  useSalesCodeHistory,
  useSalesCodes,
  type SalesCommissionExplanation,
  type SalesCodeLevel,
  type SalesCodeRow,
} from "@/features/admin/sales-codes";
import { isInitialQueryLoading } from "@/lib/query/is-initial-loading";

const dateFormat = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeZone: "UTC" });
const levelLabel = (level: SalesCodeLevel) => SALES_CODE_LEVELS.find((item) => item.value === level)?.label ?? level;
const euros = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
const EXPLANATIONS: Record<SalesCommissionExplanation, string> = {
  ELIGIBLE: "Paiement commissionné",
  NOT_PAID: "Facture non payée",
  OUTSIDE_WINDOW: "Hors des douze mois",
  LATER_CHANGE_OR_USAGE: "Changement ou consommation",
  CONTRACT_CHANGED: "Contrat modifié",
  PARTIAL_PAYMENT: "Paiement partiel",
  UNRECOGNISED_INVOICE: "Facture non reconnue",
  REFUND: "Reprise sur remboursement",
};

function SalesCodeHistoryDialog({ row, onClose }: { row: SalesCodeRow | null; onClose: () => void }) {
  const { data, isLoading, error } = useSalesCodeHistory(row?.id ?? null);
  return (
    <Dialog open={row !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Historique de {row?.code}</DialogTitle>
          <DialogDescription>
            Commissions théoriques calculées sur les montants HT encaissés ; aucun versement n&apos;est déclenché.
          </DialogDescription>
        </DialogHeader>
        {isLoading && <p className="text-sm text-muted-foreground">Chargement…</p>}
        {error && <p className="text-sm text-destructive">Historique indisponible.</p>}
        {data && data.attributions.length === 0 && <p className="text-sm text-muted-foreground">Aucune entreprise attribuée à ce code.</p>}
        {data?.attributions.map((attribution) => (
          <section key={attribution.id} className="space-y-2 rounded-lg border p-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="font-medium">{attribution.companyName}</p>
              <p className="text-sm">Total : <strong>{euros.format(attribution.totalCommissionCents / 100)}</strong></p>
            </div>
            <p className="text-xs text-muted-foreground">
              {levelLabel(attribution.level)} · du {dateFormat.format(new Date(attribution.attributedAt))} au {dateFormat.format(new Date(attribution.eligibleUntil))}
            </p>
            {attribution.entries.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune facture encore rapprochée.</p>
            ) : (
              <Table>
                <TableHeader><TableRow><TableHead>Période</TableHead><TableHead>Motif</TableHead><TableHead>Base HT</TableHead><TableHead className="text-right">Commission</TableHead></TableRow></TableHeader>
                <TableBody>
                  {attribution.entries.map((entry, index) => (
                    <TableRow key={`${attribution.id}-${index}`}>
                      <TableCell>{dateFormat.format(new Date(entry.receivedAt))}</TableCell>
                      <TableCell>{EXPLANATIONS[entry.explanation]}</TableCell>
                      <TableCell>{euros.format(entry.eligibleHtCents / 100)}</TableCell>
                      <TableCell className="text-right">{euros.format(entry.commissionCents / 100)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </section>
        ))}
      </DialogContent>
    </Dialog>
  );
}

export default function AdminSalesCodesPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sellerName, setSellerName] = useState("");
  const [sellerEmail, setSellerEmail] = useState("");
  const [level, setLevel] = useState<SalesCodeLevel>("REFERRER");
  const [toDisable, setToDisable] = useState<SalesCodeRow | null>(null);
  const [historyOf, setHistoryOf] = useState<SalesCodeRow | null>(null);
  const { data, isLoading, error } = useSalesCodes(page, pageSize);
  const create = useCreateSalesCode();
  const disable = useDisableSalesCode();

  if (isInitialQueryLoading(isLoading, data)) return <PageSkeleton />;
  if (error || !data) {
    return <EmptyState icon={AlertTriangle} title="Codes indisponibles" description="Impossible de charger les codes commerciaux." />;
  }

  const pageCount = Math.max(1, Math.ceil(data.total / data.pageSize));

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    create.mutate({ sellerName: sellerName.trim(), sellerEmail: sellerEmail.trim(), level }, {
      onSuccess: (created) => {
        setSellerName("");
        setSellerEmail("");
        setPage(1);
        toast.success(`Code ${created.code} créé`);
      },
      onError: (failure) => toast.error("Création impossible", { description: failure.message }),
    });
  }

  function copySignupLink(code: string) {
    const link = `${window.location.origin}/register?code=${encodeURIComponent(code)}`;
    navigator.clipboard.writeText(link).then(
      () => toast.success("Lien d'inscription copié", { description: link }),
      () => toast.error("Copie impossible", { description: link }),
    );
  }

  function confirmDisable() {
    if (!toDisable) return;
    disable.mutate(toDisable.id, {
      onSuccess: () => toast.success(`Code ${toDisable.code} désactivé`),
      onError: (failure) => toast.error("Désactivation impossible", { description: failure.message }),
      onSettled: () => setToDisable(null),
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Codes commerciaux</h1>
        <p className="mt-1 text-sm text-muted-foreground max-md:hidden">
          Un code permanent par commercial. Le niveau est figé dans chaque inscription au moment de l&apos;activation ; aucune commission n&apos;est versée automatiquement.
        </p>
      </div>
      <form className="flex flex-wrap items-end gap-3 rounded-lg border p-4" onSubmit={submit}>
        <label className="grid gap-1 text-sm">
          Commercial
          <Input value={sellerName} required minLength={2} maxLength={120} placeholder="Prénom Nom" onChange={(event) => setSellerName(event.target.value)} />
        </label>
        <label className="grid gap-1 text-sm">
          E-mail
          <Input type="email" value={sellerEmail} required maxLength={200} placeholder="commercial@exemple.fr" onChange={(event) => setSellerEmail(event.target.value)} />
        </label>
        <label className="grid gap-1 text-sm">
          Niveau
          <Select value={level} onValueChange={(value) => setLevel(value as SalesCodeLevel)}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              {SALES_CODE_LEVELS.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </label>
        <Button type="submit" disabled={create.isPending}>{create.isPending ? "Création…" : "Créer le code"}</Button>
      </form>
      {data.total === 0 ? (
        <EmptyState icon={BadgePercent} title="Aucun code" description="Créez le premier code commercial ci-dessus." />
      ) : (
        <Table surface>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Commercial</TableHead>
              <TableHead>Niveau</TableHead>
              <TableHead>Entreprises</TableHead>
              <TableHead>État</TableHead>
              <TableHead>Créé le</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.items.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="whitespace-nowrap font-mono font-medium">{row.code}</TableCell>
                <TableCell>
                  <div className="font-medium">{row.sellerName}</div>
                  <div className="text-xs text-muted-foreground">{row.sellerEmail}</div>
                </TableCell>
                <TableCell>{levelLabel(row.level)}</TableCell>
                <TableCell>{row.attributions}</TableCell>
                <TableCell>
                  {row.disabledAt
                    ? <Badge variant="secondary">Désactivé le {dateFormat.format(new Date(row.disabledAt))}</Badge>
                    : <Badge>Actif</Badge>}
                </TableCell>
                <TableCell>{dateFormat.format(new Date(row.createdAt))}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="ghost" size="sm" onClick={() => setHistoryOf(row)}>Historique</Button>
                    {!row.disabledAt && (
                      <>
                        <Button type="button" variant="ghost" size="sm" onClick={() => copySignupLink(row.code)}>Copier le lien</Button>
                        <Button type="button" variant="outline" size="sm" onClick={() => setToDisable(row)}>Désactiver</Button>
                      </>
                    )}
                  </div>
                </TableCell>
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
      <SalesCodeHistoryDialog row={historyOf} onClose={() => setHistoryOf(null)} />
      <Dialog open={toDisable !== null} onOpenChange={(open) => { if (!open && !disable.isPending) setToDisable(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Désactiver {toDisable?.code} ?</DialogTitle>
            <DialogDescription>
              Le code ne pourra plus être saisi à l&apos;inscription, ni être réactivé. Les entreprises déjà attribuées le restent.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={disable.isPending} onClick={() => setToDisable(null)}>Annuler</Button>
            <Button type="button" variant="destructive" disabled={disable.isPending} onClick={confirmDisable}>
              {disable.isPending ? "Désactivation…" : "Désactiver"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
