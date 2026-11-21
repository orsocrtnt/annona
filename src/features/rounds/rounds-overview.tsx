"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { AdminRoundView } from "@/domains/round/round.types";
import { fr } from "@/lib/i18n/fr";

function time(iso: string | null) {
  return iso ? new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" }) : null;
}

/**
 * RETOURS-1 (tour de Théo, 21 novembre 2026), ADM-06 : en haut de l'onglet « Tournées », le nom de toutes les
 * tournées du jour d'un coup d'œil ; un clic ouvre la liste de ses clients (ordre, adresse, accès, commande,
 * colis, heure prévue, état).
 */
export function RoundsOverview({ rounds, colorOf }: { rounds: AdminRoundView[]; colorOf: (id: string) => string }) {
  const [openedId, setOpenedId] = useState<string | null>(null);
  const opened = rounds.find((round) => round.id === openedId) ?? null;
  if (rounds.length === 0) return null;
  return (
    <section aria-labelledby="rounds-overview" className="space-y-2">
      <h2 id="rounds-overview" className="text-lg font-semibold">
        Toutes les tournées <span className="text-sm font-normal text-muted-foreground">({rounds.length})</span>
      </h2>
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
        {rounds.map((round) => (
          <li key={round.id}>
            <button
              type="button"
              onClick={() => setOpenedId(round.id)}
              className="flex min-h-14 w-full items-center gap-3 rounded-xl border bg-card px-3 py-2 text-left transition-colors hover:bg-muted"
              data-testid={`rounds-overview-${round.name}`}
            >
              <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: colorOf(round.id) }} aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block font-semibold leading-tight">{round.name}</span>
                <span className="block text-xs text-muted-foreground">
                  {round.slotLabel} · {fr.rounds.stops(round.progress.total)} · {round.driverName ?? fr.rounds.noDriver}
                </span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
      <Dialog open={opened !== null} onOpenChange={(open) => !open && setOpenedId(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          {opened ? (
            <>
              <DialogHeader>
                <DialogTitle>{opened.name}</DialogTitle>
                <DialogDescription>
                  {opened.slotLabel} · {opened.driverName ?? fr.rounds.noDriver} · {fr.rounds.stops(opened.progress.total)} · {fr.roundStatus[opened.status]}
                </DialogDescription>
              </DialogHeader>
              {opened.stops.length === 0 ? <p className="text-sm text-muted-foreground">Aucun arrêt.</p> : null}
              <ol className="space-y-2" data-testid="rounds-overview-stops">
                {opened.stops.map((stop) => (
                  <li key={stop.id} className="flex gap-3 rounded-xl border p-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold tabular-nums">{stop.sequence}</span>
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <p className="font-semibold">{stop.merchantName}</p>
                        <Badge variant={stop.status === "DELIVERED" ? "success" : stop.incident ? "error" : "outline"}>
                          {stop.status === "DELIVERED" ? `Livré ${time(stop.deliveredAt) ?? ""}`.trim() : stop.incident ? "Incident" : time(stop.estimatedArrivalAt) ? `Prévu ${time(stop.estimatedArrivalAt)}` : "À livrer"}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{stop.address}</p>
                      {stop.accessInstructions ? <p className="text-sm"><span className="font-medium">Accès : </span>{stop.accessInstructions}</p> : null}
                      <p className="text-sm">
                        <Link href={`/dashboard/orders/${stop.orderId}`} prefetch={false} className="text-brand underline-offset-4 hover:underline">
                          {stop.orderReference}
                        </Link>
                        <span className="text-muted-foreground"> · {stop.items} articles · {stop.packages} colis</span>
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </section>
  );
}
