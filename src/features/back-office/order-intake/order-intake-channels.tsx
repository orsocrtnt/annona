"use client";

import * as React from "react";
import { Inbox, Link2, Paperclip } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { InboundEmailItem, IntakeChannelAction, IntakeChannels } from "./order-intake-api";
import { useCloseInboundEmail, useInboundEmails, useIntakeChannels, useUpdateIntakeChannel } from "./order-intake-hooks";

function ChannelRow({ testId, title, description, value, enabled, disabledReason, onAction, pending, canRotate = true }: {
  testId: string;
  title: string;
  description: string;
  value: string | null;
  enabled: boolean;
  disabledReason?: string;
  onAction: (action: { enabled: boolean } | { rotate: true }) => void;
  pending: boolean;
  /** Faux pour un numéro partagé (WhatsApp) : rien à renouveler. */
  canRotate?: boolean;
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
            {canRotate && (
              <Button type="button" variant="ghost" className="min-h-11" disabled={pending} onClick={() => onAction({ rotate: true })}>
                Renouveler (l&apos;ancien cesse de marcher)
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/** WHATSAPP-1 : qui peut transférer. Sans numéro dans son profil, un message transféré est ignoré. */
function WhatsAppTeam({ team }: { team: NonNullable<IntakeChannels["whatsappTeam"]> }) {
  return (
    <div data-testid="whatsapp-team" className="space-y-2 rounded-lg border border-border p-3">
      <p className="font-medium">Numéros reconnus</p>
      <ul className="space-y-1">
        {team.map((member, index) => (
          <li key={`${member.name}-${index}`} className="flex flex-wrap justify-between gap-2">
            <span>{member.name}</span>
            {member.phone
              ? <span className="font-mono text-xs">{member.phone}</span>
              : <span className="text-xs text-warning">Aucun numéro : à ajouter dans son profil</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

const formatCode = (code: string) => code.replace(/(\d{3})(?=\d)/g, "$1 ");

/**
 * MAIL-PONT : boîte de commandes de l'entreprise, renvoyée automatiquement vers l'adresse TutelLiv.
 * Le renvoi garde le vrai client en expéditeur ; Gmail envoie d'abord un code, affiché ici.
 */
function OrderMailboxSetup({ data, pending, onSave }: {
  data: IntakeChannels;
  pending: boolean;
  onSave: (mailbox: string | null) => void;
}) {
  const [mailbox, setMailbox] = React.useState(data.inboundEmail.mailbox ?? "");
  React.useEffect(() => setMailbox(data.inboundEmail.mailbox ?? ""), [data.inboundEmail.mailbox]);
  const address = data.inboundEmail.address ?? "l'adresse TutelLiv ci-dessus";
  const confirmations = data.gmailConfirmations ?? [];
  return (
    <div data-testid="order-mailbox" className="space-y-3 rounded-lg border border-border p-3">
      <form className="space-y-2" onSubmit={(event) => { event.preventDefault(); onSave(mailbox.trim() || null); }}>
        <label htmlFor="order-mailbox-address" className="font-medium">Votre boîte de commandes</label>
        <p className="text-muted-foreground">Par exemple commandes@votre-entreprise.fr. Les confirmations envoyées à vos clients proposeront d&apos;y répondre.</p>
        <div className="flex flex-wrap gap-2">
          <input id="order-mailbox-address" type="email" value={mailbox} onChange={(event) => setMailbox(event.target.value)}
            placeholder="commandes@votre-entreprise.fr" autoComplete="off"
            className="min-h-11 min-w-0 flex-1 rounded-md border border-input bg-background px-3" />
          <Button type="submit" variant="outline" className="min-h-11" disabled={pending}>Enregistrer</Button>
        </div>
      </form>
      {confirmations.length > 0 && (
        <div role="status" className="rounded-lg bg-muted px-3 py-2">
          {confirmations.map((item) => item.link ? (
            <div key={item.receivedAt} className="space-y-2">
              <p>
                Gmail demande votre accord pour renvoyer les e-mails{item.requester ? <> de {item.requester}</> : null} vers TutelLiv
                (reçu le {dateTime.format(new Date(item.receivedAt))}).
              </p>
              <Button asChild className="min-h-11">
                <a href={item.link} target="_blank" rel="noopener noreferrer">Approuver le renvoi dans Gmail</a>
              </Button>
            </div>
          ) : (
            <p key={item.receivedAt}>
              Code de confirmation Gmail : <span className="font-mono text-base font-semibold">{formatCode(item.code ?? "")}</span>
              {item.requester ? <> (demandé par {item.requester})</> : null}, reçu le {dateTime.format(new Date(item.receivedAt))}.
            </p>
          ))}
          <p className="text-xs text-muted-foreground">Approuvez le lien, ou saisissez le code dans Gmail, pour terminer l&apos;activation du renvoi. Effacé au bout de 24 heures.</p>
        </div>
      )}
      <details>
        <summary className="flex min-h-11 cursor-pointer items-center font-medium">Activer le renvoi automatique (Gmail, Outlook, OVH)</summary>
        <div className="mt-2 space-y-3">
          <div>
            <h4 className="font-medium">Gmail ou Google Workspace</h4>
            <ol className="ml-5 list-decimal space-y-1 text-muted-foreground">
              <li>Dans la boîte de commandes : Paramètres, Voir tous les paramètres, Transfert et POP/IMAP.</li>
              <li>« Ajouter une adresse de transfert », puis coller {address}.</li>
              <li>Gmail envoie une demande d&apos;accord : elle s&apos;affiche ici en quelques secondes. Cliquer sur « Approuver le renvoi dans Gmail » (ou, sur les anciens comptes, saisir le code affiché dans Gmail).</li>
              <li>Choisir « Transférer une copie des messages entrants » et garder une copie dans Gmail.</li>
            </ol>
          </div>
          <div>
            <h4 className="font-medium">Outlook ou Microsoft 365</h4>
            <ol className="ml-5 list-decimal space-y-1 text-muted-foreground">
              <li>En entreprise, le renvoi vers une adresse extérieure est souvent bloqué : demandez à votre administrateur de l&apos;autoriser pour cette boîte.</li>
              <li>Paramètres, Courrier, Règles : nouvelle règle pour tous les messages.</li>
              <li>Action « Rediriger vers » {address}. Ne pas choisir « Transférer à », qui remplace l&apos;expéditeur par votre boîte.</li>
            </ol>
          </div>
          <div>
            <h4 className="font-medium">OVH et autres hébergeurs</h4>
            <p className="text-muted-foreground">Créer une redirection de la boîte de commandes vers {address}, en gardant une copie.</p>
          </div>
          <p className="text-xs text-muted-foreground">Ensuite, écrivez depuis une autre adresse à votre boîte de commandes : l&apos;e-mail doit apparaître ci-dessous avec le bon expéditeur.</p>
        </div>
      </details>
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
              description="Renvoyez-y automatiquement votre boîte de commandes (guide ci-dessous), ou transférez-y vos e-mails. Chaque commande devient un brouillon ci-dessous, à relire et valider : aucune commande n'est créée seule."
              value={data.inboundEmail.address}
              enabled={data.inboundEmail.enabled}
              disabledReason={data.inboundEmail.configured ? undefined : "La réception n'est pas encore branchée sur ce serveur."}
              pending={update.isPending}
              onAction={act("inboundEmail")}
            />
            {data.inboundEmail.enabled && (
              <OrderMailboxSetup data={data} pending={update.isPending}
                onSave={(mailbox) => update.mutate({ channel: "inboundEmail", mailbox })} />
            )}
            {data.whatsapp && (
              <ChannelRow
                testId="channel-whatsapp"
                title="WhatsApp"
                description="Enregistrez ce numéro dans vos contacts. Quand un client vous commande sur WhatsApp, appuyez longuement sur son message, « Transférer », puis choisissez ce numéro : la commande devient un brouillon ci-dessous. Seuls les numéros de l'équipe inscrits dans leur profil sont reconnus."
                value={data.whatsapp.number}
                enabled={data.whatsapp.enabled}
                disabledReason={data.whatsapp.configured ? undefined : "WhatsApp n'est pas encore branché sur ce serveur."}
                pending={update.isPending}
                canRotate={false}
                onAction={(action) => { if ("enabled" in action) update.mutate({ channel: "whatsapp", enabled: action.enabled }); }}
              />
            )}
            {data.whatsapp?.enabled && data.whatsappTeam && <WhatsAppTeam team={data.whatsappTeam} />}
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
export function notOrderReason(email: Pick<InboundEmailItem, "analysisError" | "draft" | "channel">): string {
  const whatsapp = email.channel === "WHATSAPP";
  if (email.analysisError === "attachments_only") return whatsapp ? "Photo, vocal ou document, non lu." : "Contenu en pièce jointe, non lu.";
  if (email.analysisError === "empty") return whatsapp ? "Message vide." : "E-mail vide.";
  return email.draft?.kindReason?.trim() || "Ne demande aucune course.";
}

const dateTime = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" });

function EmailMeta({ email }: { email: InboundEmailItem }) {
  const whatsapp = email.channel === "WHATSAPP";
  return (
    <>
      <p className="mt-1 break-all text-xs text-muted-foreground">
        {whatsapp
          ? <>Reçu par WhatsApp, transféré par {email.fromAddress}{email.originalSender ? <> · client lu dans le message : {email.originalSender}</> : null}</>
          : email.originalSender
          ? <>{email.originalSender} (lu dans l&apos;e-mail transféré par {email.fromAddress})</>
          : email.fromAddress || "Expéditeur inconnu"} · {dateTime.format(new Date(email.createdAt))}
      </p>
      {email.attachmentCount > 0 && (
        <p className="mt-1 flex items-center gap-1 text-xs text-warning">
          <Paperclip className="h-3 w-3" aria-hidden /> {whatsapp
            ? "Photo, vocal ou document non lu : à consulter dans WhatsApp."
            : `${email.attachmentCount} pièce(s) jointe(s) non lue(s) : à consulter dans votre messagerie.`}
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
        <CardTitle className="flex items-center gap-2 text-base"><Inbox className="h-4 w-4" aria-hidden /> Messages de commande reçus</CardTitle>
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
                <p className="min-w-0 break-words font-medium">{email.subject || (email.channel === "WHATSAPP" ? "Message WhatsApp" : "(sans objet)")}</p>
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
              À trier ({toSort.length}) : messages qui ne semblent pas être des commandes
            </summary>
            <p className="mt-2 text-xs text-muted-foreground">Effacés automatiquement au bout de 7 jours.</p>
            <ul className="mt-2 space-y-3">
              {toSort.map((email) => (
                <li key={email.id} className={`rounded-lg border p-3 ${email.id === activeId ? "border-primary" : "border-border"}`}>
                  <p className="min-w-0 break-words font-medium">{email.subject || (email.channel === "WHATSAPP" ? "Message WhatsApp" : "(sans objet)")}</p>
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
