import type { Metadata } from "next";
import { NotFoundPanel } from "@/components/shared/not-found-panel";

export const metadata: Metadata = { title: "Page introuvable", robots: { index: false, follow: false } };

export default function NotFound() {
  return (
    <NotFoundPanel
      title="Cette page n'existe pas ou a été déplacée."
      message="Vérifiez l'adresse, ou repartez de l'accueil. Si vous suiviez un lien reçu par e-mail, il a peut-être expiré."
      actions={[
        { href: "/", label: "Retour à l'accueil", primary: true },
        { href: "/login", label: "Se connecter" },
      ]}
    />
  );
}
