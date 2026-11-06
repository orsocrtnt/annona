"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Megaphone, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { addAdminCampaignOptOuts, adjustAdminCampaignReplies, createAdminCampaign } from "@/features/admin/api";
import { useAdminCampaigns } from "@/features/admin/hooks";
import { HomeCard } from "@/features/admin/home/home-card";
import { CampaignDetail } from "@/features/admin/campaigns/campaign-detail";
import { formatCampaignRate } from "@/features/admin/campaigns/campaign-labels";
import { isInitialQueryLoading } from "@/lib/query/is-initial-loading";
import { cn } from "@/lib/utils";
import type { ProspectCampaignSummary } from "@/domains/growth/prospect/prospect-campaign.service";

const numberFormat = new Intl.NumberFormat("fr-FR");
const DEFAULT_SOURCE = "Google Maps ou le site de votre entreprise";
const textareaClass =
  "min-h-28 w-full rounded-xl border font-normal border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function RepliesControl({ campaign }: { campaign: ProspectCampaignSummary }) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (delta: 1 | -1) => adjustAdminCampaignReplies(campaign.id, delta),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["admin", "campaigns"] }),
  });
  return (
    <div className="inline-flex items-center gap-1">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-9 w-9"
        aria-label={`Retirer une réponse à ${campaign.name}`}
        disabled={mutation.isPending || campaign.stats.replies === 0}
        onClick={(event) => { event.stopPropagation(); mutation.mutate(-1); }}
      >
        <Minus />
      </Button>
      <span className="min-w-6 text-center font-semibold tabular-nums">{numberFormat.format(campaign.stats.replies)}</span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-9 w-9"
        aria-label={`Ajouter une réponse à ${campaign.name}`}
        disabled={mutation.isPending}
        onClick={(event) => { event.stopPropagation(); mutation.mutate(1); }}
      >
        <Plus />
      </Button>
    </div>
  );
}

function CampaignTable({ campaigns, selected, onSelect }: {
  campaigns: ProspectCampaignSummary[];
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="-mx-1 overflow-x-auto">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead className="text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-2 py-2 font-semibold">Campagne</th>
            <th className="px-2 py-2 text-right font-semibold">Envoyés</th>
            <th className="px-2 py-2 text-right font-semibold">Clics « en être »</th>
            <th className="px-2 py-2 text-right font-semibold">Clics site</th>
            <th className="px-2 py-2 text-right font-semibold">Candidatures</th>
            <th className="px-2 py-2 text-center font-semibold">Réponses</th>
          </tr>
        </thead>
        <tbody>
          {campaigns.map((campaign) => {
            const { stats } = campaign;
            const active = selected === campaign.id;
            return (
              <tr
                key={campaign.id}
                className={cn("cursor-pointer border-t border-border transition-colors hover:bg-muted/50", active && "bg-muted/70")}
                onClick={() => onSelect(campaign.id)}
              >
                <td className="px-2 py-3">
                  <button
                    type="button"
                    className="text-left font-semibold text-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-pressed={active}
                    onClick={(event) => { event.stopPropagation(); onSelect(campaign.id); }}
                  >
                    {campaign.name}
                  </button>
                  <p className="text-xs text-muted-foreground">{campaign.city} · {campaign.code}</p>
                </td>
                <td className="px-2 py-3 text-right tabular-nums">
                  <span className="font-semibold">{numberFormat.format(stats.sent)}</span>
                  <span className="text-muted-foreground"> / {numberFormat.format(stats.recipients)}</span>
                </td>
                <td className="px-2 py-3 text-right tabular-nums">
                  <span className="font-semibold">{numberFormat.format(stats.joinClicks)}</span>
                  <p className="text-xs text-muted-foreground">{formatCampaignRate(stats.rates.joinPerSent)} des envois</p>
                </td>
                <td className="px-2 py-3 text-right font-semibold tabular-nums">{numberFormat.format(stats.siteClicks)}</td>
                <td className="px-2 py-3 text-right tabular-nums">
                  <span className="font-semibold">{numberFormat.format(stats.signups)}</span>
                  <p className="text-xs text-muted-foreground">{formatCampaignRate(stats.rates.signupPerSent)} des envois</p>
                </td>
                <td className="px-2 py-3 text-center"><RepliesControl campaign={campaign} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function CreateCampaignForm({ onCreated }: { onCreated: (id: string) => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("Il en est où ?");
  const [city, setCity] = useState("");
  const [source, setSource] = useState(DEFAULT_SOURCE);
  const mutation = useMutation({
    mutationFn: () => createAdminCampaign({ name, city, addressSource: source }),
    onSuccess: async (created) => {
      setCity("");
      await queryClient.invalidateQueries({ queryKey: ["admin", "campaigns"] });
      onCreated(created.id);
    },
  });
  return (
    <form
      className="grid gap-3 sm:grid-cols-2"
      onSubmit={(event) => { event.preventDefault(); mutation.mutate(); }}
    >
      <label className="grid gap-1 text-sm font-semibold text-foreground">
        Nom
        <Input className="font-normal" value={name} onChange={(event) => setName(event.target.value)} required minLength={2} maxLength={80} />
      </label>
      <label className="grid gap-1 text-sm font-semibold text-foreground">
        Ville
        <Input className="font-normal" value={city} onChange={(event) => setCity(event.target.value)} required minLength={2} maxLength={60} placeholder="Paris" />
      </label>
      <label className="grid gap-1 text-sm font-semibold text-foreground sm:col-span-2">
        Origine des adresses (écrite en bas du mail)
        <Input className="font-normal" value={source} onChange={(event) => setSource(event.target.value)} required minLength={2} maxLength={120} />
      </label>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <Button type="submit" variant="brand" disabled={mutation.isPending} aria-busy={mutation.isPending}>
          {mutation.isPending ? "Création…" : "Créer la campagne"}
        </Button>
        {mutation.isError && <p role="alert" className="text-sm text-destructive">{mutation.error.message}</p>}
      </div>
    </form>
  );
}

function OptOutForm({ total }: { total: number }) {
  const queryClient = useQueryClient();
  const [text, setText] = useState("");
  const mutation = useMutation({
    mutationFn: () => addAdminCampaignOptOuts(text),
    onSuccess: async () => {
      setText("");
      await queryClient.invalidateQueries({ queryKey: ["admin", "campaigns"] });
    },
  });
  return (
    <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); mutation.mutate(); }}>
      <p className="text-sm text-muted-foreground">
        Collez les adresses qui ont répondu STOP : elles ne recevront plus jamais de mail de prospection.
        {" "}{numberFormat.format(total)} adresse{total > 1 ? "s" : ""} bloquée{total > 1 ? "s" : ""} aujourd&apos;hui.
      </p>
      <textarea
        aria-label="Adresses STOP"
        className={textareaClass}
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder="contact@entreprise.fr"
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="outline" disabled={mutation.isPending || !text.trim()} aria-busy={mutation.isPending}>
          Bloquer ces adresses
        </Button>
        {mutation.isSuccess && (
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {mutation.data.added} ajoutée{mutation.data.added > 1 ? "s" : ""}, {mutation.data.cancelled} envoi{mutation.data.cancelled > 1 ? "s" : ""} annulé{mutation.data.cancelled > 1 ? "s" : ""}.
            {mutation.data.invalid.length > 0 && ` Ignorées : ${mutation.data.invalid.join(", ")}.`}
          </p>
        )}
        {mutation.isError && <p role="alert" className="text-sm text-destructive">{mutation.error.message}</p>}
      </div>
    </form>
  );
}

/** ADMIN-ESPACE lot 5 : campagnes de prospection, envoi depuis la boîte OVH et suivi par campagne. */
export function CampaignsBoard() {
  const { data, error, isLoading } = useAdminCampaigns();
  const [selected, setSelected] = useState<string | null>(null);
  const current = selected ?? data?.campaigns[0]?.id ?? null;

  if (isInitialQueryLoading(isLoading, data)) {
    return <HomeCard aria-busy="true"><p className="text-sm text-muted-foreground">Chargement des campagnes…</p></HomeCard>;
  }
  if (error || !data) {
    return (
      <HomeCard role="alert">
        <p className="flex items-center gap-2 text-sm font-semibold text-destructive">
          <AlertTriangle className="h-4 w-4" aria-hidden /> Campagnes indisponibles. {error?.message}
        </p>
      </HomeCard>
    );
  }

  return (
    <div className="space-y-6">
      {!data.mailerReady && (
        <HomeCard role="status" className="border-amber-300 bg-amber-50 dark:border-amber-500/40 dark:bg-amber-500/10">
          <p className="flex items-start gap-2 text-sm text-foreground">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
            <span>
              <strong>Envoi pas encore configuré.</strong> Le mot de passe de la boîte orso@tutelliv.fr doit être ajouté
              dans Vercel (variable <code>PROSPECT_SMTP_PASSWORD</code>). Vous pouvez déjà préparer les campagnes et les adresses.
            </span>
          </p>
        </HomeCard>
      )}

      <HomeCard aria-labelledby="campaigns-title">
        <h2 id="campaigns-title" className="text-lg font-bold text-foreground">Suivi des campagnes</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Clics comptés à l&apos;ouverture des liens du mail (robots évidents écartés), candidatures reçues par le formulaire,
          réponses saisies à la main. Pas de comptage des ouvertures.
        </p>
        <div className="mt-4">
          {data.campaigns.length === 0 ? (
            <EmptyState icon={Megaphone} title="Aucune campagne" description="Créez la première campagne ci-dessous." />
          ) : (
            <CampaignTable campaigns={data.campaigns} selected={current} onSelect={setSelected} />
          )}
        </div>
      </HomeCard>

      {current && <CampaignDetail key={current} id={current} mailerReady={data.mailerReady} paceMs={data.paceMs} onDeleted={() => setSelected(null)} />}

      <div className="grid gap-6 lg:grid-cols-2">
        <HomeCard aria-labelledby="campaign-create-title">
          <h2 id="campaign-create-title" className="mb-3 text-lg font-bold text-foreground">Nouvelle campagne</h2>
          <CreateCampaignForm onCreated={setSelected} />
        </HomeCard>
        <HomeCard aria-labelledby="campaign-stop-title">
          <h2 id="campaign-stop-title" className="mb-3 text-lg font-bold text-foreground">Adresses STOP</h2>
          <OptOutForm total={data.optOuts} />
        </HomeCard>
      </div>
    </div>
  );
}
