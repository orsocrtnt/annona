import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import test from "node:test";

// DB-1 / SEC-06 : chaque table publique créée par migration reste fermée à l'API Supabase.
// L'application passe par Prisma ; anon et authenticated ne doivent rien pouvoir lire ni écrire.
const root = "prisma/migrations";
const migrations = readdirSync(root)
  .filter((name) => existsSync(`${root}/${name}/migration.sql`))
  .sort()
  .map((name) => ({ name, sql: readFileSync(`${root}/${name}/migration.sql`, "utf8") }));
const statements = migrations.flatMap(({ name, sql }) =>
  sql.replace(/--.*$/gm, "").split(";").map((text) => ({ name, text: text.replace(/\s+/g, " ").trim() }))
);

const quoted = (list: string) => [...list.matchAll(/"([a-z_]+)"/g)].map((match) => match[1]!);
const created = new Map<string, string>();
const dropped = new Set<string>();
for (const { name, text } of statements) {
  const create = /^CREATE TABLE "([a-z_]+)"/i.exec(text);
  if (create) created.set(create[1]!, name);
  const drop = /^DROP TABLE (?:IF EXISTS )?(.+)$/i.exec(text);
  if (drop) quoted(drop[1]!).forEach((table) => dropped.add(table));
}
const tables = [...created.keys()].filter((table) => !dropped.has(table)).sort();

// SCHEMA-1 (6 novembre 2026) : une migration initiale, puis seulement des migrations additives listées ici.
// CAT-1 : `categories.active` (ADM-02).
test("DB-1 migrations : migration initiale puis ajouts listés, tables identiques aux @@map du schéma", () => {
  assert.deepEqual(migrations.map(({ name }) => name), ["20261106200000_init", "20261107090000_category_active", "20261110100000_delivery_zones", "20261110110000_product_allergens", "20261110120000_promotions"]);
  const schema = readFileSync("prisma/schema.prisma", "utf8");
  const mapped = [...schema.matchAll(/@@map\("([a-z_]+)"\)/g)].map((match) => match[1]!).sort();
  assert.ok(mapped.length >= 25, "schéma lu");
  assert.deepEqual(tables, mapped, "une table sans migration, ou une migration sans modèle");
});

test("DB-1 migrations : chaque table a la RLS et aucun droit pour PUBLIC, anon ni authenticated", () => {
  assert.ok(tables.length >= 25, `tables créées : ${tables.length}`);
  const revoked = new Map<string, Set<string>>();
  for (const { text } of statements) {
    // Forme simple ou bloc DO conditionnel : REVOKE ALL [PRIVILEGES] ON [TABLE] "a", "b" FROM r1, r2
    for (const match of text.matchAll(/REVOKE ALL (?:PRIVILEGES )?ON (?:TABLE )?((?:"[a-z_]+"(?:, )?)+) FROM ([a-z_, ]+)/gi)) {
      const roles = match[2]!.split(",").map((role) => role.trim().toLowerCase());
      for (const table of quoted(match[1]!)) {
        const set = revoked.get(table) ?? new Set<string>();
        roles.forEach((role) => set.add(role));
        revoked.set(table, set);
      }
    }
  }
  const missing = tables.flatMap((table) => {
    const problems: string[] = [];
    if (!statements.some(({ text }) => new RegExp(`^ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY$`, "i").test(text))) problems.push("RLS");
    for (const role of ["public", "anon", "authenticated"]) if (!revoked.get(table)?.has(role)) problems.push(`REVOKE ${role}`);
    return problems.length ? [`${table} (${created.get(table)}) : ${problems.join(", ")}`] : [];
  });
  assert.deepEqual(missing, []);
});

test("DB-1 migrations : aucune politique ni aucun GRANT n'ouvre une table aux rôles de l'API", () => {
  const opened = statements
    .filter(({ text }) => /^CREATE POLICY\b/i.test(text) || /^GRANT\b[^]*\bON (?:TABLE |ALL TABLES )?[^]*\bTO\b[^]*\b(anon|authenticated|public)\b/i.test(text))
    .map(({ name, text }) => `${name} : ${text.slice(0, 120)}`);
  assert.deepEqual(opened, []);
});

test("DB-1 migrations : la table de suivi de Prisma est fermée elle aussi", () => {
  const texts = statements.map(({ text }) => text);
  assert.ok(texts.includes('ALTER TABLE "_prisma_migrations" ENABLE ROW LEVEL SECURITY'));
  assert.ok(texts.includes('REVOKE ALL PRIVILEGES ON TABLE "_prisma_migrations" FROM PUBLIC, anon, authenticated'));
});
