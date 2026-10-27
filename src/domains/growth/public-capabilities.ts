export type PublicClaim = {
  text: string;
  proof: string;
  needles: string[];
};

export type PublicCapability = {
  id: "client" | "dispatch" | "driver";
  title: string;
  claims: PublicClaim[];
};

export const PUBLIC_CAPABILITIES: PublicCapability[] = [
  {
    id: "client",
    title: "Client",
    claims: [
      {
        text: "Créer une commande de livraison.",
        proof: "src/app/(client-portal)/portal/orders/new/page.tsx",
        needles: ["Nouvelle commande"],
      },
      {
        text: "Lire le statut et sa date de mise à jour.",
        proof: "src/components/shared/order-tracking.tsx",
        needles: ["État mis à jour le"],
      },
      {
        text: "Chaque position est datée. Si le signal se perd, une position estimée est affichée et signalée comme telle, puis la dernière position connue. Ce signal ne garantit pas un suivi permanent.",
        proof: "src/components/shared/order-tracking.tsx",
        needles: ["Position absente", "Position estimée", "dernière position connue", "ne garantit pas un suivi permanent"],
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
        text: "Voir les livraisons à assigner et lancer une affectation.",
        proof: "src/app/(back-office)/dispatch/page.tsx",
        needles: ["À assigner"],
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
    ],
  },
  {
    id: "driver",
    title: "Livreur",
    claims: [
      {
        text: "Confirmer la prise en charge, ou constater qu'elle ne l'est pas encore.",
        proof: "src/components/shared/order-tracking.tsx",
        needles: ["Prise en charge confirmée", "Prise en charge non confirmée."],
      },
      {
        text: "Joindre une photo lorsque le colis est remis.",
        proof: "src/features/driver/proof-of-delivery-dialog.tsx",
        needles: ["Prenez une photo du colis remis"],
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
