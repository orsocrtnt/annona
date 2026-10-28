"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCompanyEinvoicing, useUpdateCompanyEinvoicing } from "@/features/back-office/einvoicing-hooks";
import { usePermissions } from "@/hooks/use-permissions";
import { Landmark } from "lucide-react";
import { toast } from "sonner";

type Field = { key: string; group: "identity" | "einvoicing"; label: string; placeholder?: string; wide?: boolean };

const FIELDS: Field[] = [
  { key: "legalName", group: "identity", label: "Raison sociale", placeholder: "Coursiers Express SAS", wide: true },
  { key: "siren", group: "identity", label: "SIREN", placeholder: "9 chiffres" },
  { key: "siret", group: "identity", label: "SIRET (siège)", placeholder: "14 chiffres" },
  { key: "billingAddress", group: "identity", label: "Adresse de facturation", wide: true },
  { key: "billingPostalCode", group: "identity", label: "Code postal" },
  { key: "billingCity", group: "identity", label: "Ville" },
  { key: "country", group: "identity", label: "Pays (2 lettres)", placeholder: "FR" },
  { key: "vatNumber", group: "einvoicing", label: "N° de TVA intracommunautaire", placeholder: "FR12345678901" },
  { key: "taxRegistrationId", group: "einvoicing", label: "Identifiant fiscal (sans n° de TVA)", placeholder: "Franchise en base : à défaut, le SIREN" },
  { key: "legalForm", group: "einvoicing", label: "Forme juridique", placeholder: "SAS, SARL, EI…" },
  { key: "shareCapital", group: "einvoicing", label: "Capital social", placeholder: "10 000 €" },
  { key: "rcs", group: "einvoicing", label: "Immatriculation (RCS / RM)", placeholder: "RCS Paris 123 456 789", wide: true },
  { key: "iban", group: "einvoicing", label: "IBAN (facultatif)", wide: true },
  { key: "bic", group: "einvoicing", label: "BIC (facultatif)" },
  { key: "paymentTermsText", group: "einvoicing", label: "Conditions de paiement (facultatif)", placeholder: "Paiement à 30 jours date de facture.", wide: true },
  { key: "latePenaltyText", group: "einvoicing", label: "Pénalités de retard (obligatoire)", placeholder: "Pénalités de retard : trois fois le taux d'intérêt légal.", wide: true },
  { key: "earlyPaymentDiscountText", group: "einvoicing", label: "Escompte (obligatoire)", placeholder: "Pas d'escompte pour paiement anticipé.", wide: true },
  { key: "vatExemptionReason", group: "einvoicing", label: "Motif d'exonération de TVA (si vous ne facturez pas de TVA)", placeholder: "TVA non applicable, art. 293 B du CGI", wide: true },
];

/** Mentions légales et Factur-X : visible et modifiable par l'administrateur de l'entreprise uniquement. */
export function EinvoicingSettingsCard() {
  const { isRole } = usePermissions();
  const isAdmin = isRole(["COMPANY_ADMIN"]);
  const { data } = useCompanyEinvoicing(isAdmin);
  const update = useUpdateCompanyEinvoicing();
  const [values, setValues] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!data) return;
    const next: Record<string, string> = {};
    for (const field of FIELDS) {
      const source = (field.group === "identity" ? data.identity : data.einvoicing) as Record<string, string | null | undefined>;
      next[field.key] = source[field.key] ?? "";
    }
    setValues(next);
  }, [data]);

  if (!isAdmin) return null;

  const handleSave = async () => {
    const body = { identity: {} as Record<string, string>, einvoicing: {} as Record<string, string> };
    for (const field of FIELDS) body[field.group][field.key] = values[field.key] ?? "";
    if (!body.identity.country) body.identity.country = "FR";
    try {
      await update.mutateAsync(body);
      toast.success("Mentions légales enregistrées");
    } catch (error) {
      toast.error("Enregistrement impossible", { description: error instanceof Error ? error.message : undefined });
    }
  };

  return (
    <Card data-testid="einvoicing-settings">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Landmark className="h-4 w-4" />
          Mentions légales et Factur-X
        </CardTitle>
        <CardDescription>
          Données imprimées dans le fichier Factur-X de vos factures (préparation de la facturation électronique de
          septembre 2027). Le Factur-X n&apos;est pas un dépôt sur une plateforme agréée : il reste à transmettre par
          votre plateforme ou votre expert-comptable.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        {FIELDS.map((field) => (
          <div key={field.key} className={field.wide ? "space-y-1 sm:col-span-2" : "space-y-1"}>
            <Label htmlFor={`einvoicing-${field.key}`}>{field.label}</Label>
            <Input
              id={`einvoicing-${field.key}`}
              placeholder={field.placeholder}
              value={values[field.key] ?? ""}
              onChange={(e) => setValues((prev) => ({ ...prev, [field.key]: e.target.value }))}
            />
          </div>
        ))}
        <div className="sm:col-span-2">
          <Button variant="brand" onClick={handleSave} disabled={update.isPending} loading={update.isPending}>
            Enregistrer les mentions légales
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
