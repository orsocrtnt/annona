import type { Metadata } from "next";
import Link from "next/link";
import { APP_NAME } from "@/lib/constants";
import { LegalDocument, LegalSection } from "@/features/legal/legal-document";

export const metadata: Metadata = {
  title: `Confidentialité — ${APP_NAME}`,
  description: "Données collectées par le site Annona et vos droits (version provisoire, en cours de validation).",
};

export default function ConfidentialitePage() {
  return (
    <LegalDocument
      title="Politique de confidentialité"
      intro={`Ce que ${APP_NAME} collecte sur ce site, pourquoi, et comment exercer vos droits.`}
    >
      <LegalSection title="Responsable du traitement">
        <p>
          L&apos;éditeur du site, présenté dans les{" "}
          <Link href="/mentions-legales" className="font-semibold text-brand underline underline-offset-4">
            mentions légales
          </Link>
          .
        </p>
      </LegalSection>

      <LegalSection title="Données traitées dans l'application">
        <p>
          Les commandes, livraisons, preuves et positions des livreurs sont traitées pour le compte des
          entreprises clientes. Leur cadre est fixé par le contrat et l&apos;accord de traitement des données,
          en cours de préparation.
        </p>
      </LegalSection>

      <LegalSection title="Hébergement et destinataires">
        <p>
          Les données sont hébergées par Vercel Inc., aux États-Unis (site), et Supabase Pte Ltd, à Singapour (base
          de données, région de Paris). Les e-mails sont envoyés par Resend. Les cartes et les itinéraires de
          l&apos;application s&apos;appuient sur OpenStreetMap, OpenFreeMap et les services d&apos;adresses et
          d&apos;itinéraires de l&apos;IGN ; les itinéraires sont demandés par nos serveurs, sans votre adresse IP. Ces
          prestataires ne sont pas tous établis dans l&apos;Union européenne. Les données ne sont ni vendues ni
          utilisées à des fins publicitaires.
        </p>
      </LegalSection>

      <LegalSection title="Durée de conservation">
        <p>
          <em>En cours de définition.</em> Ces durées seront publiées ici avant l&apos;ouverture commerciale.
        </p>
      </LegalSection>

      <LegalSection title="Cookies et stockage local">
        <p>
          Le site n&apos;utilise aucun traceur publicitaire. Il dépose seulement ce qui est nécessaire à son
          fonctionnement : la session de connexion,
          votre choix de thème clair ou sombre et vos préférences d&apos;affichage. L&apos;application livreur garde
          aussi sur l&apos;appareil les actions en attente d&apos;envoi quand le réseau manque ; elles sont
          effacées dès leur envoi, et au plus tard sept jours après leur création si elles n&apos;ont pas pu partir.
        </p>
      </LegalSection>

      <LegalSection title="Vos droits">
        <p>
          Vous pouvez demander l&apos;accès à vos données, leur rectification, leur effacement, leur portabilité,
          la limitation de leur traitement ou vous y opposer, en écrivant à l&apos;éditeur (adresse dans les{" "}
          <Link href="/mentions-legales" className="font-semibold text-brand underline underline-offset-4">
            mentions légales
          </Link>
          ). Vous pouvez aussi adresser une réclamation à la CNIL (cnil.fr).
        </p>
      </LegalSection>
    </LegalDocument>
  );
}
