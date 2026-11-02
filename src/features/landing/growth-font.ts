import { Plus_Jakarta_Sans } from "next/font/google";

/** Police du site public, partagée par la barre et les pages : la barre reste identique partout, accueil compris. */
export const growthFont = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-growth",
  display: "swap",
});
