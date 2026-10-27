import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// La fiche client restait en chargement infini : la requête sélectionnait `invoices` et `tickets`,
// absents du modèle User (erreur Prisma à l'exécution, invisible au typage).
test("la fiche client ne sélectionne que des champs du modèle User", () => {
  const schema = readFileSync("prisma/schema.prisma", "utf8");
  const userModel = schema.match(/^model User \{[\s\S]*?^\}/m)?.[0] ?? "";
  const userFields = new Set(userModel.split("\n").map((line) => line.trim().split(/\s+/)[0]).filter(Boolean));

  const source = readFileSync("src/domains/client-portal/client-admin.service.ts", "utf8");
  const fn = source.slice(source.indexOf("export async function getCompanyClientDetail"));
  const select = fn.slice(fn.indexOf("prisma.user.findFirst"), fn.indexOf("if (!client) return null;"));
  const keys = [...select.matchAll(/^ {6}([a-zA-Z]+):/gm)].map((match) => match[1]!);

  assert.ok(keys.length >= 8, `clés trouvées : ${keys.join(", ")}`);
  for (const key of keys) assert.ok(userFields.has(key), `champ inconnu sur User : ${key}`);
});
