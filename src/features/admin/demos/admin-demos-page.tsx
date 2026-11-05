"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { AlertTriangle, ArrowLeft, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { HomeCard } from "@/features/admin/home/home-card";
import { isInitialQueryLoading } from "@/lib/query/is-initial-loading";
import { useDemoPool, useResetDemoPool, type DemoPoolRow } from "@/features/admin/demos/demo-pool-query";

const STATUS: Record<DemoPoolRow["status"], { label: string; variant: "success" | "brand" | "secondary" | "warning" | "error" }> = {
  LIVE: { label: "En direct", variant: "success" },
  IN_USE: { label: "Ouverte, inactive", variant: "brand" },
  AVAILABLE: { label: "Disponible", variant: "secondary" },
  PREPARING: { label: "En préparation", variant: "warning" },
  ERROR: { label: "En erreur", variant: "error" },
};

const FAILURES: Record<string, string> = {
  INVALID_POOL_COMPANY: "espace qui n'est plus reconnu comme démo",
  EXTERNAL_ASSET_REFERENCE: "fichier ou logo ajouté pendant la démo",
  CROSS_TENANT_REFERENCE: "lien vers une autre entreprise",
  UNFINISHED_JOBS: "tâche de fond restée bloquée",
  RECYCLE_FAILED: "reconstruction échouée plusieurs fois",
};

function relative(iso: string | null, now: number): string {
  if (!iso) return "—";
  const minutes = Math.round((new Date(iso).getTime() - now) / 60_000);
  const abs = Math.abs(minutes);
  const text = abs < 1 ? "moins d'une minute" : abs < 60 ? `${abs} min` : `${Math.floor(abs / 60)} h ${String(abs % 60).padStart(2, "0")}`;
  if (abs < 1) return minutes <= 0 ? "à l'instant" : "dans moins d'une minute";
  return minutes < 0 ? `il y a ${text}` : `dans ${text}`;
}

function activity(row: DemoPoolRow): string {
  if (row.status !== "LIVE" && row.status !== "IN_USE") return "—";
  const parts = [
    `${row.ordersCreated} commande${row.ordersCreated > 1 ? "s" : ""} créée${row.ordersCreated > 1 ? "s" : ""}`,
    `${row.ticketsCreated} demande${row.ticketsCreated > 1 ? "s" : ""} de support`,
  ];
  return parts.join(" · ");
}

type Pending = { kind: "one"; row: DemoPoolRow } | { kind: "all" } | null;

/** Page « Démos » du super admin : chaque espace du stock, ce qu'on en sait, et la remise à neuf. */
export function AdminDemosPage() {
  const { data, isLoading, error, dataUpdatedAt } = useDemoPool();
  const reset = useResetDemoPool();
  const [pending, setPending] = useState<Pending>(null);

  if (isInitialQueryLoading(isLoading, data)) return <PageSkeleton />;
  if (error || !data) {
    return <EmptyState icon={AlertTriangle} title="Démos indisponibles" description="Impossible de charger les espaces de démonstration." />;
  }

  const now = dataUpdatedAt || Date.now();
  const confirm = async () => {
    if (!pending) return;
    const target = pending;
    setPending(null);
    try {
      const queued = await reset.mutateAsync(target.kind === "one" ? target.row.id : undefined);
      toast.success(
        target.kind === "one"
          ? `Démo n° ${target.row.slot} en cours de remise à neuf.`
          : queued > 0
            ? `${queued} démo${queued > 1 ? "s" : ""} en cours de remise à neuf.`
            : "Aucune démo à remettre à neuf.",
      );
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Remise à neuf impossible.");
    }
  };

  const liveRow = pending?.kind === "one" && pending.row.status === "LIVE";
  const usedRow = pending?.kind === "one" && pending.row.status === "IN_USE";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link href="/admin" className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Tableau de bord
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">Démos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {data.available} disponible{data.available > 1 ? "s" : ""} sur {data.total} · {data.live} en direct. Les visiteurs sont anonymes :
            on connaît les heures et ce qu&apos;ils ont créé, pas leur identité.
          </p>
        </div>
        <Button type="button" variant="outline" className="min-h-11 shrink-0" onClick={() => setPending({ kind: "all" })} disabled={reset.isPending}>
          <RotateCcw className="h-4 w-4" aria-hidden />
          Tout remettre à neuf
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {data.environments.map((row) => {
          const status = STATUS[row.status];
          const inUse = row.status === "LIVE" || row.status === "IN_USE";
          return (
            <HomeCard as="article" key={row.id} className="flex flex-col gap-3" aria-label={`Démo n° ${row.slot}`}>
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-bold tracking-tight">Démo n° {row.slot}</h2>
                <Badge variant={status.variant}>{status.label}</Badge>
              </div>
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm">
                {inUse ? (
                  <>
                    <dt className="text-muted-foreground">Ouverte</dt>
                    <dd>{relative(row.openedAt, now)}</dd>
                    <dt className="text-muted-foreground">Dernière activité</dt>
                    <dd>{relative(row.lastActivityAt, now)}</dd>
                    <dt className="text-muted-foreground">Se libère</dt>
                    <dd>{relative(row.expiresAt, now)}</dd>
                    <dt className="text-muted-foreground">A fait</dt>
                    <dd>{activity(row)}</dd>
                  </>
                ) : row.status === "ERROR" ? (
                  <>
                    <dt className="text-muted-foreground">Raison</dt>
                    <dd>{(row.failureCode && FAILURES[row.failureCode]) ?? row.failureCode ?? "inconnue"}</dd>
                  </>
                ) : (
                  <>
                    <dt className="text-muted-foreground">État</dt>
                    <dd>{row.status === "AVAILABLE" ? "Prête pour le prochain visiteur" : "Se reconstruit, prête dans quelques instants"}</dd>
                  </>
                )}
              </dl>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-auto min-h-11 self-start"
                disabled={!row.resettable || reset.isPending}
                onClick={() => setPending({ kind: "one", row })}
              >
                <RotateCcw className="h-4 w-4" aria-hidden />
                Remettre à neuf
              </Button>
            </HomeCard>
          );
        })}
      </div>

      <Dialog open={pending !== null} onOpenChange={(open) => { if (!open) setPending(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {pending?.kind === "one" ? `Remettre à neuf la démo n° ${pending.row.slot} ?` : "Tout remettre à neuf ?"}
            </DialogTitle>
            <DialogDescription>
              {pending?.kind === "all"
                ? "Toutes les démos où personne n'est en direct sont reconstruites avec des données fraîches. Les démos en direct ne sont pas touchées."
                : liveRow
                  ? "Quelqu'un est dessus en ce moment : sa démo s'arrêtera et il devra en rouvrir une. Les données sont reconstruites à neuf."
                  : usedRow
                    ? "Cette démo est encore ouverte mais personne n'y est actif. Elle sera libérée et reconstruite avec des données fraîches."
                    : "La démo est reconstruite avec des données fraîches. Si elle était en erreur, la cause est vérifiée de nouveau."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPending(null)}>Annuler</Button>
            <Button type="button" variant={liveRow ? "destructive" : "brand"} onClick={() => void confirm()}>
              Remettre à neuf
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
