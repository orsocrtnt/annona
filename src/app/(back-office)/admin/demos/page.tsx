"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { AdminDemoEnvironment } from "@/features/admin/api";
import { useAdminDemos, useResetAdminDemos } from "@/features/admin/hooks";
import { isInitialQueryLoading } from "@/lib/query/is-initial-loading";

const STATUS: Record<AdminDemoEnvironment["status"], { label: string; variant: "success" | "warning" | "brand" }> = {
  FREE: { label: "Libre", variant: "success" },
  PREPARING: { label: "En préparation", variant: "warning" },
  IN_USE: { label: "Utilisée", variant: "brand" },
};
const timeFormat = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" });
const formatTime = (value: string | null) => (value ? timeFormat.format(new Date(value)) : "—");

/**
 * DEMO-1 : suivi des démos par le super admin. Une démo est remise à neuf quand son visiteur se déconnecte,
 * chaque soir à minuit, ou d'un coup avec « Tout déconnecter ».
 */
export default function AdminDemosPage() {
  const { data, isLoading, error } = useAdminDemos();
  const reset = useResetAdminDemos();
  const [confirming, setConfirming] = useState(false);
  const inUse = data?.filter((env) => env.status === "IN_USE").length ?? 0;

  async function disconnectAll() {
    try {
      const { disconnected } = await reset.mutateAsync();
      toast.success(
        disconnected === 0
          ? "Aucun visiteur n'était connecté. Toutes les démos sont libres."
          : `${disconnected} visiteur${disconnected > 1 ? "s déconnectés" : " déconnecté"}. Toutes les démos sont libres.`,
      );
      setConfirming(false);
    } catch {
      toast.error("Les démos n'ont pas pu être déconnectées. Réessayez.");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Démos</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Une démo par visiteur. Elle est remise à neuf quand il se déconnecte, chaque soir à minuit, ou tout de suite
            avec « Tout déconnecter ».
          </p>
        </div>
        <Button type="button" variant="destructive" disabled={!data} onClick={() => setConfirming(true)}>
          Tout déconnecter
        </Button>
      </div>

      {isInitialQueryLoading(isLoading, data) ? <PageSkeleton /> : error || !data ? (
        <EmptyState icon={AlertTriangle} title="Démos indisponibles" description="Impossible de lire l'état des démos." />
      ) : (
        <>
          <p className="text-sm" role="status">
            {inUse === 0 ? `Les ${data.length} démos sont libres.` : `${inUse} démo${inUse > 1 ? "s utilisées" : " utilisée"} sur ${data.length}.`}
          </p>
          <Table surface>
            <TableHeader>
              <TableRow>
                <TableHead>Démo</TableHead>
                <TableHead>État</TableHead>
                <TableHead>Ouverte à</TableHead>
                <TableHead>Se ferme au plus tard à</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((env) => (
                <TableRow key={env.slot} data-status={env.status}>
                  <TableCell className="font-medium">Démo {env.slot}</TableCell>
                  <TableCell><Badge variant={STATUS[env.status].variant}>{STATUS[env.status].label}</Badge></TableCell>
                  <TableCell>{formatTime(env.leasedAt)}</TableCell>
                  <TableCell>{formatTime(env.leaseExpiresAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </>
      )}

      <Dialog open={confirming} onOpenChange={(open) => { if (!reset.isPending) setConfirming(open); }}>
        <DialogContent data-testid="demo-reset-dialog">
          <DialogHeader>
            <DialogTitle>Déconnecter toutes les démos ?</DialogTitle>
            <DialogDescription>
              {inUse === 0
                ? "Aucun visiteur n'est connecté pour le moment. Toutes les démos seront remises à neuf avant leur prochain prêt."
                : `${inUse} visiteur${inUse > 1 ? "s seront renvoyés" : " sera renvoyé"} à la page de connexion et ce qu'${inUse > 1 ? "ils ont" : "il a"} saisi dans la démo sera effacé.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={reset.isPending} onClick={() => setConfirming(false)}>Annuler</Button>
            <Button type="button" variant="destructive" loading={reset.isPending} onClick={disconnectAll}>Tout déconnecter</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
