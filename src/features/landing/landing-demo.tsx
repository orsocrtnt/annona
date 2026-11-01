"use client";

import { Suspense, lazy } from "react";
import Link from "next/link";
import { TOUR_ORDER } from "@/features/landing/product-tour/tour-data";

/**
 * Mini-démo DEMO-3, ouverte d'office sur la landing (LANDING-3) : plus de bouton pour la révéler.
 * Le morceau (motion compris) reste chargé à part, pour ne pas alourdir le premier affichage.
 */
const ProductTour = lazy(() =>
  import("@/features/landing/product-tour/product-tour")
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

export function LandingDemo() {
  return (
    <>
      <div className="mx-auto mb-[26px] max-w-[720px] text-center">
        <p className="hidden text-[14px] leading-[20px] font-bold text-[var(--l-brand)] min-[901px]:block">Essayez</p>
        <h2 id="demo-title" className="mt-2 text-[clamp(30px,4vw,48px)] font-bold leading-[1.02] tracking-[-0.04em]">
          Suivez la commande {TOUR_ORDER.number}, du client à la facture.
        </h2>
        <p className="mt-2.5 text-[17px] text-[var(--l-mute)]">
          <span className="hidden min-[901px]:inline">Chaque geste fait avancer la livraison d&apos;un espace à l&apos;autre. </span>Données fictives, rien n&apos;est enregistré.
        </p>
      </div>
      {/* En Sombre, `tour-adapt` (globals.css) passe la démo aux teintes de la maquette. */}
      <div className="tour-adapt mx-auto max-w-[960px]">
        <Suspense
          fallback={
            <div className="grid h-[460px] place-items-center rounded-[24px] border border-border bg-card text-sm text-muted-foreground lg:h-[600px]" role="status">
              Chargement de la mini-démo…
            </div>
          }
        >
          <ProductTour />
        </Suspense>
      </div>
    </>
  );
}
