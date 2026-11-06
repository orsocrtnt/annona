"use client";

import { useEffect, useState } from "react";
import { landingMintButton } from "@/features/landing/landing-styles";
import { cn } from "@/lib/utils";

/**
 * « Une livraison, combien d'actions pour vous ? » (LANDING-3) : la même course à la main puis avec Annona.
 * On compte des actions d'une livraison type, jamais des minutes ni un gain chiffré.
 */

export const MANUAL_ACTIONS = [
  "Prendre la commande au téléphone",
  "La noter",
  "Appeler un livreur",
  "Lui envoyer l'adresse par SMS",
  "Client : « il arrive quand ? »",
  "Rappeler le livreur",
  "Rappeler le client",
  "Récupérer le bon papier",
  "Le saisir dans le tableur",
  "Faire la facture",
  "L'envoyer par e-mail",
  "Relancer le paiement",
] as const;

export type RaceActionKind = "you" | "auto" | "free";

export const ANNONA_ACTIONS: readonly { label: string; kind: RaceActionKind }[] = [
  { label: "Valider la tournée", kind: "you" },
  { label: "Suivi envoyé au client", kind: "auto" },
  { label: "Preuve photo reçue", kind: "auto" },
  { label: "Facture créée", kind: "auto" },
  { label: "Paiement suivi", kind: "auto" },
  { label: "Temps libéré → trouver de nouveaux clients", kind: "free" },
];

const MANUAL_STEP_MS = 520;
const ANNONA_STEP_MS = 500;
const RACE_END_MS = MANUAL_ACTIONS.length * MANUAL_STEP_MS + 100;

/** Moment d'apparition de chaque action, en millisecondes depuis le départ. */
export const manualAt = (index: number) => (index + 1) * MANUAL_STEP_MS;
export const annonaAt = (index: number) => 300 + index * ANNONA_STEP_MS;

/** Actions demandées à l'utilisateur, visibles à l'instant donné. */
export function countYourActions(elapsedMs: number) {
  return {
    manual: MANUAL_ACTIONS.filter((_, index) => manualAt(index) <= elapsedMs).length,
    annona: ANNONA_ACTIONS.filter((action, index) => action.kind === "you" && annonaAt(index) <= elapsedMs).length,
  };
}

const chip = "landing-fade-up inline-flex items-center rounded-[10px] border px-[11px] py-2 text-[13px] font-semibold";
const chipByKind: Record<RaceActionKind, string> = {
  you: "border-[var(--l-you-line)] bg-[var(--l-you-bg)] text-[var(--l-you-fg)]",
  auto: "border-[var(--l-auto-line)] bg-[var(--l-mint-s)] text-[var(--l-brand)]",
  free: "border-[var(--l-free-line)] bg-[var(--l-free-bg)] font-bold text-[var(--l-free-fg)]",
};
const laneHeader = "flex items-baseline justify-between gap-4 font-bold";
const laneLabel = "text-[14px] font-semibold text-[var(--l-mute)]";
const laneCount = "shrink-0 whitespace-nowrap text-[22px] font-extrabold tracking-[-0.02em]";
const road = "mt-2.5 flex min-h-11 flex-wrap gap-1.5 rounded-[14px] bg-[var(--l-soft)] p-2";

function plural(count: number) {
  return `${count} action${count > 1 ? "s" : ""}`;
}

/** Même déroulé que la maquette : rien avant le clic, « Lancer la course » relance depuis le début. */
export function ActionsRace() {
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (startedAt === null) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setElapsed(RACE_END_MS);
      return;
    }
    const timer = window.setInterval(() => {
      const next = Date.now() - startedAt;
      setElapsed(Math.min(next, RACE_END_MS));
      if (next >= RACE_END_MS) window.clearInterval(timer);
    }, 50);
    return () => window.clearInterval(timer);
  }, [startedAt]);

  const counts = countYourActions(elapsed);
  const start = () => {
    setElapsed(0);
    setStartedAt(Date.now());
  };

  return (
    <div className="overflow-hidden rounded-[24px] border border-[var(--l-line)] bg-[var(--l-card)] shadow-[var(--l-shadow)]">
      <div className="px-5 pb-7 pt-6 min-[901px]:px-12 min-[901px]:pb-12 min-[901px]:pt-10">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <h2
            id="race-title"
            className="text-[30px] font-extrabold leading-[1.02] tracking-[-0.04em] min-[901px]:text-[clamp(30px,4vw,48px)]"
          >
            Une livraison.
            <br />
            Combien d&apos;actions pour vous&nbsp;?
          </h2>
          <button type="button" className={landingMintButton} onClick={start}>
            Lancer la course
          </button>
        </div>

        <div className="mt-[22px]">
          <div className={laneHeader}>
            <span className={laneLabel}>À la main · téléphone, tableur, Word</span>
            <span className={laneCount} aria-live="polite">{plural(counts.manual)}</span>
          </div>
          <ul className={road} aria-label="Actions à la main">
            {MANUAL_ACTIONS.map((label, index) =>
              manualAt(index) <= elapsed ? (
                <li key={label} className={cn(chip, chipByKind.you)}>{label}</li>
              ) : null
            )}
          </ul>
        </div>
        <div className="mt-[22px]">
          <div className={laneHeader}>
            <span className={laneLabel}>Avec Annona</span>
            <span className={laneCount} aria-live="polite">{plural(counts.annona)}</span>
          </div>
          <ul className={road} aria-label="Actions avec Annona">
            {ANNONA_ACTIONS.map((action, index) =>
              annonaAt(index) <= elapsed ? (
                <li key={action.label} className={cn(chip, chipByKind[action.kind])}>{action.label}</li>
              ) : null
            )}
          </ul>
        </div>

        <p className="mt-3.5 text-[12px] text-[var(--l-mute)]">
          Exemple d&apos;une livraison type ; les actions « à la main » varient selon les entreprises.
        </p>
      </div>
    </div>
  );
}
