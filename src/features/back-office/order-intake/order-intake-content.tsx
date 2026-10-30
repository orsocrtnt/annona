"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, MessageSquareText } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import type { OrderIntakeDraft } from "@/domains/order-intake/order-intake.draft";
import { OrderIntakeApiError } from "./order-intake-api";
import { OrderIntakeDraftForm } from "./order-intake-draft-form";
import { useAnalyzeOrderMessage, useCloseInboundEmail, useOrderIntakeStatus, useToggleOrderIntake } from "./order-intake-hooks";
import { InboundEmailsCard, IntakeChannelsCard } from "./order-intake-channels";
import type { InboundEmailItem } from "./order-intake-api";

const MAX_TEXT = 8000;

/** Messages des codes renvoyés par les routes : chaque état a une issue lisible, jamais une erreur brute. */
const ERROR_TITLES: Record<string, string> = {
  INTAKE_DISABLED: "Fonction désactivée",
  INTAKE_NOT_CONFIGURED: "Fonction non configurée",
  QUOTA_REACHED: "Quota atteint",
  INVALID_MESSAGE: "Message à corriger",
  PROVIDER_ERROR: "Analyse indisponible",
  INVALID_MODEL_OUTPUT: "Brouillon non fiable",
  INTAKE_UNAVAILABLE: "Service indisponible",
  NETWORK: "Connexion impossible",
};

function newKey() {
  const random = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  return `intake-${random}`;
}

interface OrderIntakeContentProps {
  backHref: string;
  backLabel: string;
  /** Base des liens vers le détail d'une commande, ou null si l'espace n'y donne pas accès. */
  ordersHref: string | null;
}

function ActivationCard({ enabled, configured }: { enabled: boolean; configured: boolean }) {
  const toggle = useToggleOrderIntake();
  const [acknowledged, setAcknowledged] = React.useState(false);
  const noticeId = React.useId();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Activation pour votre entreprise</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <p id={noticeId} className="text-muted-foreground">
          Le texte collé, qui peut contenir des noms, téléphones et adresses de tiers, est transmis pour analyse au
          sous-traitant Anthropic (modèle d&apos;IA). TutelLiv ne conserve pas ce texte : seuls le nombre d&apos;analyses et
          de jetons sont journalisés pour le quota. La qualification juridique de ce sous-traitant (contrat, durée de
          conservation chez le fournisseur, transferts hors Union européenne) n&apos;est pas encore validée.
        </p>
        {!enabled && (
          <label className="flex min-h-11 items-center gap-2 max-md:items-center">
            <input type="checkbox" className="mt-0.5 h-4 w-4 max-md:size-5" checked={acknowledged}
              onChange={(event) => setAcknowledged(event.target.checked)} aria-describedby={noticeId} />
            J&apos;ai lu cette information et j&apos;active la fonction pour mon entreprise.
          </label>
        )}
        {!configured && (
          <p className="text-warning">La clé serveur n&apos;est pas encore installée : l&apos;analyse restera indisponible après activation.</p>
        )}
        <div aria-live="polite">
          {toggle.isError && <p role="alert" className="text-destructive">Réglage non enregistré. Réessayez.</p>}
        </div>
        <Button
          type="button"
          className="min-h-11"
          variant={enabled ? "outline" : "default"}
          disabled={toggle.isPending || (!enabled && !acknowledged)}
          onClick={() => toggle.mutate(!enabled)}
        >
          {toggle.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
          {enabled ? "Désactiver la fonction" : "Activer la fonction"}
        </Button>
      </CardContent>
    </Card>
  );
}

export function OrderIntakeContent({ backHref, backLabel, ordersHref }: OrderIntakeContentProps) {
  const status = useOrderIntakeStatus();
  const analyze = useAnalyzeOrderMessage();
  const [text, setText] = React.useState("");
  const [sender, setSender] = React.useState("");
  const [result, setResult] = React.useState<{ draft: OrderIntakeDraft; keys: string[]; id: number } | null>(null);
  const [activeEmailId, setActiveEmailId] = React.useState<string | null>(null);
  const closeEmail = useCloseInboundEmail();
  const draftHeadingRef = React.useRef<HTMLHeadingElement>(null);

  React.useEffect(() => {
    if (result) draftHeadingRef.current?.focus();
  }, [result]);

  if (status.isLoading) return <PageSkeleton />;

  const info = status.data;
  const available = Boolean(info?.enabled && info.configured);
  const maxLength = info?.limits.maxTextLength ?? MAX_TEXT;
  const error = analyze.error instanceof OrderIntakeApiError ? analyze.error : null;

  // Clés stables par e-mail : rouvrir le même e-mail ne peut pas créer une seconde commande.
  const openEmail = (email: InboundEmailItem) => {
    setActiveEmailId(email.id);
    setText([email.subject ? `Objet : ${email.subject}` : "", email.bodyText].filter(Boolean).join("\n\n").slice(0, maxLength));
    setSender(email.fromAddress);
    analyze.reset();
    setResult((previous) => email.draft
      ? {
          draft: email.draft,
          keys: Array.from({ length: Math.max(1, email.draft.deliveries.length) }, (_, index) => `inbound-${email.id}-${index}`),
          id: (previous?.id ?? 0) + 1,
        }
      : null);
  };

  const run = () => {
    if (!available || analyze.isPending || !text.trim()) return;
    analyze.mutate(
      { text, sender },
      {
        onSuccess: (draft) => setResult((previous) => ({
          draft,
          // Une clé d'idempotence par livraison, fixée pour toute la vie de ce brouillon.
          keys: Array.from({ length: Math.max(1, draft.deliveries.length) }, (_, index) =>
            activeEmailId ? `inbound-${activeEmailId}-${index}` : newKey()),
          id: (previous?.id ?? 0) + 1,
        })),
      }
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <Link href={backHref} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground max-md:min-h-11">
          <ArrowLeft className="h-4 w-4" aria-hidden /> {backLabel}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Nouvelle commande depuis un message</h1>
        <p className="mt-1 text-muted-foreground">
          Collez un e-mail, un SMS ou un message WhatsApp : TutelLiv prépare un brouillon que vous relisez avant de créer la commande.
        </p>
      </div>

      {status.isError && (
        <Alert variant="destructive">
          <AlertTitle>État de la fonction indisponible</AlertTitle>
          <AlertDescription>Rechargez la page dans un instant.</AlertDescription>
        </Alert>
      )}
      {info && !info.configured && (
        <Alert variant="warning">
          <AlertTitle>{ERROR_TITLES.INTAKE_NOT_CONFIGURED}</AlertTitle>
          <AlertDescription>
            La clé du service d&apos;analyse n&apos;est pas installée sur ce serveur. La saisie manuelle reste disponible.
          </AlertDescription>
        </Alert>
      )}
      {info && !info.enabled && (
        <Alert variant="info">
          <AlertTitle>{ERROR_TITLES.INTAKE_DISABLED}</AlertTitle>
          <AlertDescription>
            {info.canManage
              ? "Activez-la ci-dessous après avoir lu l'information sur le sous-traitant."
              : "Un administrateur de votre entreprise doit l'activer dans cet écran."}
          </AlertDescription>
        </Alert>
      )}
      {info?.canManage && <ActivationCard enabled={info.enabled} configured={info.configured} />}
      {info?.canManage && <IntakeChannelsCard />}
      <InboundEmailsCard activeId={activeEmailId} onOpen={openEmail} />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageSquareText className="h-4 w-4" aria-hidden /> Message reçu
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            aria-busy={analyze.isPending}
            onSubmit={(event) => { event.preventDefault(); run(); }}
          >
            <FormField
              label="Texte du message"
              required
              hint={`${text.length} / ${maxLength} caractères — Ctrl+Entrée ou ⌘+Entrée pour analyser.`}
            >
              <textarea
                value={text}
                maxLength={maxLength}
                rows={8}
                disabled={!available}
                onChange={(event) => setText(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                    event.preventDefault();
                    run();
                  }
                }}
                placeholder="urgent, 2 plis de Rivoli à La Défense avant 15h, demander M. Durand"
                className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm max-md:text-base placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </FormField>
            <FormField label="Expéditeur (facultatif)" hint="E-mail ou téléphone : sert à retrouver le client de votre entreprise.">
              <Input value={sender} maxLength={200} disabled={!available} autoComplete="off"
                onChange={(event) => setSender(event.target.value)} placeholder="contact@client.fr ou 06 12 34 56 78" />
            </FormField>
            <div aria-live="polite">
              {error && (
                <Alert variant={error.code === "QUOTA_REACHED" ? "warning" : "destructive"}>
                  <AlertTitle>{ERROR_TITLES[error.code] ?? "Analyse impossible"}</AlertTitle>
                  <AlertDescription>{error.message}</AlertDescription>
                </Alert>
              )}
              {analyze.isPending && <p className="text-sm text-muted-foreground">Analyse en cours…</p>}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" className="min-h-11" disabled={!available || analyze.isPending || !text.trim()}>
                {analyze.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
                Analyser
              </Button>
              {info && (
                <p className="text-xs text-muted-foreground">
                  Jusqu&apos;à {info.limits.hourly} analyses par heure et {info.limits.daily} par jour pour votre entreprise.
                </p>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {result && (
        <section aria-labelledby="intake-draft-title" className="space-y-2">
          <h2 id="intake-draft-title" ref={draftHeadingRef} tabIndex={-1} className="sr-only">
            Brouillon de commande
          </h2>
          <OrderIntakeDraftForm key={result.id} draft={result.draft} idempotencyKeys={result.keys} ordersHref={ordersHref}
            onAllCreated={activeEmailId ? (orderId) => {
              closeEmail.mutate({ id: activeEmailId, status: "CONVERTED", orderId });
              setActiveEmailId(null);
            } : undefined} />
        </section>
      )}
    </div>
  );
}
