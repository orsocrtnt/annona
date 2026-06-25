import { provisionDemoEnvironment } from "../src/domains/demo/demo-provision.service";
import {
  DEMO_DEFAULT_PASSWORD,
  DEMO_LOGIN_EMAIL,
} from "../src/lib/demo/constants";

async function main() {
  console.log("🎬 Provisionnement de l'environnement de démonstration...\n");

  const result = await provisionDemoEnvironment();

  console.log("────────────────────────────────────────");
  console.log("Entreprise : LogiExpress Démo");
  console.log(`Email      : ${result.loginEmail}`);
  console.log(`Mot de passe : ${result.password}`);
  console.log("Connexion  : /login");
  console.log("────────────────────────────────────────");
  console.log("\n✅ Environnement de démo prêt (8 livraisons de scénario)");
}

main().catch((error) => {
  console.error("❌ Erreur:", error);
  process.exit(1);
});
