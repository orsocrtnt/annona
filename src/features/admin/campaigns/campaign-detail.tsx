"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Pause, Play, Send, Trash2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { addAdminCampaignAddresses, deleteAdminCampaign, releaseAdminCampaignSetAside, sendAdminCampaignNext, sendAdminCampaignTest } from "@/features/admin/api";
import { useAdminCampaign } from "@/features/admin/hooks";
import { HomeCard } from "@/features/admin/home/home-card";
import { RECIPIENT_STATUS_LABELS, formatCampaignRate } from "@/features/admin/campaigns/campaign-labels";
import { cn } from "@/lib/utils";
import { PROSPECT_SET_ASIDE_PREFIX, isSetAsideDetail } from "@/domains/growth/prospect/prospect-mail-provider";
import type { ProspectCampaignDetail, ProspectRecipientStatus } from "@/domains/growth/prospect/prospect-campaign.service";

const numberFormat = new Intl.NumberFormat("fr-FR");
const timeFormat = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Paris" });
const textareaClass =
  "min-h-32 w-full rounded-xl border font-normal border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const STATUS_TONE: Record<ProspectRecipientStatus, string> = {
  PENDING: "bg-muted text-muted-foreground",
  SENDING: "bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300",
  SENT: "bg-[#e9f9ef] text-[#08783f] dark:bg-brand-subtle dark:text-brand",
  FAILED: "bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300",
  SKIPPED: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
};

function Tile({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-background p-3">
      <p className="text-xs font-semibold text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">{numberFormat.format(value)}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function pendingHint(failed: number, setAside: number): string | undefined {
  const parts = [
    failed > 0 ? `${failed} échec${failed > 1 ? "s" : ""}` : null,
    setAside > 0 ? `${numberFormat.format(setAside)} mise${setAside > 1 ? "s" : ""} de côté` : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : undefined;
}

function Stats({ campaign }: { campaign: ProspectCampaignDetail }) {
  const { stats } = campaign;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Tile label="Envoyés" value={stats.sent} hint={`sur ${numberFormat.format(stats.recipients)} adresses`} />
      <Tile label="À envoyer" value={stats.pending} hint={pendingHint(stats.failed, stats.setAside)} />
      <Tile label="Clics « Je veux en être »" value={stats.joinClicks} hint={`${formatCampaignRate(stats.rates.joinPerSent)} des envois`} />
      <Tile label="Clics vers le site" value={stats.siteClicks} />
      <Tile label="Visites du formulaire" value={stats.pageVisits} />
      <Tile label="Candidatures" value={stats.signups} hint={`${formatCampaignRate(stats.rates.signupPerSent)} des envois`} />
      <Tile label="Réponses" value={stats.replies} hint="saisies à la main" />
      <Tile label="Annulés (STOP)" value={stats.skipped} />
    </div>
  );
}

function AddAddresses({ id }: { id: string }) {
  const queryClient = useQueryClient();
  const [text, setText] = useState("");
  const mutation = useMutation({
    mutationFn: () => addAdminCampaignAddresses(id, text),
    onSuccess: async () => {
      setText("");
      await queryClient.invalidateQueries({ queryKey: ["admin", "campaigns"] });
    },
  });
  return (
    <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); mutation.mutate(); }}>
      <label className="grid gap-1 text-sm font-semibold text-foreground">
        Adresses à ajouter (une par ligne, ou séparées par des virgules)
        <textarea
          className={textareaClass}
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={"contact@coursiers-exemple.fr\nexploitation@livraison-exemple.fr"}
        />
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="outline" disabled={mutation.isPending || !text.trim()} aria-busy={mutation.isPending}>
          Ajouter les adresses
        </Button>
        {mutation.isSuccess && (
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {mutation.data.added} ajoutée{mutation.data.added > 1 ? "s" : ""}
            {mutation.data.setAside > 0 &&
              ` (dont ${mutation.data.setAside} mise${mutation.data.setAside > 1 ? "s" : ""} de côté : Microsoft ou filtre d'entreprise strict)`}
            {mutation.data.alreadyInCampaign > 0 && `, ${mutation.data.alreadyInCampaign} déjà dans la campagne`}
            {mutation.data.optedOut > 0 && `, ${mutation.data.optedOut} écartée${mutation.data.optedOut > 1 ? "s" : ""} (STOP)`}
            {mutation.data.invalid.length > 0 && `. Non reconnues : ${mutation.data.invalid.join(", ")}`}.
          </p>
        )}
        {mutation.isError && <p role="alert" className="text-sm text-destructive">{mutation.error.message}</p>}
      </div>
    </form>
  );
}

/** Envoi pas à pas : un mail par appel, puis une pause (30 s) tant que l'envoi est lancé et la page ouverte. */
function useSendLoop(id: string, paceMs: number) {
  const queryClient = useQueryClient();
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [nextAt, setNextAt] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const runningRef = useRef(false);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  function stop(text: string | null) {
    runningRef.current = false;
    setRunning(false);
    setNextAt(null);
    if (timer.current) clearTimeout(timer.current);
    if (text) setMessage(text);
  }

  function schedule(delay: number) {
    if (!runningRef.current) return;
    setNextAt(Date.now() + delay);
    timer.current = setTimeout(tick, delay);
  }

  async function tick() {
    if (!runningRef.current) return;
    setNextAt(null);
    try {
      const result = await sendAdminCampaignNext(id);
      await queryClient.invalidateQueries({ queryKey: ["admin", "campaigns"] });
      if (result.status === "done") return stop("Envoi terminé : toutes les adresses ont été traitées.");
      if (result.status === "sent") setMessage(`Envoyé à ${result.email}. Reste ${result.remaining}.`);
      if (result.status === "skipped") setMessage(`${result.email} a demandé STOP : envoi annulé.`);
      if (result.status === "failed") setMessage(`Échec pour ${result.email} : ${result.detail}`);
      if (result.status === "wait" && result.remaining === 0) return stop("Envoi terminé.");
      const delay = "waitMs" in result ? Math.max(result.waitMs, 1_000) : paceMs;
      schedule(delay);
    } catch (error) {
      stop(error instanceof Error ? error.message : "Envoi interrompu.");
    }
  }

  function start() {
    runningRef.current = true;
    setRunning(true);
    setMessage("Envoi lancé. Gardez cette page ouverte.");
    void tick();
  }

  return { running, message, nextAt, start, pause: () => stop("Envoi en pause.") };
}

function Countdown({ at }: { at: number | null }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!at) return;
    const handle = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(handle);
  }, [at]);
  if (!at) return null;
  const seconds = Math.max(0, Math.ceil((at - now) / 1_000));
  return <span className="tabular-nums"> Prochain mail dans {seconds} s.</span>;
}

/** Suppression en deux temps (pas de fenêtre du navigateur) ; impossible pendant un envoi. */
function DeleteCampaign({ campaign, disabled, onDeleted }: { campaign: ProspectCampaignDetail; disabled: boolean; onDeleted: () => void }) {
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState(false);
  const mutation = useMutation({
    mutationFn: () => deleteAdminCampaign(campaign.id),
    onSuccess: async () => {
      onDeleted();
      await queryClient.invalidateQueries({ queryKey: ["admin", "campaigns"] });
    },
  });
  if (!confirming) {
    return (
      <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => setConfirming(true)}>
        <Trash2 /> Supprimer la campagne
      </Button>
    );
  }
  const count = campaign.stats.recipients;
  return (
    <div className="max-w-sm space-y-2 rounded-2xl border border-destructive/40 bg-destructive/5 p-3" role="group" aria-label="Confirmer la suppression">
      <p className="text-sm text-foreground">
        Supprimer « {campaign.name} · {campaign.city} » et {count > 0 ? `ses ${numberFormat.format(count)} adresse${count > 1 ? "s" : ""}` : "la campagne vide"} ?
        Ses chiffres disparaissent ; les adresses STOP restent bloquées.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="destructive" size="sm" disabled={mutation.isPending || disabled} aria-busy={mutation.isPending} onClick={() => mutation.mutate()}>
          Oui, supprimer
        </Button>
        <Button type="button" variant="outline" size="sm" disabled={mutation.isPending} onClick={() => setConfirming(false)}>
          Annuler
        </Button>
      </div>
      {mutation.isError && <p role="alert" className="text-sm text-destructive">{mutation.error.message}</p>}
    </div>
  );
}

export function CampaignDetail({
  id,
  mailerReady,
  paceMs,
  onDeleted,
}: {
  id: string;
  mailerReady: boolean;
  paceMs: number;
  onDeleted: () => void;
}) {
  const { data: campaign, error } = useAdminCampaign(id);
  const loop = useSendLoop(id, paceMs);
  const test = useMutation({ mutationFn: () => sendAdminCampaignTest(id) });
  const queryClient = useQueryClient();
  const release = useMutation({
    mutationFn: () => releaseAdminCampaignSetAside(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "campaigns"] }),
  });

  if (error) {
    return (
      <HomeCard role="alert">
        <p className="flex items-center gap-2 text-sm font-semibold text-destructive">
          <AlertTriangle className="h-4 w-4" aria-hidden /> {error.message}
        </p>
      </HomeCard>
    );
  }
  if (!campaign) return <HomeCard aria-busy="true"><p className="text-sm text-muted-foreground">Chargement…</p></HomeCard>;

  const pending = campaign.stats.pending;
  return (
    <HomeCard aria-labelledby="campaign-detail-title" className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="campaign-detail-title" className="text-lg font-bold text-foreground">{campaign.name} · {campaign.city}</h2>
          <p className="text-sm text-muted-foreground">
            Liens comptés : <code>/go/{campaign.code}/rejoindre</code> et <code>/go/{campaign.code}/site</code>
            {campaign.lastSentAt && ` · dernier envoi le ${timeFormat.format(new Date(campaign.lastSentAt))}`}
          </p>
        </div>
        <DeleteCampaign campaign={campaign} disabled={loop.running} onDeleted={onDeleted} />
      </div>

      <Stats campaign={campaign} />

      <div className="space-y-3 rounded-2xl border border-border bg-background p-4">
        <h3 className="font-semibold text-foreground">Envoyer</h3>
        <p className="text-sm text-muted-foreground">
          Un mail toutes les {Math.round(paceMs / 1_000)} secondes depuis orso@annona.fr, chaque adresse une seule fois.
          Gardez cette page ouverte pendant l&apos;envoi ; « Pause » arrête après le mail en cours.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="outline"
            disabled={!mailerReady || test.isPending}
            aria-busy={test.isPending}
            onClick={() => test.mutate()}
          >
            <Send /> M&apos;envoyer un essai
          </Button>
          {loop.running ? (
            <Button type="button" variant="secondary" onClick={loop.pause}>
              <Pause /> Pause
            </Button>
          ) : (
            <Button type="button" variant="brand" disabled={!mailerReady || pending === 0} onClick={loop.start}>
              <Play /> {campaign.stats.sent > 0 ? "Reprendre l'envoi" : "Lancer l'envoi"} ({numberFormat.format(pending)})
            </Button>
          )}
        </div>
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {test.isSuccess && `Essai envoyé à ${test.data.to}. `}
          {loop.message}
          {loop.running && <Countdown at={loop.nextAt} />}
        </p>
        {test.isError && <p role="alert" className="text-sm text-destructive">{test.error.message}</p>}
        {campaign.stats.setAside > 0 && (
          <div className="space-y-2 border-t border-border pt-3">
            <p className="text-sm text-muted-foreground">
              {numberFormat.format(campaign.stats.setAside)} adresse{campaign.stats.setAside > 1 ? "s" : ""} mise
              {campaign.stats.setAside > 1 ? "s" : ""} de côté (Microsoft ou filtre d&apos;entreprise strict) : le mail y
              tombe en indésirables tant que annona.fr n&apos;a pas d&apos;historique. Elles ne partent pas avec
              l&apos;envoi.
            </p>
            <Button
              type="button"
              variant="outline"
              disabled={release.isPending || loop.running}
              aria-busy={release.isPending}
              onClick={() => release.mutate()}
            >
              <Undo2 /> Remettre {campaign.stats.setAside > 1 ? `les ${numberFormat.format(campaign.stats.setAside)} adresses` : "l'adresse"} dans l&apos;envoi
            </Button>
            {release.isError && <p role="alert" className="text-sm text-destructive">{release.error.message}</p>}
          </div>
        )}
      </div>

      <div className="space-y-3">
        <h3 className="font-semibold text-foreground">Adresses</h3>
        <AddAddresses id={id} />
        {campaign.recipients.length > 0 && (
          <div className="max-h-96 overflow-y-auto rounded-2xl border border-border">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-card text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-semibold">Adresse</th>
                  <th className="px-3 py-2 font-semibold">État</th>
                  <th className="px-3 py-2 font-semibold">Envoyé le</th>
                </tr>
              </thead>
              <tbody>
                {campaign.recipients.map((recipient) => {
                  const setAside = recipient.status === "SKIPPED" && isSetAsideDetail(recipient.detail);
                  return (
                  <tr key={recipient.id} className="border-t border-border">
                    <td className="break-all px-3 py-2">{recipient.email}</td>
                    <td className="px-3 py-2">
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2 py-0.5 text-xs font-semibold",
                          setAside ? "bg-muted text-muted-foreground" : STATUS_TONE[recipient.status]
                        )}
                      >
                        {setAside ? PROSPECT_SET_ASIDE_PREFIX : RECIPIENT_STATUS_LABELS[recipient.status]}
                      </span>
                      {setAside && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {recipient.detail!.slice(PROSPECT_SET_ASIDE_PREFIX.length).replace(/^\s*:\s*/, "")}, envoi plus tard
                        </p>
                      )}
                      {recipient.detail && recipient.status !== "SKIPPED" && (
                        <p className="mt-1 text-xs text-muted-foreground">{recipient.detail}</p>
                      )}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {recipient.sentAt ? timeFormat.format(new Date(recipient.sentAt)) : "—"}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </HomeCard>
  );
}
