import type { Metadata } from "next";

// Limité à l'espace livreur : c'est ici que l'iPhone a besoin d'une app installée pour les notifications.
export const metadata: Metadata = {
  manifest: "/driver.webmanifest",
  appleWebApp: { capable: true, title: "Annona", statusBarStyle: "default" },
};

export default function DriverLayout({ children }: { children: React.ReactNode }) {
  return children;
}
