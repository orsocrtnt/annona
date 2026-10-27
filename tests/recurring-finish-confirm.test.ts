import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// « Terminer » une récurrence est irréversible (aucune reprise possible) : jamais sans confirmation.
test("terminer une récurrence passe par une confirmation qui nomme la récurrence", () => {
  const source = readFileSync("src/app/(client-portal)/portal/recurring/page.tsx", "utf8");
  const card = source.slice(source.indexOf("function RecurringCard"));
  assert.doesNotMatch(card, /onStatusChange\(item\.id, "CANCELLED"\)/, "la carte ne termine plus directement");
  assert.match(card, /onRequestFinish\(item\)/);

  const page = source.slice(0, source.indexOf("function RecurringCard"));
  assert.match(page, /<DialogTitle>Terminer « \{finishTarget\.label\} » \?<\/DialogTitle>/);
  assert.match(page, /irréversible/);
  assert.match(page, /onOpenAutoFocus=\{/, "focus initial sur « Annuler »");
  assert.match(page, /toggleStatus\(finishTarget\.id, "CANCELLED"\)/, "seule la confirmation termine");
});
