import { execSync } from "node:child_process";

function isPortInUse(port) {
  try {
    const out = execSync(`lsof -ti:${port} 2>/dev/null || true`, { encoding: "utf8" }).trim();
    return Boolean(out);
  } catch {
    return false;
  }
}

if (isPortInUse(3000)) {
  console.error(
    "\n[tutelliv] ERREUR : `npm run dev` tourne encore sur le port 3000.\n" +
      "Arrêtez-le (Ctrl+C dans le terminal) avant de lancer `npm run build`.\n" +
      "Sinon le cache .next se corrompt et provoque des erreurs (ex: Cannot find module './5611.js').\n"
  );
  process.exit(1);
}
