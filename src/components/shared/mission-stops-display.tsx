type MissionStop = {
  id?: string;
  sequence?: number;
  label?: string | null;
  address: string;
  city?: string | null;
  postalCode?: string | null;
  instructions?: string | null;
};

interface MissionStopsDisplayProps {
  stops: MissionStop[];
  compact?: boolean;
}

export function MissionStopsDisplay({ stops, compact }: MissionStopsDisplayProps) {
  if (!stops.length) return null;

  if (compact) {
    return (
      <p className="text-sm text-muted-foreground">
        {stops.length} adresse{stops.length > 1 ? "s" : ""} :{" "}
        {stops
          .map((stop) =>
            [stop.address, stop.postalCode, stop.city].filter(Boolean).join(", ")
          )
          .join(" → ")}
      </p>
    );
  }

  return (
    <ol className="space-y-3">
      {stops.map((stop, index) => (
        <li key={stop.id ?? index} className="rounded-lg border border-border p-3">
          <p className="text-sm font-medium">{stop.label || `Adresse ${index + 1}`}</p>
          <p className="mt-1 text-sm">
            {stop.address}
            {(stop.postalCode || stop.city) && (
              <span className="text-muted-foreground">
                {" "}
                — {[stop.postalCode, stop.city].filter(Boolean).join(" ")}
              </span>
            )}
          </p>
          {stop.instructions && (
            <p className="mt-1 text-xs text-muted-foreground">{stop.instructions}</p>
          )}
        </li>
      ))}
    </ol>
  );
}
