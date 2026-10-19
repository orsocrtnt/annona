interface MissionAcknowledgementProps {
  status: string;
  missionAcceptedAt?: string | Date | null;
  missionStartedAt?: string | Date | null;
}

export function MissionAcknowledgement({ status, missionAcceptedAt, missionStartedAt }: MissionAcknowledgementProps) {
  if (status === "CANCELLED" || status === "PENDING") return null;
  return (
    <p className="text-xs text-muted-foreground" data-testid="mission-acknowledgement">
      {missionAcceptedAt ? (
        <>Prise en charge confirmée le <time dateTime={new Date(missionAcceptedAt).toISOString()}>{new Date(missionAcceptedAt).toLocaleString("fr-FR")}</time></>
      ) : missionStartedAt ? "Prise en charge non enregistrée (ancienne mission)"
        : status === "ASSIGNED" ? "En attente de prise en charge" : "Prise en charge non enregistrée"}
    </p>
  );
}
