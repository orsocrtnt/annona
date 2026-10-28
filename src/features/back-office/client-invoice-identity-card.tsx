"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useClientInvoiceIdentity, useUpdateClientInvoiceIdentity } from "@/features/back-office/einvoicing-hooks";
import { usePermissions } from "@/hooks/use-permissions";
import { toast } from "sonner";

const FIELDS = [
  { key: "companyName", label: "Raison sociale (si entreprise)", wide: true },
  { key: "siren", label: "SIREN" },
  { key: "vatNumber", label: "N° de TVA intracommunautaire" },
  { key: "address", label: "Adresse de facturation", wide: true },
  { key: "postalCode", label: "Code postal" },
  { key: "city", label: "Ville" },
  { key: "countryCode", label: "Pays (2 lettres)" },
] as const;

/** Identité de facturation du client, reprise dans le Factur-X. Administrateur de l'entreprise uniquement. */
export function ClientInvoiceIdentityCard({ clientId }: { clientId: string }) {
  const { isRole } = usePermissions();
  const isAdmin = isRole(["COMPANY_ADMIN"]);
  const { data } = useClientInvoiceIdentity(clientId, isAdmin);
  const update = useUpdateClientInvoiceIdentity(clientId);
  const [values, setValues] = useState<Record<string, string>>({ countryCode: "FR" });

  useEffect(() => {
    if (!data) return;
    const stored = data as Record<string, string | undefined>;
    setValues(Object.fromEntries(FIELDS.map((field) => [field.key, stored[field.key] ?? (field.key === "countryCode" ? "FR" : "")])));
  }, [data]);

  if (!isAdmin) return null;

  const handleSave = async () => {
    try {
      await update.mutateAsync(values);
      toast.success("Identité de facturation enregistrée");
    } catch (error) {
      toast.error("Enregistrement impossible", { description: error instanceof Error ? error.message : undefined });
    }
  };

  return (
    <Card data-testid="client-invoice-identity">
      <CardHeader>
        <CardTitle className="text-base">Identité de facturation</CardTitle>
        <CardDescription>
          Reprise dans le Factur-X des factures de ce client. Sans elle, son nom et son adresse de livraison par défaut
          sont utilisés ; le SIREN est exigé par les plateformes agréées entre entreprises.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-3">
        {FIELDS.map((field) => (
          <div key={field.key} className={"wide" in field && field.wide ? "space-y-1 sm:col-span-3" : "space-y-1"}>
            <Label htmlFor={`client-identity-${field.key}`}>{field.label}</Label>
            <Input
              id={`client-identity-${field.key}`}
              value={values[field.key] ?? ""}
              onChange={(e) => setValues((prev) => ({ ...prev, [field.key]: e.target.value }))}
            />
          </div>
        ))}
        <div className="sm:col-span-3">
          <Button variant="brand" onClick={handleSave} disabled={update.isPending} loading={update.isPending}>
            Enregistrer l&apos;identité de facturation
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
