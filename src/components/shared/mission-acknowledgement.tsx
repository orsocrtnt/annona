import { CheckCircle2, Clock } from "lucide-react";
import { fullDateLabel } from "@/lib/format/relative-day";

interface MissionAcknowledgementProps {
  status: string;
  missionAcceptedAt?: string | Date | null;
  missionStartedAt?: string | Date | null;
  /** Tableaux : une mention courte, sans le cas historique « non enregistrée ». */
  compact?: boolean;
}

// Fuseau explicite : le serveur (UTC) et le navigateur rendent la même heure, pas d'écart d'hydratation.
const formatAcceptedAt = (value: string | Date) => new Date(value).toLocaleString("fr-FR", { timeZone: "Europe/Paris" });

export function MissionAcknowledgement({ status, missionAcceptedAt, missionStartedAt, compact = false }: MissionAcknowledgementProps) {
  if (status === "CANCELLED" || status === "PENDING") return null;
  if (compact) {
    if (missionAcceptedAt) {
      return (
        <p className="flex items-center gap-1 whitespace-nowrap text-xs text-[#0b7a3e]" data-testid="mission-acknowledgement" title={`Prise en charge confirmée le ${fullDateLabel(missionAcceptedAt)}`}>
          <CheckCircle2 className="h-3 w-3 shrink-0" aria-hidden="true" />
          <span><span className="sr-only">Prise en charge </span>Confirmée</span>
        </p>
      );
    }
    if (status === "ASSIGNED" && !missionStartedAt) {
      return (
        <p className="flex items-center gap-1 whitespace-nowrap text-xs text-[#8a5a00]" data-testid="mission-acknowledgement" title="Le livreur n'a pas encore confirmé la prise en charge">
          <Clock className="h-3 w-3 shrink-0" aria-hidden="true" />
          <span><span className="sr-only">Prise en charge </span>À confirmer</span>
        </p>
      );
    }
    return null;
  }
  return (
    <p className="text-xs text-muted-foreground" data-testid="mission-acknowledgement">
      {missionAcceptedAt ? (
        <>Prise en charge confirmée le <time dateTime={new Date(missionAcceptedAt).toISOString()}>{formatAcceptedAt(missionAcceptedAt)}</time></>
      ) : missionStartedAt ? "Prise en charge non enregistrée (ancienne mission)"
        : status === "ASSIGNED" ? "En attente de prise en charge" : "Prise en charge non enregistrée"}
    </p>
  );
}
