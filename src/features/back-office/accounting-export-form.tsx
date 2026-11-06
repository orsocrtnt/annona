"use client";

import { useState } from "react";
import { usePermissions } from "@/hooks/use-permissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function AccountingExportForm() {
  const { can } = usePermissions();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (!can("invoices:read")) return null;

  return <Card>
    <CardHeader><CardTitle className="text-base">Export comptable des prestations</CardTitle></CardHeader>
    <CardContent className="space-y-3">
      <p className="text-sm text-muted-foreground">Documents de livraison enregistrés. CSV à transmettre à votre outil comptable ; ce fichier ne constitue pas une facture électronique réglementaire.</p>
      <form className="flex flex-wrap items-end gap-3" onSubmit={async (event) => {
        event.preventDefault();
        if (busy) return;
        const values = new FormData(event.currentTarget);
        const query = new URLSearchParams({ from: String(values.get("from")), to: String(values.get("to")), status: String(values.get("status")) });
        setBusy(true);
        setError("");
        try {
          const response = await fetch(`/api/invoices/export?${query}`);
          if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error ?? "Export impossible");
          }
          const url = URL.createObjectURL(await response.blob());
          const link = document.createElement("a");
          link.href = url;
          link.download = `annona-prestations-v1-${query.get("from")}-${query.get("to")}.csv`;
          link.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        } catch (caught) {
          setError(caught instanceof Error ? caught.message : "Export impossible");
        } finally { setBusy(false); }
      }}>
        <div className="space-y-1"><Label htmlFor="accounting-from">Créé du (UTC)</Label><Input id="accounting-from" name="from" type="date" required /></div>
        <div className="space-y-1"><Label htmlFor="accounting-to">Au inclus (UTC)</Label><Input id="accounting-to" name="to" type="date" required /></div>
        <div className="space-y-1 max-md:w-full max-md:min-w-0"><Label htmlFor="accounting-status">Statut du document</Label><select id="accounting-status" name="status" required defaultValue="" className="flex h-10 rounded-md border border-input bg-background px-3 text-sm max-md:text-base max-md:h-11 max-md:w-full max-md:min-w-0">
          <option value="" disabled>Choisir un statut</option>
          <option value="ALL">Tous, y compris brouillons et annulations</option>
          <option value="DRAFT">Brouillon</option><option value="PENDING">En attente</option><option value="PAID">Payé</option>
          <option value="OVERDUE">En retard</option><option value="CANCELLED">Annulé</option>
        </select></div>
        <Button type="submit" disabled={busy} loading={busy}>Télécharger le CSV</Button>
      </form>
      <p className="text-xs text-muted-foreground">Période fondée sur la création du document. Les lignes DOCUMENT portent les totaux ; les lignes LINE détaillent les montants. Les annulations demandent un contrôle comptable, aucun avoir automatique.</p>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </CardContent>
  </Card>;
}
