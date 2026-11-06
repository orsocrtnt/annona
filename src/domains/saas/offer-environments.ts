import type { SaasPlanCode } from "@prisma/client";

export type OfferEnvironmentKey =
  | "starter"
  | "starter-dispatcher"
  | "pro"
  | "business";

export type OfferEnvironmentDefinition = {
  key: OfferEnvironmentKey;
  planCode: SaasPlanCode;
  optionCodes: string[];
  name: string;
  slug: string;
  adminEmail: string;
  adminFirstName: string;
  adminLastName: string;
};

export const OFFER_ENVIRONMENT_PASSWORD = "Test1234!";

export const OFFER_ENVIRONMENTS: OfferEnvironmentDefinition[] = [
  {
    key: "starter",
    planCode: "STARTER",
    optionCodes: [],
    name: "Recette Starter",
    slug: "offre-starter",
    adminEmail: "offre-starter@annona.fr",
    adminFirstName: "Alex",
    adminLastName: "Starter",
  },
  {
    key: "starter-dispatcher",
    planCode: "STARTER",
    optionCodes: ["DISPATCHER_ALL"],
    name: "Recette Starter + dispatcher",
    slug: "offre-starter-dispatcher",
    adminEmail: "offre-starter-dispatcher@annona.fr",
    adminFirstName: "Dana",
    adminLastName: "Dispatch",
  },
  {
    key: "pro",
    planCode: "PRO",
    optionCodes: [],
    name: "Recette Pro",
    slug: "offre-pro",
    adminEmail: "offre-pro@annona.fr",
    adminFirstName: "Patrice",
    adminLastName: "Pro",
  },
  {
    key: "business",
    planCode: "BUSINESS",
    optionCodes: [],
    name: "Recette Business",
    slug: "offre-business",
    adminEmail: "offre-business@annona.fr",
    adminFirstName: "Bérénice",
    adminLastName: "Business",
  },
];

export function isOfferEnvironmentSlug(slug: string) {
  return OFFER_ENVIRONMENTS.some((environment) => environment.slug === slug);
}
