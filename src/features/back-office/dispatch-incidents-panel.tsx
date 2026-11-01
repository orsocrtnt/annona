"use client";

import { useMediaQuery } from "@/hooks/use-media-query";
import { MOBILE_CARDS_QUERY } from "@/lib/table/mobile-cards";
import Link from "next/link";
import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { dateTimeLabel } from "@/lib/format/relative-day";
import { buildDispatchTargetHref } from "./dispatch-focus";
import { DispatchSuggestionsPanel } from "./dispatch-suggestions-panel";
import { useDispatchIncidents } from "./hooks";

const MOBILE_INCIDENTS = 3;

/** Retards, livreurs indisponibles et urgences : chaque nouvelle proposition reste validée par le dispatcher. */
export function DispatchIncidentsPanel() {
  const { data: incidents } = useDispatchIncidents();
  const [openId, setOpenId] = useState<string | null>(null);
  // Téléphone : les 3 premiers imprévus, le reste à la demande, pour que la file reste atteignable.
  const isMobile = useMediaQuery(MOBILE_CARDS_QUERY);
  const [showAll, setShowAll] = useState(false);

  if (!incidents?.length) return null;
  const shown = isMobile && !showAll ? incidents.slice(0, MOBILE_INCIDENTS) : incidents;

  return (
    <Card data-testid="dispatch-incidents">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertTriangle className="h-4 w-4 text-warning" aria-hidden />
          Imprévus à traiter
          <Badge variant="warning">{incidents.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {shown.map((incident) => (
          <div key={incident.deliveryId} className="space-y-3 rounded-xl border p-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  {incident.title} · {incident.reference}
                </p>
                <p className="text-sm text-muted-foreground">{incident.detail}</p>
                {incident.deadline && (
                  <p className="text-xs text-muted-foreground">Échéance : {dateTimeLabel(incident.deadline)}</p>
                )}
              </div>
              {incident.canPropose ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="min-h-11"
                  aria-expanded={openId === incident.deliveryId}
                  onClick={() => setOpenId(openId === incident.deliveryId ? null : incident.deliveryId)}
                >
                  {openId === incident.deliveryId ? "Masquer" : "Proposer un livreur"}
                </Button>
              ) : (
                <Button variant="outline" size="sm" className="min-h-11" asChild>
                  <Link href={buildDispatchTargetHref(incident.deliveryId, incident.kind === "LATE")}>Voir la mission</Link>
                </Button>
              )}
            </div>
            {openId === incident.deliveryId && (
              <DispatchSuggestionsPanel
                deliveryId={incident.deliveryId}
                pending
                replacesDriverId={incident.replacesDriverId ?? undefined}
              />
            )}
          </div>
        ))}
        {shown.length < incidents.length && (
          <Button type="button" variant="outline" className="w-full" onClick={() => setShowAll(true)}>
            Voir les {incidents.length - shown.length} autres
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
