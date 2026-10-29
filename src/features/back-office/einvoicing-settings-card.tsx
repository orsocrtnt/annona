"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldErrorsError, useCompanyEinvoicing, useUpdateCompanyEinvoicing } from "@/features/back-office/einvoicing-hooks";
import { usePermissions } from "@/hooks/use-permissions";
import { buildEinvoicingBody, evaluateEinvoicingForm } from "@/features/back-office/einvoicing-form";
import { SUGGESTED_VAT_EXEMPTION_REASON } from "@/domains/invoice/facturx/facturx-readiness";
import { Landmark } from "lucide-react";
import { toast } from "sonner";

type Field = { key: string; group: "identity" | "einvoicing"; label: string; placeholder?: string; wide?: boolean };

const FIELDS: Field[] = [
  { key: "legalName", group: "identity", label: "Raison sociale", placeholder: "Coursiers Express SAS", wide: true },
  { key: "siren", group: "identity", label: "SIREN (obligatoire)", placeholder: "9 chiffres" },
  { key: "siret", group: "identity", label: "SIRET (siège)", placeholder: "14 chiffres" },
  { key: "billingAddress", group: "identity", label: "Adresse de facturation (obligatoire)", wide: true },
  { key: "billingPostalCode", group: "identity", label: "Code postal (obligatoire)" },
  { key: "billingCity", group: "identity", label: "Ville (obligatoire)" },
  { key: "country", group: "identity", label: "Pays (2 lettres)", placeholder: "FR" },
  { key: "vatNumber", group: "einvoicing", label: "N° de TVA intracommunautaire", placeholder: "FR12345678901" },
  { key: "taxRegistrationId", group: "einvoicing", label: "Identifiant fiscal (sans n° de TVA)", placeholder: "Franchise en base : à défaut, le SIREN" },
  { key: "legalForm", group: "einvoicing", label: "Forme juridique", placeholder: "SAS, SARL, EI…" },
  { key: "shareCapital", group: "einvoicing", label: "Capital social", placeholder: "10 000 €" },
  { key: "rcs", group: "einvoicing", label: "Immatriculation (RCS / RM)", placeholder: "RCS Paris 123 456 789", wide: true },
  { key: "iban", group: "einvoicing", label: "IBAN (facultatif ; à renseigner pour un paiement par virement)", wide: true },
  { key: "bic", group: "einvoicing", label: "BIC (recommandé avec l'IBAN)" },
  { key: "paymentTermsText", group: "einvoicing", label: "Conditions de paiement (facultatif)", placeholder: "Paiement à 30 jours date de facture.", wide: true },
  { key: "latePenaltyText", group: "einvoicing", label: "Pénalités de retard (obligatoire)", placeholder: "Pénalités de retard : trois fois le taux d'intérêt légal.", wide: true },
  { key: "earlyPaymentDiscountText", group: "einvoicing", label: "Escompte (obligatoire)", placeholder: "Pas d'escompte pour paiement anticipé.", wide: true },
  { key: "vatExemptionReason", group: "einvoicing", label: "Motif d'exonération de TVA (obligatoire si vous ne facturez pas de TVA)", placeholder: "TVA non applicable, art. 293 B du CGI", wide: true },
];

/** Mentions légales et Factur-X : visible et modifiable par l'administrateur de l'entreprise uniquement. */
export function EinvoicingSettingsCard() {
  const { isRole } = usePermissions();
  const isAdmin = isRole(["COMPANY_ADMIN"]);
  const { data, isError } = useCompanyEinvoicing(isAdmin);
  const update = useUpdateCompanyEinvoicing();
  const [values, setValues] = useState<Record<string, string>>({});
  const [enabled, setEnabled] = useState(false);
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState(false);
  const focusedFromHash = useRef(false);

  useEffect(() => {
    if (!data) return;
    const next: Record<string, string> = {};
    for (const field of FIELDS) {
      const source = (field.group === "identity" ? data.identity : data.einvoicing) as Record<string, string | null | undefined>;
      next[field.key] = source[field.key] ?? "";
    }
    setValues(next);
    setEnabled(data.einvoicing.enabled === true);
    // Arrivée par un lien direct (#einvoicing-champ) : place le curseur dans le champ à compléter.
    const target = window.location.hash.startsWith("#einvoicing-") ? window.location.hash.slice(1) : null;
    if (target && !focusedFromHash.current) {
      focusedFromHash.current = true;
      window.setTimeout(() => document.getElementById(target)?.focus({ preventScroll: false }), 0);
    }
  }, [data]);

  if (!isAdmin) return null;

  // Bloquant seulement si la facture électronique est activée (la case, même règle que le serveur).
  const enforced = enabled;
  const evaluation = evaluateEinvoicingForm(values, enabled, enforced, data?.vatRate);
  const errors = { ...evaluation.errors, ...serverErrors };
  const labelOf = (key: string) => FIELDS.find((f) => f.key === key)?.label.replace(/ \(.*\)$/, "") ?? key;
  const focusField = (key: string) => {
    const el = document.getElementById(`einvoicing-${key}`);
    el?.scrollIntoView({ block: "center", behavior: "smooth" });
    el?.focus({ preventScroll: true });
  };

  const handleSave = async () => {
    setTouched(true);
    setServerErrors({});
    if (Object.keys(evaluation.errors).length > 0) {
      focusField(Object.keys(evaluation.errors)[0]!);
      toast.error("Enregistrement impossible", { description: "Complétez les champs signalés en rouge." });
      return;
    }
    try {
      await update.mutateAsync(buildEinvoicingBody(values, enabled));
      toast.success("Mentions légales enregistrées");
    } catch (error) {
      if (error instanceof FieldErrorsError) {
        setServerErrors(error.fieldErrors);
        focusField(Object.keys(error.fieldErrors)[0] ?? "");
      }
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
        <div className="sm:col-span-2 space-y-2">
          <label className="flex items-start gap-2 text-sm max-md:min-h-11 max-md:items-center">
            <input
              type="checkbox"
              id="einvoicing-enabled"
              className="mt-1 h-4 w-4 max-md:size-5"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
            />
            <span>
              J&apos;active la facture électronique : les mentions exigées par le Factur-X deviennent obligatoires à
              l&apos;enregistrement.
            </span>
          </label>
          {evaluation.missing.length > 0 && (
            <div role="status" data-testid="einvoicing-missing" className="rounded-md border border-border bg-muted/40 p-3 text-sm">
              <p className="font-medium">
                {enforced ? "À compléter pour enregistrer et pour exporter vos Factur-X :" : "Il manquerait ces mentions pour exporter un Factur-X :"}
              </p>
              <ul className="mt-1 list-disc pl-5">
                {evaluation.missing.map((issue) => (
                  <li key={issue.field}>
                    <button type="button" className="underline underline-offset-2" onClick={() => focusField(issue.field)}>
                      {labelOf(issue.field)}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        {FIELDS.map((field) => {
          const error = (touched || enforced || serverErrors[field.key]) && errors[field.key] ? errors[field.key] : null;
          const formatOnly = !error && evaluation.errors[field.key] ? evaluation.errors[field.key] : null;
          const shown = error ?? formatOnly;
          const suggestExemption =
            field.key === "vatExemptionReason" && !(values.vatExemptionReason ?? "").trim() && !(values.vatNumber ?? "").trim();
          return (
            <div key={field.key} className={field.wide ? "space-y-1 sm:col-span-2" : "space-y-1"}>
              <Label htmlFor={`einvoicing-${field.key}`}>{field.label}</Label>
              <Input
                id={`einvoicing-${field.key}`}
                placeholder={field.placeholder}
                value={values[field.key] ?? ""}
                aria-invalid={shown ? true : undefined}
                aria-describedby={shown ? `einvoicing-${field.key}-error` : undefined}
                onChange={(e) => {
                  setValues((prev) => ({ ...prev, [field.key]: e.target.value }));
                  setServerErrors((prev) => (field.key in prev ? Object.fromEntries(Object.entries(prev).filter(([k]) => k !== field.key)) : prev));
                }}
              />
              {shown && (
                <p id={`einvoicing-${field.key}-error`} className="text-sm text-destructive">
                  {shown}
                </p>
              )}
              {!shown && evaluation.advisories.filter((a) => a.field === field.key).map((a) => (
                <p key={a.field} data-testid={`einvoicing-${field.key}-advisory`} className="text-sm text-muted-foreground">
                  {a.message}
                </p>
              ))}
              {suggestExemption && (
                <button
                  type="button"
                  className="text-sm underline underline-offset-2"
                  onClick={() => setValues((prev) => ({ ...prev, vatExemptionReason: SUGGESTED_VAT_EXEMPTION_REASON }))}
                >
                  Proposition : « {SUGGESTED_VAT_EXEMPTION_REASON} » (à valider, puis enregistrer)
                </button>
              )}
            </div>
          );
        })}
        {data?.invalidFields?.length ? (
          <p className="text-sm text-destructive sm:col-span-2" role="alert">
            Valeurs enregistrées illisibles, à ressaisir : {data.invalidFields.map((key) => FIELDS.find((f) => f.key === key)?.label ?? key).join(", ")}.
          </p>
        ) : null}
        {isError && (
          <p className="text-sm text-destructive sm:col-span-2" role="alert">
            Lecture des mentions impossible : rechargez la page avant d&apos;enregistrer.
          </p>
        )}
        <div className="sm:col-span-2">
          {/* Jamais d'enregistrement avant lecture : un formulaire vide effacerait les mentions existantes. */}
          <Button variant="brand" onClick={handleSave} disabled={!data || update.isPending} loading={update.isPending}>
            Enregistrer les mentions légales
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
