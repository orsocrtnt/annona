"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { formatDistance } from "@/lib/maps/navigation-utils";
import type { ProximityTargetKind } from "@/lib/maps/driver-proximity";
import { MapPin } from "lucide-react";

interface LocationConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: ProximityTargetKind;
  distanceMeters: number | null;
  loading?: boolean;
  onConfirm: () => void;
}

function pointLabel(kind: ProximityTargetKind) {
  return kind === "pickup" ? "point de collecte" : "point de livraison";
}

export function LocationConfirmationDialog({
  open,
  onOpenChange,
  kind,
  distanceMeters,
  loading,
  onConfirm,
}: LocationConfirmationDialogProps) {
  const label = pointLabel(kind);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-warning" />
            Localisation éloignée
          </DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-2 pt-1 text-left text-sm text-muted-foreground">
              <p>
                {distanceMeters != null
                  ? `Vous n'êtes pas proche du ${label}. Êtes-vous sûr de vouloir continuer ?`
                  : `Votre position n'a pas pu être vérifiée ou vous semblez éloigné du ${label}. Êtes-vous sûr de vouloir continuer ?`}
              </p>
              {distanceMeters != null && (
                <p className="rounded-lg bg-muted/50 px-3 py-2 text-foreground">
                  Distance estimée :{" "}
                  <span className="font-medium">{formatDistance(distanceMeters)}</span>
                </p>
              )}
            </div>
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Annuler
          </Button>
          <Button variant="brand" onClick={onConfirm} loading={loading}>
            Confirmer quand même
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
