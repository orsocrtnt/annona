import type { Metadata } from "next";
import Link from "next/link";
import { APP_NAME } from "@/lib/constants";
import { LegalDocument, LegalSection } from "@/features/legal/legal-document";

export const metadata: Metadata = {
  title: `Confidentialité — ${APP_NAME}`,
  description: "Données collectées par le site TutelLiv et vos droits (version provisoire, en cours de validation).",
};

export default function ConfidentialitePage() {
  return (
    <LegalDocument
      active="confidentialite"
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

      <LegalSection title="Formulaire de contact">
        <p>
          Données demandées : nom, e-mail et message ; société et téléphone si vous les indiquez. Elles servent
          uniquement à vous répondre. Ce traitement repose sur notre intérêt légitime à répondre aux demandes reçues.
          Les messages sont conservés trois ans après le dernier échange.
        </p>
        <p>
          Votre adresse IP n&apos;est pas enregistrée : seule une empreinte chiffrée sert à limiter les envois
          abusifs.
        </p>
      </LegalSection>

      <LegalSection title="Prospection commerciale">
        <p>
          TutelLiv peut contacter par e-mail ou par téléphone des entreprises de coursiers et de livraison, au sujet
          de leur activité professionnelle. Les coordonnées proviennent de registres publics d&apos;entreprises, des
          sites de ces entreprises et d&apos;annuaires professionnels ; le premier message indique leur origine. Ce
          traitement repose sur notre intérêt légitime à faire connaître notre service à ces professionnels.
        </p>
        <p>
          Données utilisées : nom de l&apos;entreprise, nom et fonction de l&apos;interlocuteur, e-mail et téléphone
          professionnels, échanges. Elles sont conservées au plus trois ans après le dernier échange.
        </p>
        <p>
          Vous pouvez refuser à tout moment, gratuitement et sans justification : répondez « stop » à un message ou
          écrivez-nous depuis la page Contact. Nous retirons alors vos coordonnées et ne gardons que ce qui évite de
          vous recontacter.
        </p>
      </LegalSection>

      <LegalSection title="Création d'un compte entreprise">
        <p>
          Données demandées : prénom, nom, e-mail professionnel, mot de passe, nom de l&apos;entreprise, adresse
          de facturation ; raison sociale, SIREN, SIRET et téléphone si vous les indiquez. Elles servent à créer
          votre compte, à gérer votre abonnement et à vous facturer. Ce traitement repose sur le contrat si vous
          contractez vous-même, sinon sur notre intérêt légitime à gérer la relation avec votre entreprise ; les
          documents comptables relèvent de nos obligations légales.
        </p>
        <p>L&apos;inscription en ligne n&apos;est pas encore ouverte : aucun paiement n&apos;est possible sur ce site pour l&apos;instant.</p>
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
          l&apos;application s&apos;appuient sur OpenStreetMap, OSRM et le service d&apos;adresses de l&apos;IGN. Ces
          prestataires ne sont pas tous établis dans l&apos;Union européenne. Les données ne sont ni vendues ni
          utilisées à des fins publicitaires.
        </p>
      </LegalSection>

      <LegalSection title="Durée de conservation">
        <p>
          Messages de contact et prospection : trois ans après le dernier échange. Autres données :{" "}
          <em>En cours de définition.</em> Ces durées seront publiées ici avant l&apos;ouverture commerciale.
        </p>
      </LegalSection>

      <LegalSection title="Cookies et stockage local">
        <p>
          Le site n&apos;utilise aucun traceur publicitaire. Il dépose seulement ce qui est nécessaire à son
          fonctionnement : la session de connexion ou de démonstration, le suivi de l&apos;inscription en cours,
          votre choix de thème clair ou sombre et vos préférences d&apos;affichage. L&apos;application livreur garde
          aussi sur l&apos;appareil les actions en attente d&apos;envoi quand le réseau manque ; elles sont
          effacées dès leur envoi, et au plus tard sept jours après leur création si elles n&apos;ont pas pu partir.
        </p>
      </LegalSection>

      <LegalSection title="Vos droits">
        <p>
          Vous pouvez demander l&apos;accès à vos données, leur rectification, leur effacement, leur portabilité,
          la limitation de leur traitement ou vous y opposer, depuis la{" "}
          <Link href="/contact" className="font-semibold text-brand underline underline-offset-4">
            page Contact
          </Link>
          . Vous pouvez aussi adresser une réclamation à la CNIL (cnil.fr).
        </p>
      </LegalSection>
    </LegalDocument>
  );
}
