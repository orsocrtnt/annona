"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatDriverFromParts } from "@/lib/format/person-labels";
import type { AutoDispatchPreview } from "@/domains/delivery/auto-dispatch.service";

const SKIP_KEY = "tutelliv-auto-dispatch-skip-confirm";

export function readAutoDispatchSkip() {
  try {
    return window.localStorage.getItem(SKIP_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeAutoDispatchSkip(skip: boolean) {
  try {
    if (skip) window.localStorage.setItem(SKIP_KEY, "1");
    else window.localStorage.removeItem(SKIP_KEY);
  } catch {
    // Stockage indisponible : la validation reste demandée.
  }
}

interface AutoDispatchConfirmDialogProps {
  preview: AutoDispatchPreview | null;
  onClose: () => void;
  /** `undefined` : tournées, ou lancement direct ; sinon les seules affectations validées. */
  onValidate: (assignments: Array<{ deliveryId: string; driverId: string }> | undefined, neverAsk: boolean) => void;
}

export function AutoDispatchConfirmDialog({ preview, onClose, onValidate }: AutoDispatchConfirmDialogProps) {
  const [neverAsk, setNeverAsk] = useState(false);
  useEffect(() => {
    if (preview) setNeverAsk(false);
  }, [preview]);

  if (!preview) return null;

  const proposals = preview.mode === "PROPOSALS" ? preview.proposals : [];
  const unassigned = preview.mode === "PROPOSALS" ? preview.unassigned : [];
  const canValidate = preview.mode === "ROUNDS" ? preview.pending > 0 : proposals.length > 0;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-lg" data-testid="auto-dispatch-confirm">
        <DialogHeader>
          <DialogTitle>Valider l&apos;auto-dispatch</DialogTitle>
          <DialogDescription>
            {preview.mode === "SUGGESTION" && preview.message}
            {preview.mode === "ROUNDS" && `${preview.pending} livraison(s) en attente seront regroupées en tournées.`}
            {preview.mode === "PROPOSALS" && (canValidate
              ? "Rien n’est affecté tant que vous n’avez pas validé."
              : "Aucune livraison ne peut être proposée pour le moment.")}
          </DialogDescription>
        </DialogHeader>

        {proposals.length > 0 && (
          <ul className="space-y-2">
            {proposals.map((proposal) => (
              <li key={proposal.deliveryId} className="rounded-xl border p-3">
                <p className="text-sm font-medium">
                  {proposal.reference} → {formatDriverFromParts(null, proposal.driverName)}
                </p>
                <p className="text-xs text-muted-foreground">{proposal.reason}</p>
              </li>
            ))}
          </ul>
        )}

        {unassigned.length > 0 && (
          <div className="space-y-1">
            <p className="text-sm font-medium">Sans proposition</p>
            <ul className="space-y-1">
              {unassigned.map((row) => (
                <li key={row.deliveryId} className="text-xs text-muted-foreground">
                  {row.reference} : {row.reason}
                </li>
              ))}
            </ul>
          </div>
        )}

        <DialogFooter className="sm:flex-col sm:space-x-0">
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" className="min-h-11" onClick={onClose}>
              Annuler
            </Button>
            <Button
              type="button"
              variant="brand"
              className="min-h-11"
              disabled={!canValidate}
              onClick={() => onValidate(
                preview.mode === "PROPOSALS"
                  ? proposals.map(({ deliveryId, driverId }) => ({ deliveryId, driverId }))
                  : undefined,
                neverAsk
              )}
            >
              Valider
            </Button>
          </div>
          <label className="mt-3 flex min-h-11 cursor-pointer items-center gap-2 text-sm sm:justify-end">
            <input
              type="checkbox"
              className="h-4 w-4 accent-[var(--brand,currentColor)]"
              checked={neverAsk}
              onChange={(event) => setNeverAsk(event.target.checked)}
            />
            Ne plus me demander
          </label>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
