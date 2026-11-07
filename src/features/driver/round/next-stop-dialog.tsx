"use client";

import { ArrowRight, Footprints, MapPinned, Navigation } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { EffectiveStop } from "@/features/driver/round/effective-rounds";
import { appleMapsUrl, wazeUrl } from "@/lib/maps/navigation-links";
import { fr } from "@/lib/i18n/fr";

const t = fr.driverRound;

export type NextStopStep = "next" | "navigate";

interface NextStopDialogProps {
  open: boolean;
  step: NextStopStep;
  /** Arrêt proposé (null : c'était le dernier). */
  stop: EffectiveStop | null;
  onStep: (step: NextStopStep) => void;
  onClose: () => void;
}

/**
 * LIV-04, critère 7 : après « Livré », l'arrêt suivant est proposé ; s'il valide (1er appui), le menu
 * propose « Ouvrir dans Plans », « Ouvrir dans Waze » ou « Y aller seul » (2e appui). Ouvert depuis
 * « Itinéraire », le menu s'affiche directement.
 */
export function NextStopDialog({ open, step, stop, onStep, onClose }: NextStopDialogProps) {
  const target = stop ? { latitude: stop.latitude, longitude: stop.longitude, address: stop.address } : null;
  return (
    <Dialog open={open} onOpenChange={(value) => (!value ? onClose() : undefined)}>
      <DialogContent className="max-w-sm" data-testid="driver-next-dialog">
        {step === "next" ? (
          <>
            <DialogHeader>
              <DialogTitle>{t.nextTitle}</DialogTitle>
              <DialogDescription>{stop ? t.nextQuestion : t.lastDone}</DialogDescription>
            </DialogHeader>
            {stop ? (
              <div className="rounded-xl bg-muted px-4 py-3" data-testid="driver-next-stop">
                <p className="font-semibold">
                  {t.stopNumber(stop.sequence)} · {stop.merchantName}
                </p>
                <p className="text-sm text-muted-foreground">{stop.address}</p>
                <p className="text-sm">{fr.packages(stop.packages, stop.items)}</p>
              </div>
            ) : null}
            <div className="grid gap-2">
              {stop ? (
                <Button size="xl" className="w-full" onClick={() => onStep("navigate")} data-testid="driver-go-next">
                  {t.goNext}
                  <ArrowRight className="!size-5" aria-hidden />
                </Button>
              ) : null}
              <Button variant="outline" size="touch" className="w-full" onClick={onClose}>
                {stop ? t.later : fr.common.close}
              </Button>
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{t.navTitle}</DialogTitle>
              {stop ? <DialogDescription>{stop.merchantName} · {stop.address}</DialogDescription> : null}
            </DialogHeader>
            {target ? (
              <div className="grid gap-2" data-testid="driver-nav-menu">
                <Button asChild size="xl" className="w-full">
                  <a href={appleMapsUrl(target)} target="_blank" rel="noopener noreferrer" onClick={onClose} data-testid="driver-open-plans">
                    <MapPinned className="!size-5" aria-hidden />
                    {t.openPlans}
                  </a>
                </Button>
                <Button asChild size="xl" variant="outline" className="w-full">
                  <a href={wazeUrl(target)} target="_blank" rel="noopener noreferrer" onClick={onClose} data-testid="driver-open-waze">
                    <Navigation className="!size-5" aria-hidden />
                    {t.openWaze}
                  </a>
                </Button>
                <Button size="touch" variant="ghost" className="w-full" onClick={onClose} data-testid="driver-go-alone">
                  <Footprints aria-hidden />
                  {t.goAlone}
                </Button>
              </div>
            ) : null}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
