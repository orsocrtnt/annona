import { Sora } from "next/font/google";

/**
 * Sora (DESIGN.md : display, headline, title) chargée uniquement avec le portail client ; les autres espaces
 * gardent Inter seule. Variable posée par le layout du portail (div et <html>), règle dans globals.css.
 */
export const sora = Sora({
  subsets: ["latin"],
  variable: "--font-sora",
  display: "swap",
});
