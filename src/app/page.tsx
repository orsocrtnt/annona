import type { Metadata } from "next";
import { HomeLanding } from "@/features/landing/home-landing";
import { APP_NAME } from "@/lib/constants";

export const metadata: Metadata = {
  title: `${APP_NAME} — Plateforme de pilotage des livraisons`,
  description:
    `${APP_NAME} relie entreprise, clients et livreurs pour piloter commandes, dispatch et livraisons.`,
};

/** Accueil statique (LANDING-3) : plus de prix sur la page, ils sont sur /tarifs, lus dans le catalogue. */
export default function HomePage() {
  return <HomeLanding />;
}
