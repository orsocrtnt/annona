import type { Metadata } from "next";
import { NotFoundPanel } from "@/components/shared/not-found-panel";

export const metadata: Metadata = { title: "Lien de commande invalide", robots: { index: false, follow: false }, referrer: "no-referrer" };

export default function PublicOrderNotFound() {
  return (
    <NotFoundPanel
      title="Ce lien de commande n'est plus valide."
      message="Il a peut-être été remplacé ou désactivé. Demandez le nouveau lien à la société de livraison qui vous l'avait transmis."
    />
  );
}
