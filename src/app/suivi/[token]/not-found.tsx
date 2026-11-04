import type { Metadata } from "next";
import { NotFoundPanel } from "@/components/shared/not-found-panel";

export const metadata: Metadata = { title: "Lien de suivi invalide", robots: { index: false, follow: false }, referrer: "no-referrer" };

export default function TrackingNotFound() {
  return (
    <NotFoundPanel
      title="Ce lien de suivi n'est plus valide."
      message="Il a peut-être expiré ou été mal copié. Contactez la société qui assure votre livraison : elle peut vous envoyer un nouveau lien."
    />
  );
}
