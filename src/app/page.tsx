import type { Metadata } from "next";
import { HomeLanding } from "@/features/landing/home-landing";
import { APP_NAME } from "@/lib/constants";

export const metadata: Metadata = {
  title: `${APP_NAME} — Plateforme de pilotage des livraisons`,
  description:
    `${APP_NAME} relie entreprise, clients et chauffeurs pour piloter commandes, dispatch et livraisons.`,
};

export default function HomePage() {
  return <HomeLanding />;
}
