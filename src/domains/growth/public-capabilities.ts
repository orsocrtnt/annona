export type PublicClaim = {
  text: string;
  /** Mention courte affichée à côté de la phrase : fonction en option ou dépendante de la formule. */
  badge?: string;
  proof: string;
  needles: string[];
};

export type PublicCapability = {
  id: "client" | "dispatch" | "driver";
  title: string;
  claims: PublicClaim[];
};

/**
 * Phrases de la page publique /fonctionnalites. Chacune pointe vers l'écran livré qui la prouve
 * (`proof`) et vers des textes présents dans ce fichier (`needles`), vérifiés par tests/growth01-features.test.ts.
 * Ne rien ajouter ici qui ne soit pas livré et validé (Factur-X et commande par message attendent encore le propriétaire).
 */
export const PUBLIC_CAPABILITIES: PublicCapability[] = [
  {
    id: "client",
    title: "Client",
    claims: [
      {
        text: "Commander une livraison en ligne, avec créneau et poids.",
        proof: "src/app/(client-portal)/portal/orders/[id]/page.tsx",
        needles: ["Créneau :", "Poids :"],
      },
      {
        text: "Commander sans compte, depuis le lien partagé par son transporteur.",
        proof: "src/app/commander/[token]/page.tsx",
        needles: ["Pas de compte à créer"],
      },
      {
        text: "Lire le statut et sa date de mise à jour.",
        proof: "src/components/shared/order-tracking.tsx",
        needles: ["État mis à jour le"],
      },
      {
        text: "Voir l'heure d'arrivée estimée.",
        proof: "src/features/client-portal/client-delivery-arrival.tsx",
        needles: ["Arrivée estimée"],
      },
      {
        text: "Chaque position est datée. Entre deux signaux, le livreur avance vers sa prochaine étape en position estimée, signalée comme telle ; sans signal depuis 3 min, il s'arrête, marqué « Signal perdu ». Ce signal ne garantit pas un suivi permanent.",
        proof: "src/components/shared/order-tracking.tsx",
        needles: ["Position absente", "Position estimée", "Signal perdu", "ne garantit pas un suivi permanent"],
      },
      {
        text: "Télécharger la preuve de livraison en PDF.",
        proof: "src/features/deliveries/proof-of-delivery-card.tsx",
        needles: ["Télécharger la preuve (PDF)"],
      },
      {
        text: "Échanger sur la commande, et y signaler un incident.",
        proof: "src/components/shared/order-conversation.tsx",
        needles: ["Aucun échange pour cette commande.", "INCIDENT"],
      },
      {
        text: "Consulter l'historique des commandes.",
        proof: "src/features/client-portal/client-orders-history-content.tsx",
        needles: ["historique"],
      },
    ],
  },
  {
    id: "dispatch",
    title: "Administration et dispatch",
    claims: [
      {
        text: "Partager un lien de commande à ses clients.",
        proof: "src/features/back-office/order-intake/order-intake-channels.tsx",
        needles: ["Lien de commande", "ils commandent sans compte"],
      },
      {
        text: "Recevoir les commandes par e-mail ou WhatsApp : chacune arrive en brouillon, à relire et valider.",
        badge: "En option",
        proof: "src/features/back-office/order-intake/order-intake-channels.tsx",
        needles: ["WhatsApp", "Chaque commande devient un brouillon"],
      },
      {
        text: "Voir les livraisons à assigner et lancer une affectation.",
        proof: "src/app/(back-office)/dispatch/page.tsx",
        needles: ["À assigner"],
      },
      {
        text: "Recevoir pour chaque livraison les 3 livreurs les mieux placés, et valider en un clic.",
        badge: "Selon la formule",
        proof: "src/features/back-office/dispatch-settings-form.tsx",
        needles: ["Les 3 meilleurs livreurs sont proposés pour chaque livraison"],
      },
      {
        text: "Suivre livreurs et livraisons sur une même carte.",
        proof: "src/features/back-office/dashboard-widget-renderer.tsx",
        needles: ["Livreurs et livraisons : choisissez la vue"],
      },
      {
        text: "Regrouper des livraisons en tournées.",
        proof: "src/app/(back-office)/dispatch/page.tsx",
        needles: ["Tournées"],
      },
      {
        text: "Repérer les imprévus et les traiter depuis le dispatch.",
        proof: "src/features/back-office/dispatch-incidents-panel.tsx",
        needles: ["Imprévus à traiter"],
      },
      {
        text: "Lire la chronologie datée des actions de la mission.",
        proof: "src/components/shared/order-tracking.tsx",
        needles: ["Chronologie des actions"],
      },
      {
        text: "Envoyer un message partagé ou une note interne.",
        proof: "src/components/shared/order-conversation.tsx",
        needles: ["Envoyer le message partagé", "Note interne"],
      },
      {
        text: "Envoyer la preuve de livraison au donneur d'ordre, automatiquement.",
        proof: "src/app/(back-office)/settings/page.tsx",
        needles: ["Envoyer la preuve au client par e-mail"],
      },
      {
        text: "Émettre la facture dès la livraison.",
        proof: "src/features/back-office/billing-settings-content.tsx",
        needles: ["Émettre la facture à la livraison"],
      },
    ],
  },
  {
    id: "driver",
    title: "Livreur",
    claims: [
      {
        text: "Être prévenu d'une nouvelle mission par notification.",
        proof: "src/domains/driver/driver-push.service.ts",
        needles: ["Nouvelle mission"],
      },
      {
        text: "Confirmer la prise en charge, ou constater qu'elle ne l'est pas encore.",
        proof: "src/components/shared/order-tracking.tsx",
        needles: ["Prise en charge confirmée", "Prise en charge non confirmée."],
      },
      {
        text: "Voir son ordre de passage dans la tournée.",
        proof: "src/features/driver/mission-card.tsx",
        needles: ["Tournée · arrêt"],
      },
      {
        text: "Joindre une photo lorsque le colis est remis.",
        proof: "src/features/driver/proof-of-delivery-dialog.tsx",
        needles: ["Prenez une photo du colis remis"],
      },
      {
        text: "Faire signer le destinataire du doigt, quand l'entreprise le demande.",
        proof: "src/features/driver/signature-pad.tsx",
        needles: ["Faites signer du doigt dans le cadre"],
      },
      {
        text: "Le partage de position est limité au service ouvert et à la mission démarrée.",
        proof: "src/components/shared/order-tracking.tsx",
        needles: ["Partage limité au service ouvert et à la mission démarrée."],
      },
      {
        text: "Rendre une mission avec un motif conservé dans l'historique partagé.",
        proof: "src/features/driver/mission-card.tsx",
        needles: ["historique partagé"],
      },
    ],
  },
];
