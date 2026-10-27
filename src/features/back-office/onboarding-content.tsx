"use client";

import Link from "next/link";
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

async function fetchOnboardingStatus(): Promise<CompanyOnboardingStatus> {
  const response = await fetch("/api/onboarding");
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error ?? "Impossible de charger l’onboarding");
  return payload.data as CompanyOnboardingStatus;
}

export function OnboardingContent() {
  const queryClient = useQueryClient();
  const readOnly = useAuthStore((state) => state.saas?.canMutate === false);
  const preference = useMutation({
    mutationFn: async (skipped: boolean) => {
      const response = await fetch("/api/onboarding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step: "collaborators", skipped }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Impossible d’enregistrer votre choix");
      return payload.data as CompanyOnboardingStatus;
    },
    onSuccess: (status) => queryClient.setQueryData(["company", "onboarding"], status),
  });
  const { data, isLoading, error } = useQuery({
    queryKey: ["company", "onboarding"],
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
                <Button variant="ghost" size="sm" disabled={readOnly || preference.isPending} onClick={() => preference.mutate(!step.skipped)}>
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
        <AlertTitle>Limites du pilote interne</AlertTitle>
        <AlertDescription className="space-y-1">
          <p>
            Invitez les nouveaux clients, livreurs et collaborateurs depuis la gestion des comptes.
            Pour un compte déjà présent, utilisez son accès existant ; une nouvelle invitation
            ne modifie ni son entreprise ni ses droits. La réception réelle des e-mails reste à valider avec le pilote.
          </p>
          <p>
            Aucun import initial n’est proposé aujourd’hui : commencez avec des comptes et commandes
            fictifs saisis manuellement. Un import sera ajouté seulement après définition du format
            réel, avec validation complète avant toute écriture.
          </p>
        </AlertDescription>
      </Alert>
    </div>
  );
}
