import {
  OFFER_ENVIRONMENT_PASSWORD,
  OFFER_ENVIRONMENTS,
} from "../src/domains/saas/offer-environments";
import { provisionOfferEnvironments } from "../src/domains/saas/offer-environment.service";
import { prisma } from "../src/services/prisma/client";

async function main() {
  console.log("Provision des environnements d’offre (hors démo publique)\n");
  const results = await provisionOfferEnvironments();
  for (const result of results) {
    const definition = OFFER_ENVIRONMENTS.find((item) => item.slug === result.slug);
    console.log(`- ${definition?.name ?? result.slug}`);
    console.log(`  email : ${result.email}`);
    console.log(`  mot de passe : ${OFFER_ENVIRONMENT_PASSWORD}`);
    console.log(`  offre : ${definition?.planCode}${definition?.optionCodes.length ? ` + ${definition.optionCodes.join(", ")}` : ""}`);
  }
  console.log("\nCes comptes n’utilisent pas le pool de démonstration.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
