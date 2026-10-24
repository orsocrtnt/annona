"use client";

import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import type { CompanyOnboardingStatus, OnboardingCompanyProfile } from "@/domains/onboarding/onboarding.service";

const fields = [
  { key: "name", label: "Nom de l’entreprise", autoComplete: "organization", maxLength: 160, minLength: 2 },
  { key: "email", label: "E-mail de l’entreprise", autoComplete: "email", maxLength: 254, type: "email" },
  { key: "address", label: "Adresse de l’entreprise", autoComplete: "street-address", maxLength: 240, minLength: 5 },
  { key: "city", label: "Ville de l’entreprise", autoComplete: "address-level2", maxLength: 120, minLength: 2 },
  { key: "country", label: "Pays (2 lettres)", autoComplete: "country", maxLength: 2, minLength: 2 },
  { key: "phone", label: "Téléphone de l’entreprise", autoComplete: "tel", maxLength: 30, type: "tel", optional: true },
] as const;

interface CompanyOnboardingProfileProps {
  profile: OnboardingCompanyProfile;
  readOnly: boolean;
}

export function CompanyOnboardingProfile({ profile, readOnly }: CompanyOnboardingProfileProps) {
  const [draft, setDraft] = useState(profile);
  const queryClient = useQueryClient();
  const save = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/onboarding", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step: "company", profile: draft }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Impossible d’enregistrer l’entreprise.");
      return payload.data as CompanyOnboardingStatus;
    },
    onSuccess: (status) => {
      queryClient.setQueryData(["company", "onboarding"], status);
      toast.success("Informations entreprise enregistrées");
    },
  });
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!save.isPending && !readOnly) save.mutate();
  };

  return (
    <Card id="company-profile" className="scroll-mt-6">
      <CardHeader>
        <CardTitle className="text-base">Informations entreprise</CardTitle>
        <CardDescription>Ces coordonnées restent disponibles après votre prochaine connexion. Les informations de facturation de l’inscription sont conservées.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4" aria-label="Informations entreprise">
          {save.error && <Alert variant="destructive" role="alert"><AlertDescription>{save.error.message}</AlertDescription></Alert>}
          <fieldset disabled={readOnly || save.isPending} className="grid min-w-0 gap-4 sm:grid-cols-2">
            <legend className="sr-only">Coordonnées de l’entreprise</legend>
            {fields.map((field) => (
              <FormField key={field.key} label={field.label} required={!("optional" in field)}>
                <Input
                  name={field.key}
                  type={"type" in field ? field.type : "text"}
                  autoComplete={field.autoComplete}
                  maxLength={field.maxLength}
                  minLength={"minLength" in field ? field.minLength : undefined}
                  required={!("optional" in field)}
                  value={draft[field.key]}
                  onChange={(event) => setDraft((current) => ({ ...current, [field.key]: event.target.value }))}
                />
              </FormField>
            ))}
          </fieldset>
          <Button type="submit" variant="brand" disabled={readOnly || save.isPending} loading={save.isPending}>Enregistrer les informations entreprise</Button>
        </form>
      </CardContent>
    </Card>
  );
}
