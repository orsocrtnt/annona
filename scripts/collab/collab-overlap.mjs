// COLLAB-2 — Règles pures du garde-fou de travail à deux (sans accès Git).
// Testées par tests/collab-guard.test.ts.

// Fichiers que tout le monde modifie : un chevauchement y est signalé, jamais bloquant.
export const SHARED_FILES = new Set([
  "TODO.md",
  "docs/TODO-ARCHIVE.md",
  "outputs/TODO-Annona-vente.md",
  "package-lock.json",
]);

// Zones où un seul développeur à la fois peut travailler, même sur des fichiers différents
// (AGENTS.md : schéma Prisma, migrations, seeds).
export const EXCLUSIVE_ZONES = [{ prefix: "prisma/", label: "schéma Prisma, migrations et seeds" }];

// Branches que personne ne pousse directement.
export const FORBIDDEN_TARGETS = new Set(["base", "main", "preproduction"]);

export function normalizePerson(name) {
  return String(name ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();
}

// Identifiants Git ou GitHub connus → prénom utilisé dans les branches et TODO.md.
export const PERSON_ALIASES = { orsocrtnt: "orso", theoner13: "theo" };

// Prénom tiré de `git config user.name` (hors branche <prénom>/…) :
// « orsocrtnt » → « orso », « Theo Nerisson » → « theo ».
export function personFromGitName(gitName) {
  const full = normalizePerson(gitName);
  if (!full) return "";
  const first = full.split(/\s+/)[0] ?? "";
  return PERSON_ALIASES[full] ?? PERSON_ALIASES[first] ?? first;
}

// « theo/garde-collab » → « theo » ; « base » → null.
export function branchOwner(branch) {
  const match = /^([^/]+)\/.+/.exec(branch);
  return match ? normalizePerson(match[1]) : null;
}

// Tâches ouvertes de TODO.md avec la personne qui les a prises (« **En cours : Orso.** »).
export function tasksInProgress(todo) {
  const blocks = [...String(todo ?? "").matchAll(/^- \[ \] \*\*(.+?)\.?\*\*[\s\S]*?(?=^- \[[ xX]\] |^## |(?![\s\S]))/gm)];
  const result = [];
  for (const block of blocks) {
    // Mention sur sa propre ligne ou sur la ligne « Qui : … » : une note de section qui suit la tâche ne compte pas.
    const owner = /^\s*(?:\*\*Qui :[^\n]*?)?\*\*En cours : ([^.*]+?)\.?\*\*/m.exec(block[0]);
    if (!owner) continue;
    const title = String(block[1]);
    const id = String(title.split(" — ")[0]).trim();
    result.push({ id, title, person: normalizePerson(owner[1]), personLabel: owner[1].trim() });
  }
  return result;
}

/**
 * Compare mon travail à celui des autres.
 * @param {{ me: string, myFiles: string[], myTasks: {id:string}[], others: {branch:string, person:string, files:string[], tasks:{id:string,title:string,person:string,personLabel?:string}[]}[] }} input
 * @returns {{ blocking: string[], warnings: string[] }}
 */
export function findConflicts({ me, myFiles, myTasks, others }) {
  const blocking = [];
  const warnings = [];
  const mine = new Set(myFiles);
  const myTaskIds = new Set(myTasks.map((task) => task.id));
  const seenTasks = new Set();

  for (const other of others) {
    if (other.person === me) continue;
    const common = other.files.filter((file) => mine.has(file));
    const hard = common.filter((file) => !SHARED_FILES.has(file));
    const soft = common.filter((file) => SHARED_FILES.has(file));
    if (hard.length) {
      blocking.push(`Fichiers modifiés aussi sur ${other.branch} : ${hard.join(", ")}`);
    }
    if (soft.length) {
      warnings.push(`Fichiers partagés modifiés aussi sur ${other.branch} (fusion des deux versions à prévoir) : ${soft.join(", ")}`);
    }
    for (const zone of EXCLUSIVE_ZONES) {
      const theirs = other.files.some((file) => file.startsWith(zone.prefix));
      const ours = myFiles.some((file) => file.startsWith(zone.prefix));
      if (theirs && ours && !hard.some((file) => file.startsWith(zone.prefix))) {
        blocking.push(`${other.branch} travaille aussi sur ${zone.label} (${zone.prefix}) : un seul développeur à la fois.`);
      }
    }
    for (const task of other.tasks) {
      if (task.person === me) continue;
      const key = `${task.id}|${task.person}`;
      if (myTaskIds.has(task.id)) {
        if (!seenTasks.has(`block|${task.id}`)) {
          blocking.push(`La tâche ${task.id} est « En cours : ${task.personLabel ?? task.person} » (vue sur ${other.branch}).`);
          seenTasks.add(`block|${task.id}`);
        }
      } else if (!seenTasks.has(key)) {
        warnings.push(`${task.personLabel ?? task.person} a en cours : ${task.title}`);
        seenTasks.add(key);
      }
    }
  }
  return { blocking, warnings };
}
