import type { Metadata } from "next";
import { NativeAppBridge } from "@/components/native/native-app-bridge";
import { DriverOfflineCacheRegistrar } from "@/features/driver/driver-offline-cache-registrar";

// Limité à l'espace livreur : c'est ici que l'iPhone a besoin d'une app installée pour les notifications.
export const metadata: Metadata = {
  manifest: "/driver.webmanifest",
  appleWebApp: { capable: true, title: "Annona", statusBarStyle: "default" },
};

export default function DriverLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <NativeAppBridge />
      <DriverOfflineCacheRegistrar />
    </>
  );
}
