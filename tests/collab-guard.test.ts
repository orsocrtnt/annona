// COLLAB-2 — garde-fou du travail à deux (Orso et Théo) avant chaque push.
import assert from "node:assert/strict";
import test from "node:test";
import { branchOwner, findConflicts, tasksInProgress } from "../scripts/collab/collab-overlap.mjs";

const todo = `## Tâches ouvertes

- [ ] **CAT-2 — Catalogue saisonnier.**

  **Qui : Claude.**
  **En cours : Orso.**

- [ ] **FACT-2 — Avoirs.**

  **Qui : Claude.**
  **En cours : Théo.**

- [ ] **SEP-1 — Séparer.**

  **Qui : Orso.**

_Note de section : schéma Prisma **En cours : Orso** (ne compte pas pour SEP-1)._

- [ ] **LOT1-D1 — Tournées.**

  **Qui : Orso — relire.** **En cours : Orso.**
`;

test("COLLAB-2 : branchOwner lit le prénom de la branche, sans accent", () => {
  assert.equal(branchOwner("Théo/garde-collab"), "theo");
  assert.equal(branchOwner("orso/lot1-retouches"), "orso");
  assert.equal(branchOwner("base"), null);
});

test("COLLAB-2 : tasksInProgress ne garde que les tâches annoncées « En cours »", () => {
  const tasks = tasksInProgress(todo);
  assert.deepEqual(
    tasks.map((task) => [task.id, task.person]),
    [
      ["CAT-2", "orso"],
      ["FACT-2", "theo"],
      ["LOT1-D1", "orso"],
    ],
  );
});

const orsoBranch = (files: string[]) => ({
  branch: "origin/orso/catalogue",
  person: "orso",
  files,
  tasks: tasksInProgress(todo),
});

test("COLLAB-2 : un même fichier de code modifié des deux côtés bloque le push", () => {
  const result = findConflicts({
    me: "theo",
    myFiles: ["src/features/catalog/page.tsx", "TODO.md"],
    myTasks: [],
    others: [orsoBranch(["src/features/catalog/page.tsx", "TODO.md"])],
  });
  assert.equal(result.blocking.length, 1);
  assert.match(result.blocking[0] ?? "", /src\/features\/catalog\/page\.tsx/);
  assert.ok(result.warnings.some((warning) => /TODO\.md/.test(warning)), "TODO.md est signalé sans bloquer");
});

test("COLLAB-2 : TODO.md seul en commun ne bloque pas", () => {
  const result = findConflicts({
    me: "theo",
    myFiles: ["TODO.md", "package-lock.json"],
    myTasks: [],
    others: [orsoBranch(["TODO.md", "package-lock.json"])],
  });
  assert.deepEqual(result.blocking, []);
});

test("COLLAB-2 : deux migrations différentes bloquent (un seul développeur sur prisma/)", () => {
  const result = findConflicts({
    me: "theo",
    myFiles: ["prisma/migrations/2026_a/migration.sql"],
    myTasks: [],
    others: [orsoBranch(["prisma/migrations/2026_b/migration.sql"])],
  });
  assert.equal(result.blocking.length, 1);
  assert.match(result.blocking[0] ?? "", /prisma\//);
});

test("COLLAB-2 : prendre une tâche déjà « En cours » chez l'autre bloque", () => {
  const result = findConflicts({
    me: "theo",
    myFiles: ["src/a.ts"],
    myTasks: [{ id: "CAT-2" }],
    others: [orsoBranch(["src/b.ts"])],
  });
  assert.equal(result.blocking.length, 1);
  assert.match(result.blocking[0] ?? "", /CAT-2/);
});

test("COLLAB-2 : travail sans rapport → aucun blocage, tâches de l'autre affichées", () => {
  const result = findConflicts({
    me: "theo",
    myFiles: ["src/a.ts"],
    myTasks: [{ id: "FACT-2" }],
    others: [orsoBranch(["src/b.ts"])],
  });
  assert.deepEqual(result.blocking, []);
  assert.ok(result.warnings.some((warning) => /CAT-2/.test(warning)));
  assert.ok(!result.warnings.some((warning) => /FACT-2/.test(warning)), "mes propres tâches ne sont pas signalées");
});

test("COLLAB-2 : mes propres branches sont ignorées", () => {
  const result = findConflicts({
    me: "theo",
    myFiles: ["src/a.ts"],
    myTasks: [],
    others: [{ branch: "origin/theo/autre", person: "theo", files: ["src/a.ts"], tasks: [] }],
  });
  assert.deepEqual(result, { blocking: [], warnings: [] });
});
