import { CampaignsBoard } from "@/features/admin/campaigns/campaigns-board";

/** ADMIN-ESPACE lot 5 : campagnes de mails de prospection et leur suivi (super-administrateur). */
export default function AdminCampaignsPage() {
  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand">Commercial</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Campagnes</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Mails de prospection envoyés depuis orso@annona.fr : envois, clics, candidatures et réponses, campagne par campagne.
        </p>
      </header>
      <CampaignsBoard />
    </div>
  );
}
