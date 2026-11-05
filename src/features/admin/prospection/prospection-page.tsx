"use client";

import { ProspectionSheetPanel } from "@/features/admin/prospection/prospection-sheet-panel";

/**
 * ADMIN-ESPACE lot 5 : page Prospection du groupe Commercial. Chiffres du fichier de prospection des commerciaux
 * (Google Sheet lue en lecture seule) : étapes, rappels, revue du vendredi.
 */
export function ProspectionPage() {
  return (
    <div className="space-y-8">
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand">Commercial</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Prospection</h1>
        <p className="mt-1 text-sm text-muted-foreground">Où en sont les entreprises du fichier des commerciaux.</p>
      </header>
      <ProspectionSheetPanel />
    </div>
  );
}
