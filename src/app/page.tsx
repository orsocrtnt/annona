import type { Metadata } from "next";
import { HomeLanding } from "@/features/landing/home-landing";
import { toPublicPricing, type PublicPricing } from "@/domains/growth/public-pricing";
import { getActiveSignupCatalog } from "@/domains/signup/signup.service";
import { APP_NAME } from "@/lib/constants";

/** Le catalogue vient de la base : rechargé toutes les 5 minutes au lieu d'être figé au build. */
export const revalidate = 300;

export const metadata: Metadata = {
  title: `${APP_NAME} — Plateforme de pilotage des livraisons`,
  description:
    `${APP_NAME} relie entreprise, clients et chauffeurs pour piloter commandes, dispatch et livraisons.`,
};

/** Tarifs en un coup d'œil : même source que /tarifs (catalogue actif) ; indisponible = lien vers /tarifs. */
async function readPricing(): Promise<PublicPricing | null> {
  try {
    return toPublicPricing(await getActiveSignupCatalog());
  } catch {
    return null;
  }
}

export default async function HomePage() {
  return <HomeLanding pricing={await readPricing()} />;
}
