"use client";

import Link from "next/link";
import { useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, CheckCircle2, Circle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageLoader } from "@/components/ui/loader";
import { CompanyOnboardingProfile } from "@/features/back-office/onboarding-company-profile";
import { CompanyLogoCard } from "@/features/back-office/company-logo-card";
import { useAuthStore } from "@/stores/auth.store";
import type { CompanyOnboardingStatus } from "@/domains/onboarding/onboarding.service";
import { ONBOARDING_QUERY_KEY, fetchOnboardingStatus } from "@/features/back-office/onboarding-query";

type OnboardingPreference = { step: "collaborators"; skipped: boolean } | { step: "navigation"; hidden: boolean };

export function OnboardingContent() {
  const queryClient = useQueryClient();
  const readOnly = useAuthStore((state) => state.saas?.canMutate === false);
  const preference = useMutation({
    mutationFn: async (body: OnboardingPreference) => {
      const response = await fetch("/api/onboarding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Impossible d’enregistrer votre choix");
      return payload.data as CompanyOnboardingStatus;
    },
    // Même clé que la navigation : l'entrée du menu apparaît ou disparaît aussitôt.
    onSuccess: (status) => queryClient.setQueryData(ONBOARDING_QUERY_KEY, status),
  });
  // Double clic : les deux clics partent avant que le bouton se désactive, le serveur répondrait 409 au second.
  const preferenceInFlight = useRef(false);
  const savePreference = (body: OnboardingPreference) => {
    if (preferenceInFlight.current) return;
    preferenceInFlight.current = true;
    preference.mutate(body, { onSettled: () => { preferenceInFlight.current = false; } });
  };
  const { data, isLoading, error } = useQuery({
    queryKey: ONBOARDING_QUERY_KEY,
    queryFn: fetchOnboardingStatus,
    refetchOnMount: "always",
  });

  if (isLoading) return <PageLoader />;
  if (error || !data) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Impossible de charger le démarrage guidé</AlertTitle>
        <AlertDescription>{error instanceof Error ? error.message : "Réessayez plus tard."}</AlertDescription>
      </Alert>
    );
  }

  const progress = Math.round(((data.completedSteps + data.skippedSteps) / data.totalSteps) * 100);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-muted-foreground">{data.companyName}</p>
        <h1 className="text-2xl font-semibold tracking-tight">Première livraison</h1>
        <p className="mt-1 max-w-3xl text-muted-foreground">
          Suivez ces étapes avec des données fictives. TutelLiv calcule l’avancement depuis les
          comptes actifs, réglages, commandes et livraisons réellement présents dans votre entreprise.
          Les données confirmées et les choix facultatifs sont conservés après déconnexion.
          Une invitation en attente ne valide pas un compte actif.
        </p>
      </div>

      {/* Place dans le menu principal : proposé au démarrage, puis rangé dans l'Aide une fois terminé ou masqué. */}
      <div
        className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between"
        data-testid="onboarding-navigation"
      >
        <p className="text-sm text-muted-foreground" role="status">
          {data.readyForInternalTest
            ? "Parcours terminé : il ne figure plus dans le menu principal. Retrouvez-le dans le menu du compte, rubrique Aide."
            : data.hiddenFromNavigation
              ? "Masqué du menu principal. Retrouvez-le dans le menu du compte, rubrique Aide ; votre avancement est conservé."
              : "Le guide reste accessible depuis l’Aide du menu du compte si vous le masquez ; votre avancement est conservé."}
        </p>
        {!data.readyForInternalTest && (
          <Button
            variant="outline"
            size="sm"
            className="shrink-0"
            disabled={readOnly || preference.isPending}
            onClick={() => savePreference({ step: "navigation", hidden: !data.hiddenFromNavigation })}
          >
            {data.hiddenFromNavigation ? "Afficher dans le menu" : "Masquer du menu"}
          </Button>
        )}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base">Avancement</CardTitle>
              <CardDescription>
                {data.completedSteps} étape{data.completedSteps > 1 ? "s" : ""} terminée{data.completedSteps > 1 ? "s" : ""} sur {data.totalSteps}
                {data.skippedSteps > 0 ? ` · ${data.skippedSteps} passée${data.skippedSteps > 1 ? "s" : ""}` : ""}
              </CardDescription>
            </div>
            <span className="text-2xl font-semibold tabular-nums">{progress}%</span>
          </div>
        </CardHeader>
        <CardContent>
          <div
            className="h-2 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-label="Avancement de la première livraison"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
          >
            <div className="h-full rounded-full bg-foreground transition-[width]" style={{ width: `${progress}%` }} />
          </div>
          {data.readyForInternalTest && (
            <p className="mt-3 text-sm font-medium">
              Le socle interne est prêt. Rejouez maintenant une livraison fictive complète avec
              les trois rôles.
            </p>
          )}
        </CardContent>
      </Card>

      {readOnly && <Alert><AlertDescription>Ce compte est en lecture seule. Votre avancement reste consultable.</AlertDescription></Alert>}
      <CompanyOnboardingProfile key={JSON.stringify(data.companyProfile)} profile={data.companyProfile} readOnly={readOnly} />
      <CompanyLogoCard readOnly={readOnly} title="Ajoutez votre logo" optional />
      {preference.error && <Alert variant="destructive" role="alert"><AlertDescription>{preference.error.message}</AlertDescription></Alert>}
      <div className="space-y-3" aria-label="Étapes de démarrage">
        {data.steps.map((step, index) => (
          <Card
            key={step.key}
            data-testid="onboarding-step"
            data-step={step.key}
            className={step.complete ? "border-border" : "border-foreground/30"}
          >
            <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
              <div className="flex min-w-0 flex-1 items-start gap-3">
                {step.complete ? (
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                ) : (
                  <Circle className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                )}
                <div className="min-w-0">
                  <p className="font-medium">
                    {index + 1}. {step.title}{step.optional && " (facultatif)"}
                    <span className="sr-only"> — {step.complete ? "terminée" : step.skipped ? "passée" : "à faire"}</span>
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">{step.description}</p>
                </div>
              </div>
              {step.optional && !step.complete && (
                <Button variant="ghost" size="sm" disabled={readOnly || preference.isPending} onClick={() => savePreference({ step: "collaborators", skipped: !step.skipped })}>
                  {step.skipped ? "Reprendre cette étape" : "Passer cette étape"}
                </Button>
              )}
              <Button variant={step.complete ? "outline" : "brand"} size="sm" asChild>
                <Link href={step.href}>
                  {step.complete ? "Revoir" : step.action}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Alert>
        <AlertTitle>Bon à savoir</AlertTitle>
        <AlertDescription className="space-y-1">
          <p>
            Invitez vos clients, livreurs et collaborateurs depuis la gestion des comptes. Une personne
            qui a déjà un compte garde son accès : une nouvelle invitation ne change ni son entreprise
            ni ses droits.
          </p>
          <p>
            L’import de fichier n’est pas encore proposé : créez vos premiers comptes et commandes à la
            main. Vous voulez reprendre un fichier existant ? Écrivez-nous, nous le préparons avec vous.
          </p>
        </AlertDescription>
      </Alert>
    </div>
  );
}
