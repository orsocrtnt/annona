/** ADMIN-ESPACE lot 5 : libellés partagés de la page Campagnes (sans dépendance serveur). */
import type { ProspectRecipientStatus } from "@/domains/growth/prospect/prospect-campaign.service";

const percentFormat = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });

export function formatCampaignRate(rate: number | null): string {
  return rate === null ? "—" : `${percentFormat.format(rate)} %`;
}

export const RECIPIENT_STATUS_LABELS: Record<ProspectRecipientStatus, string> = {
  PENDING: "À envoyer",
  SENDING: "En cours",
  SENT: "Envoyé",
  FAILED: "Échec",
  SKIPPED: "Annulé (STOP)",
};
