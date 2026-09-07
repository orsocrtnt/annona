import { LANDING_ASSETS, LANDING_TOKENS } from "@/features/design-lab/landing-tokens";

/** Actes scrolly de la landing publique — fichier léger (pas tout landing-concepts). */
export const WOW_ACTS = [
  {
    id: "hero",
    label: "Ouverture",
    headline: "Connecte tout le monde",
    sub: "Une plateforme · Trois espaces",
    asset: LANDING_ASSETS.truck,
    assetPosition: "72% 78%",
    dark: true,
  },
  {
    id: "admin",
    label: "Admin",
    headline: "Pilotez tout",
    sub: "Board · commandes · flotte · facturation",
    asset: LANDING_ASSETS.warehouse,
    assetPosition: "50% 35%",
    dark: false,
  },
  {
    id: "client",
    label: "Client",
    headline: "Ils commandent seuls",
    sub: "Portail · suivi · factures",
    asset: LANDING_ASSETS.office,
    assetPosition: "45% 40%",
    dark: true,
  },
  {
    id: "driver",
    label: "Chauffeur",
    headline: "Sur le terrain",
    sub: "Missions · navigation",
    asset: LANDING_ASSETS.team,
    assetPosition: "65% 50%",
    dark: false,
  },
] as const;

export { LANDING_TOKENS };
