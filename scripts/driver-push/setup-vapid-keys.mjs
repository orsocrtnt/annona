#!/usr/bin/env node
// À lancer une seule fois par le propriétaire. Crée la paire de clés des notifications livreur et la pose
// dans les fichiers d'environnement locaux et sur Vercel (branche preproduction uniquement), sans l'afficher.
import { spawnSync } from "node:child_process";
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import webPush from "web-push";

const FILES = [".env.local", ".env.preproduction.local"];
const { publicKey, privateKey } = webPush.generateVAPIDKeys();

const already = FILES.filter((file) => existsSync(file) && readFileSync(file, "utf8").includes("VAPID_PRIVATE_KEY="));
if (already.length > 0) {
  console.error(`Clés déjà présentes dans ${already.join(", ")} : rien n'est modifié. Changer de clés invalide les abonnements.`);
  process.exit(1);
}

for (const [name, value] of [["NEXT_PUBLIC_VAPID_PUBLIC_KEY", publicKey], ["VAPID_PRIVATE_KEY", privateKey]]) {
  const added = spawnSync("vercel", ["env", "add", name, "preview", "preproduction"], { input: value, encoding: "utf8" });
  if (added.status !== 0) {
    console.error(`Échec de l'ajout de ${name} sur Vercel : aucune clé n'est écrite en local. Vérifier « vercel env ls ».`);
    process.exit(1);
  }
  console.log(`${name} : ajoutée sur Vercel (preview, preproduction).`);
}

for (const file of FILES) {
  if (!existsSync(file)) continue;
  const content = readFileSync(file, "utf8");
  appendFileSync(file, `${content.endsWith("\n") ? "" : "\n"}NEXT_PUBLIC_VAPID_PUBLIC_KEY=${publicKey}\nVAPID_PRIVATE_KEY=${privateKey}\n`);
  console.log(`${file} : clés ajoutées.`);
}
console.log("Terminé. Il reste à redéployer preproduction : la clé publique est lue au build.");
