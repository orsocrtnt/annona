"use client";

import * as React from "react";
import { Inbox, Link2, Paperclip } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { InboundEmailItem, IntakeChannelAction } from "./order-intake-api";
import { useCloseInboundEmail, useInboundEmails, useIntakeChannels, useUpdateIntakeChannel } from "./order-intake-hooks";

function ChannelRow({ testId, title, description, value, enabled, disabledReason, onAction, pending }: {
  testId: string;
  title: string;
  description: string;
  value: string | null;
  enabled: boolean;
  disabledReason?: string;
  onAction: (action: { enabled: boolean } | { rotate: true }) => void;
  pending: boolean;
}) {
  const [copied, setCopied] = React.useState(false);
  return (
    <div data-testid={testId} className="space-y-2 border-b border-border pb-4 last:border-0 last:pb-0">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-medium">{title}</h3>
        <Badge variant={enabled ? "default" : "secondary"}>{enabled ? "Activé" : "Désactivé"}</Badge>
      </div>
      <p className="text-muted-foreground">{description}</p>
      {disabledReason && <p className="text-warning">{disabledReason}</p>}
      {enabled && value && <p className="break-all rounded-lg bg-muted px-3 py-2 font-mono text-xs">{value}</p>}
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant={enabled ? "outline" : "default"} className="min-h-11" disabled={pending || Boolean(disabledReason && !enabled)}
          onClick={() => onAction({ enabled: !enabled })}>
          {enabled ? "Désactiver" : "Activer"}
        </Button>
        {enabled && value && (
          <>
            <Button type="button" variant="outline" className="min-h-11" onClick={async () => {
              await navigator.clipboard.writeText(value).then(() => setCopied(true), () => setCopied(false));
            }}>
              {copied ? "Copié" : "Copier"}
            </Button>
            <Button type="button" variant="ghost" className="min-h-11" disabled={pending} onClick={() => onAction({ rotate: true })}>
              Renouveler (l&apos;ancien cesse de marcher)
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

/** Réglages réservés à l'administration : lien de commande public et adresse de réception. */
export function IntakeChannelsCard() {
  const channels = useIntakeChannels(true);
  const update = useUpdateIntakeChannel();
  const act = (channel: IntakeChannelAction["channel"]) => (action: { enabled: boolean } | { rotate: true }) =>
    update.mutate({ channel, ...action } as IntakeChannelAction);
  const data = channels.data;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><Link2 className="h-4 w-4" aria-hidden /> Commandes sans connexion</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {channels.isError && <p role="alert" className="text-destructive">Réglages indisponibles. Rechargez la page.</p>}
        {data && (
          <>
            <ChannelRow
              testId="channel-orderLink"
              title="Lien de commande"
              description="À partager à vos clients : ils commandent sans compte et reçoivent un lien de suivi par e-mail. L'expéditeur n'est pas vérifié : ces commandes ne partent jamais seules à un livreur, un dispatcher les affecte."
              value={data.orderLink.url}
              enabled={data.orderLink.enabled}
              pending={update.isPending}
              onAction={act("orderLink")}
            />
            <ChannelRow
              testId="channel-inboundEmail"
              title="Adresse de réception des commandes"
              description="Transférez-y vos e-mails de commande. Chacun devient un brouillon ci-dessous, à relire et valider : aucune commande n'est créée seule."
              value={data.inboundEmail.address}
              enabled={data.inboundEmail.enabled}
              disabledReason={data.inboundEmail.configured ? undefined : "La réception n'est pas encore branchée sur ce serveur."}
              pending={update.isPending}
              onAction={act("inboundEmail")}
            />
          </>
        )}
        <div aria-live="polite">{update.isError && <p role="alert" className="text-destructive">Réglage non enregistré. Réessayez.</p>}</div>
      </CardContent>
    </Card>
  );
}

const STATE_LABEL: Record<InboundEmailItem["status"], string> = {
  RECEIVED: "Analyse en cours",
  ANALYZED: "Brouillon prêt",
  ANALYSIS_FAILED: "À lire",
  NOT_ORDER: "À trier",
};

/** Raison du rangement en « À trier » (gardée dans `analysisError`). */
export function notOrderReason(email: Pick<InboundEmailItem, "analysisError" | "draft">): string {
  if (email.analysisError === "attachments_only") return "Contenu en pièce jointe, non lu.";
  if (email.analysisError === "empty") return "E-mail vide.";
  return email.draft?.kindReason?.trim() || "Ne demande aucune course.";
}

const dateTime = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" });

function EmailMeta({ email }: { email: InboundEmailItem }) {
  return (
    <>
      <p className="mt-1 break-all text-xs text-muted-foreground">
        {email.originalSender
          ? <>{email.originalSender} (lu dans l&apos;e-mail transféré par {email.fromAddress})</>
          : email.fromAddress || "Expéditeur inconnu"} · {dateTime.format(new Date(email.createdAt))}
      </p>
      {email.attachmentCount > 0 && (
        <p className="mt-1 flex items-center gap-1 text-xs text-warning">
          <Paperclip className="h-3 w-3" aria-hidden /> {email.attachmentCount} pièce(s) jointe(s) non lue(s) : à consulter dans votre messagerie.
        </p>
      )}
    </>
  );
}

/**
 * E-mails reçus à traiter. Le contenu vient d'un inconnu : il reste du texte, jamais du HTML.
 * MAIL-PONT : les e-mails qui ne sont pas des commandes sont repliés dans « À trier », sans « Brouillon prêt ».
 */
export function InboundEmailsCard({ activeId, onOpen }: { activeId: string | null; onOpen: (email: InboundEmailItem) => void }) {
  const inbox = useInboundEmails();
  const close = useCloseInboundEmail();
  const emails = inbox.data ?? [];
  const toProcess = emails.filter((email) => email.status !== "NOT_ORDER");
  const toSort = emails.filter((email) => email.status === "NOT_ORDER");
  if (!inbox.isError && emails.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><Inbox className="h-4 w-4" aria-hidden /> E-mails de commande reçus</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {inbox.isError && <p role="alert" className="text-destructive">Liste indisponible. Rechargez la page.</p>}
        {!inbox.isError && toProcess.length === 0 && (
          <p className="text-muted-foreground">Aucune commande à traiter.</p>
        )}
        <ul className="space-y-3">
          {toProcess.map((email) => (
            <li key={email.id} className={`rounded-lg border p-3 ${email.id === activeId ? "border-primary" : "border-border"}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="min-w-0 break-words font-medium">{email.subject || "(sans objet)"}</p>
                <Badge variant={email.status === "ANALYZED" ? "default" : "secondary"}>{STATE_LABEL[email.status]}</Badge>
              </div>
              <EmailMeta email={email} />
              <div className="mt-2 flex flex-wrap gap-2">
                <Button type="button" variant="outline" className="min-h-11" onClick={() => onOpen(email)}>
                  {email.draft ? "Relire le brouillon" : "Ouvrir le message"}
                </Button>
                <Button type="button" variant="ghost" className="min-h-11" disabled={close.isPending}
                  onClick={() => close.mutate({ id: email.id, status: "DISMISSED" })}>
                  Classer sans commande
                </Button>
              </div>
            </li>
          ))}
        </ul>
        {toSort.length > 0 && (
          <details data-testid="inbound-to-sort" className="rounded-lg border border-border p-3">
            <summary className="flex min-h-11 cursor-pointer items-center font-medium">
              À trier ({toSort.length}) : e-mails qui ne semblent pas être des commandes
            </summary>
            <p className="mt-2 text-xs text-muted-foreground">Effacés automatiquement au bout de 7 jours.</p>
            <ul className="mt-2 space-y-3">
              {toSort.map((email) => (
                <li key={email.id} className={`rounded-lg border p-3 ${email.id === activeId ? "border-primary" : "border-border"}`}>
                  <p className="min-w-0 break-words font-medium">{email.subject || "(sans objet)"}</p>
                  <EmailMeta email={email} />
                  <p className="mt-1 text-xs">{notOrderReason(email)}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button type="button" variant="outline" className="min-h-11" onClick={() => onOpen(email)}>
                      C&apos;est une commande
                    </Button>
                    <Button type="button" variant="ghost" className="min-h-11" disabled={close.isPending}
                      onClick={() => close.mutate({ id: email.id, status: "DISMISSED" })}>
                      Ignorer
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </details>
        )}
      </CardContent>
    </Card>
  );
}
