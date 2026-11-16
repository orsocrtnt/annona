"use client";

import { ArrowRight, Footprints, Map as MapIcon, MapPinned, Navigation } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { EffectiveStop } from "@/features/driver/round/effective-rounds";
import { navigationAppsFor, navigationUrl, type NavigationApp } from "@/lib/maps/navigation-links";
import { openInNavigationApp } from "@/lib/native/navigation";
import { appPlatform } from "@/lib/native/platform";
import { fr } from "@/lib/i18n/fr";

const t = fr.driverRound;

const NAVIGATION_APPS: Record<NavigationApp, { label: string; Icon: typeof MapPinned; testId: string }> = {
  plans: { label: t.openPlans, Icon: MapPinned, testId: "driver-open-plans" },
  googleMaps: { label: t.openGoogleMaps, Icon: MapIcon, testId: "driver-open-google-maps" },
  waze: { label: t.openWaze, Icon: Navigation, testId: "driver-open-waze" },
};

/** Lu à l'ouverture du menu, toujours côté navigateur (le menu n'est jamais rendu par le serveur). */
function currentDevice() {
  return { platform: appPlatform(), userAgent: typeof navigator === "undefined" ? "" : navigator.userAgent };
}

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
 * propose toutes les applications de navigation (2e appui) : Google Maps et Waze partout, Plans en plus et en
 * premier sur iPhone, iPad et Mac (décision d'Orso du 15 novembre 2026), ou « Y aller seul ». Ouvert depuis
 * « Itinéraire », le menu s'affiche directement.
 */
export function NextStopDialog({ open, step, stop, onStep, onClose }: NextStopDialogProps) {
  const target = stop ? { latitude: stop.latitude, longitude: stop.longitude, address: stop.address } : null;
  // MOBILE-1 : dans l'application native, le lien est confié au système (Plans, Google Maps ou Waze s'ouvre) ;
  // dans un navigateur, le lien s'ouvre comme avant.
  function openNavigation(event: React.MouseEvent<HTMLAnchorElement>, url: string) {
    if (openInNavigationApp(url)) event.preventDefault();
    onClose();
  }
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
                {navigationAppsFor(currentDevice()).map((app, index) => {
                  const { label, Icon, testId } = NAVIGATION_APPS[app];
                  const url = navigationUrl(app, target);
                  return (
                    <Button key={app} asChild size="xl" variant={index === 0 ? "default" : "outline"} className="w-full">
                      <a href={url} target="_blank" rel="noopener noreferrer" onClick={(event) => openNavigation(event, url)} data-testid={testId}>
                        <Icon className="!size-5" aria-hidden />
                        {label}
                      </a>
                    </Button>
                  );
                })}
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
