import type { Metadata } from "next";
import { APP_NAME } from "@/lib/constants";
import { LegalDocument, LegalFacts, LegalSection } from "@/features/legal/legal-document";

export const metadata: Metadata = {
  title: `Mentions légales — ${APP_NAME}`,
  description: "Éditeur et hébergeurs du site TutelLiv (version provisoire, en cours de validation).",
};

const pending = <em>en cours</em>;

export default function MentionsLegalesPage() {
  return (
    <LegalDocument
      active="mentions-legales"
      title="Mentions légales"
      intro={`Qui édite et qui héberge le site et l'application ${APP_NAME}.`}
    >
      <LegalSection title="Éditeur">
        <LegalFacts
          rows={[
            ["Éditeur", "Carotenuto - Marchetti Orso, entrepreneur individuel (EI)"],
            ["Adresse", "10 traverse de la Gaye, 13009 Marseille, France"],
            ["Immatriculation (SIREN)", pending],
            ["Directeur de la publication", "Carotenuto - Marchetti Orso"],
            ["Contact", "Formulaire de la page Contact"],
          ]}
        />
      </LegalSection>

      <LegalSection title="Hébergement">
        <LegalFacts
          rows={[
            ["Site et application", "Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, États-Unis"],
            [
              "Données de l'application",
              "Supabase Pte Ltd, 65 Chulia Street #38-02/03 OCBC Centre, Singapour 049513 — base de données hébergée dans la région de Paris",
            ],
          ]}
        />
      </LegalSection>

      <LegalSection title="Propriété intellectuelle">
        <p>
          Les textes, l&apos;interface et le logo {APP_NAME} sont protégés. Toute reproduction sans autorisation
          préalable de l&apos;éditeur est interdite.
        </p>
      </LegalSection>
    </LegalDocument>
  );
}
