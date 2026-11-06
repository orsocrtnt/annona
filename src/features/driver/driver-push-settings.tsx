"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  disableDriverPush,
  enableDriverPush,
  isDriverPushEnabled,
  readDriverPushAvailability,
  type DriverPushAvailability,
} from "./driver-push";

const HELP: Record<Exclude<DriverPushAvailability, "ready">, string> = {
  "install-required": "Sur iPhone, ajoutez d’abord Annona à l’écran d’accueil : bouton Partager de Safari, puis « Sur l’écran d’accueil ». Ouvrez ensuite Annona depuis cette icône.",
  denied: "Les notifications sont bloquées pour Annona. Autorisez-les dans les réglages de votre téléphone, puis revenez ici.",
  unavailable: "Les notifications ne sont pas disponibles sur cet appareil.",
};

export function DriverPushSettings() {
  const [availability, setAvailability] = useState<DriverPushAvailability | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setAvailability(readDriverPushAvailability());
    isDriverPushEnabled().then(setEnabled).catch(() => setEnabled(false));
  }, []);

  async function toggle() {
    setBusy(true);
    setError(null);
    try {
      if (enabled) {
        await disableDriverPush();
        setEnabled(false);
      } else {
        setEnabled(await enableDriverPush());
      }
    } catch {
      setError(enabled ? "Impossible de désactiver les notifications. Réessayez." : "Impossible d’activer les notifications. Réessayez.");
    } finally {
      setAvailability(readDriverPushAvailability());
      setBusy(false);
    }
  }

  if (!availability) return null;

  return (
    <section className="rounded-2xl border border-border bg-card p-4" data-testid="driver-push-settings">
      <h2 className="text-sm font-semibold">Notifications</h2>
      {availability === "ready" ? (
        <>
          <p className="pt-1 text-sm text-muted-foreground">
            {enabled ? "Vous êtes prévenu sur ce téléphone quand une mission vous est confiée." : "Soyez prévenu sur ce téléphone quand une mission vous est confiée."}
          </p>
          <Button type="button" variant="outline" className="mt-3 min-h-11 w-full" disabled={busy} onClick={toggle}>
            {enabled ? <BellOff className="mr-2 h-4 w-4" aria-hidden="true" /> : <Bell className="mr-2 h-4 w-4" aria-hidden="true" />}
            {enabled ? "Désactiver les notifications" : "Activer les notifications"}
          </Button>
          {error ? <p className="pt-2 text-sm text-destructive" role="alert">{error}</p> : null}
        </>
      ) : (
        <p className="pt-1 text-sm text-muted-foreground">{HELP[availability]}</p>
      )}
    </section>
  );
}
