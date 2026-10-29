"use client";

import { Suspense, lazy, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Camera, Play, X } from "lucide-react";
import { FULFILLMENT_STATUS_LABELS } from "@/lib/constants/order-status";
import {
  TOUR_INVOICE,
  TOUR_LANES,
  TOUR_ORDER,
  TOUR_PROOF,
  TOUR_QUEUE,
} from "@/features/landing/product-tour/tour-data";
import styles from "@/features/landing/home-landing.module.css";
import { ghostButton, primaryButton } from "@/features/landing/landing-styles";
import { cn } from "@/lib/utils";

/** La mini-démo DEMO-3 (motion compris) n'est chargée qu'à la demande : la landing reste légère. */
const loadTour = () => import("@/features/landing/product-tour/product-tour");
const ProductTour = lazy(() =>
  loadTour()
    .then((module) => ({ default: module.ProductTour }))
    // Morceau introuvable (réseau coupé, nouvelle version déployée) : message, jamais une page cassée.
    .catch(() => ({ default: TourUnavailable }))
);

function TourUnavailable() {
  return (
    <div className="grid h-[460px] place-items-center rounded-[22px] border border-border bg-card px-6 text-center text-sm text-muted-foreground" role="status">
      <p>
        La mini-démo n&apos;a pas pu se charger. Rechargez la page ou ouvrez la{" "}
        <Link href="/demonstration" className="font-semibold text-brand underline underline-offset-4">
          démonstration complète
        </Link>
        .
      </p>
    </div>
  );
}

const DRIVER = TOUR_LANES[0].driver;
const miniCard = "rounded-[18px] border border-border bg-card p-3.5 text-[13px] text-card-foreground";
const row = "flex items-center justify-between gap-2 border-t border-border py-1.5 first:border-t-0";
const muted = "text-xs text-muted-foreground";
const driverChip =
  "inline-flex min-h-[22px] items-center rounded-full bg-[#eaf1fb] px-2.5 text-[11.5px] font-semibold text-[#1f5fae] dark:bg-[#1d2a3a] dark:text-[#9cc0f0]";
const greenChip =
  "inline-flex min-h-[22px] items-center rounded-full bg-brand-subtle px-2.5 text-[11.5px] font-semibold text-brand";

const STATIONS = [
  {
    who: "Client",
    title: "Commande",
    body: (
      <div className={miniCard}>
        <b className="font-semibold">{TOUR_ORDER.client}</b>
        <div className={muted}>Commande {TOUR_ORDER.number}</div>
        <div className={cn(row, "mt-1")}>
          <span className={muted}>Retrait</span>
          <span>Ivry-sur-Seine</span>
        </div>
        <div className={row}>
          <span className={muted}>Livraison</span>
          <span>Paris 11e</span>
        </div>
      </div>
    ),
  },
  {
    who: "Entreprise",
    title: "Dispatch",
    body: (
      <div className={miniCard}>
        {TOUR_QUEUE.map((order) => (
          <div key={order.number} className={row}>
            <b className="font-semibold">{order.number}</b>
            <span className={driverChip}>{order.driver}</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    who: "Chauffeur",
    title: "Livraison",
    body: (
      <div className={miniCard}>
        <div className={cn(muted, "mb-1.5")}>Bonjour {DRIVER}</div>
        <div className="rounded-xl bg-[#0e1310] p-2.5 text-[#f5f8f6] dark:border dark:border-border dark:bg-secondary dark:text-foreground">
          <b className="font-semibold">Prochain arrêt · Ouvrir l&apos;itinéraire</b>
          <span className="block text-xs opacity-75">Créneau {TOUR_ORDER.slot}</span>
        </div>
      </div>
    ),
  },
  {
    who: "Chauffeur",
    title: "Preuve",
    body: (
      <div className={miniCard}>
        <b className="font-semibold">Remis à {TOUR_PROOF.recipient}</b>
        <div className={muted}>{TOUR_PROOF.time} · photo du colis</div>
        <div className="mt-2 grid h-[34px] place-items-center rounded-[10px] border border-dashed border-input text-muted-foreground">
          <Camera className="h-[22px] w-[22px]" strokeWidth={1.6} aria-hidden />
        </div>
      </div>
    ),
  },
  {
    who: "Client · Entreprise",
    title: "Facture",
    body: (
      <div className={miniCard}>
        <b className="font-semibold">{TOUR_INVOICE.number}</b>
        <div className={muted}>Livraison {TOUR_ORDER.number}</div>
        <div className={cn(row, "mt-1")}>
          <span className={muted}>Montant</span>
          <b className="font-semibold">{TOUR_INVOICE.amount}</b>
        </div>
        <div className={row}>
          <span className={muted}>Statut</span>
          <span className={greenChip}>{FULFILLMENT_STATUS_LABELS.INVOICED}</span>
        </div>
      </div>
    ),
  },
] as const;

const PANEL_ID = "mini-demo";

/**
 * Ligne de mission : cinq étapes, trois espaces. Le bouton ouvre la mini-démo existante (DEMO-3) sous la ligne,
 * sans la réécrire ; la refermer rend le focus au bouton.
 */
export function MissionLine() {
  const [open, setOpen] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const opened = useRef(false);

  useEffect(() => {
    if (!open) {
      if (opened.current) trigger.current?.focus({ preventScroll: true });
      return;
    }
    opened.current = true;
    const element = panel.current;
    if (!element) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    element.focus({ preventScroll: true });
    element.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
  }, [open]);

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="text-[13px] font-semibold text-brand">Mini-démo · données fictives</p>
          <h2 id="line-title" className="mt-3 text-balance text-[clamp(30px,4.4vw,52px)] font-bold leading-[1.04] tracking-[-0.035em]">
            Une livraison, cinq étapes, trois espaces.
          </h2>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            ref={trigger}
            type="button"
            className={primaryButton}
            aria-expanded={open}
            aria-controls={PANEL_ID}
            onPointerEnter={() => void loadTour()}
            onFocus={() => void loadTour()}
            onClick={() => setOpen((value) => !value)}
          >
            {open ? <X className="h-4 w-4" aria-hidden /> : <Play className="h-4 w-4" aria-hidden />}
            {open ? "Fermer la mini-démo" : "Lancer la mini-démo"}
          </button>
          <Link href="/demonstration" className={ghostButton}>
            Démo complète
          </Link>
        </div>
      </div>

      <ol className={styles.line} aria-labelledby="line-title">
        {STATIONS.map((station, index) => (
          <li key={station.title} className={styles.station}>
            <span className={styles.node} aria-hidden />
            <p className="mt-3.5 text-xs font-semibold uppercase tracking-[0.02em] text-muted-foreground max-[999px]:mt-0.5">
              <span className="sr-only">Étape {index + 1} : </span>
              {station.who}
            </p>
            <h3 className="mt-1 text-[19px] font-semibold tracking-[-0.02em]">{station.title}</h3>
            <div className={styles.mini}>{station.body}</div>
          </li>
        ))}
      </ol>

      <div
        id={PANEL_ID}
        ref={panel}
        tabIndex={-1}
        hidden={!open}
        aria-label="Mini-démo interactive"
        className="scroll-mt-28 focus:outline-none"
      >
        {open ? (
          <div className="grid items-center gap-10 pt-12 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-14">
            <div className="home-hero-text">
              <p className="home-hero-title text-[clamp(28px,3.6vw,44px)] font-bold leading-[1.04] tracking-[-0.035em]">
                Suivez la commande {TOUR_ORDER.number}, du client à la facture.
              </p>
              <p className="mt-4 max-w-md text-base text-text-secondary">
                Chaque geste fait avancer la livraison d&apos;un espace à l&apos;autre. Données fictives, rien n&apos;est
                enregistré.
              </p>
            </div>
            <Suspense
              fallback={
                <div className="grid h-[460px] place-items-center rounded-[22px] border border-border bg-card text-sm text-muted-foreground" role="status">
                  Chargement de la mini-démo…
                </div>
              }
            >
              <ProductTour />
            </Suspense>
          </div>
        ) : null}
      </div>
    </>
  );
}
