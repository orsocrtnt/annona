import type { DeliveryCategory } from "@prisma/client";

export const DELIVERY_CATEGORY_LABELS: Record<DeliveryCategory, string> = {
  STANDARD: "Commande",
  COURIER: "Course",
  SPECIAL_MISSION: "Mission spéciale",
};

export const DELIVERY_CATEGORY_DESCRIPTIONS: Record<DeliveryCategory, string> = {
  STANDARD: "Achat et livraison",
  COURIER: "Collecte et livraison",
  SPECIAL_MISSION: "Déménagement, assistance à une personne, etc. — sur devis",
};

export const PORTAL_CATEGORY_DESCRIPTIONS: Record<DeliveryCategory, string> = {
  STANDARD: "Achat et livraison",
  COURIER: "Collecte et livraison",
  SPECIAL_MISSION: "Décrivez votre besoin, nous vous enverrons un devis",
};
