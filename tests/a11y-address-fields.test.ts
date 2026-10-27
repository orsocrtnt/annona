import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (file: string) => readFileSync(file, "utf8");

test("la saisie d'adresse est un combobox ARIA, sans bouton imbriqué dans les options", () => {
  const source = read("src/components/addresses/address-fields-group.tsx");
  assert.match(source, /role="combobox"/);
  assert.match(source, /aria-activedescendant=/);
  assert.match(source, /id=\{`\$\{listId\}-\$\{index\}`\}/);
  const listbox = source.slice(source.indexOf('role="listbox"'));
  assert.doesNotMatch(listbox.slice(0, listbox.indexOf("</ul>")), /<button/);
});

test("chaque sélecteur « Adresse enregistrée » nomme son bouton réel", () => {
  for (const file of [
    "src/features/client-portal/create-order-form.tsx",
    "src/features/client-portal/create-recurring-order-form.tsx",
  ]) {
    const source = read(file);
    const fields = [...source.matchAll(/<FormField label="Adresse enregistrée"([^>]*)>/g)];
    assert.ok(fields.length > 0, file);
    for (const [, attrs] of fields) {
      const id = /htmlFor="([^"]+)"/.exec(attrs ?? "")?.[1];
      assert.ok(id, `${file} : htmlFor manquant`);
      assert.match(source, new RegExp(`<SelectTrigger id="${id}"`), `${file} : ${id}`);
    }
  }
});
