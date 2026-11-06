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
