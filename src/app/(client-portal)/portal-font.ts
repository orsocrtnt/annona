import { Sora } from "next/font/google";

/**
 * Sora (DESIGN.md : display, headline, title) chargée uniquement avec le portail client ; les autres espaces
 * gardent Inter seule. Appliquée aux titres h1 à h3 du portail par le layout.
 */
export const sora = Sora({
  subsets: ["latin"],
  variable: "--font-sora",
  display: "swap",
});
