import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const root = process.cwd();
const todoPath = resolve(root, "TODO.md");
const sharePath = resolve(root, "outputs/TODO-Annona-vente.md");
const archivePath = resolve(root, "docs/TODO-ARCHIVE.md");
const startMarker = "<!-- TODO_PROGRESS_START -->";
const endMarker = "<!-- TODO_PROGRESS_END -->";

function writeIfChanged(path, content) {
  let current = null;
  try {
    current = readFileSync(path, "utf8");
  } catch {
    // Le fichier de partage est créé au premier passage.
  }
  if (current === content) return false;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, "utf8");
  return true;
}

let todo = readFileSync(todoPath, "utf8");
// Tâches closes déplacées dans l'archive : elles comptent toujours dans la jauge.
const archive = existsSync(archivePath) ? readFileSync(archivePath, "utf8") : "";
const tasks = [...todo.matchAll(/^- \[([ xX])\] /gm)];
const archived = [...archive.matchAll(/^- \[[xX]\] /gm)].length;
const remaining = tasks.filter((match) => match[1] === " ").length;
const completed = tasks.length - remaining + archived;
const total = completed + remaining;
const percent = total === 0 ? 0 : Math.round((completed / total) * 100);
const gaugeWidth = 20;
const filled = total === 0 ? 0 : Math.round((completed / total) * gaugeWidth);
const gauge = `${"█".repeat(filled)}${"░".repeat(gaugeWidth - filled)}`;
// Liste en simples tirets : seules les cases des tâches comptent dans la jauge.
// Chaque tâche ouverte porte « **Qui : Claude.** », « **Qui : Orso — condition.** » ou « **Qui : Théo.** » : celui qui agit ensuite.
const owners = ["Claude", "Orso", "Théo"];
const openTasks = [...todo.matchAll(/^- \[ \] \*\*(.+?)\.?\*\*[\s\S]*?(?=^- \[[ xX]\] |^## |(?![\s\S]))/gm)].map((match) => {
  const owner = match[0].match(new RegExp(`^\\s*\\*\\*Qui : (${owners.join("|")})(?: — (.+?))?\\.\\*\\*`, "m"));
  return { title: match[1], owner: owner?.[1] ?? null, when: owner?.[2] ?? null };
});
function taskList(owner) {
  const rows = openTasks.filter((task) => task.owner === owner);
  return [...rows.filter((task) => !task.when), ...rows.filter((task) => task.when)]
    .map((task) => `- ${task.title}${task.when ? ` (${task.when})` : ""}`)
    .join("\n");
}
const unclassified = taskList(null);
// Tableau Orso / Théo : tâches closes (« **Fait par : Orso et Théo.** » sous le titre) et tâches ouvertes.
const people = ["Orso", "Théo"];
const taskPattern = (box) => new RegExp(`^- \\[[${box}]\\] \\*\\*(.+?)\\.?\\*\\*[\\s\\S]*?(?=^- \\[[ xX]\\] |^## |(?![\\s\\S]))`, "gm");
const doneTasks = [...todo.matchAll(taskPattern("xX")), ...archive.matchAll(taskPattern("xX"))].map((match) => {
  const doneBy = match[0].match(/^\s*\*\*Fait par : (.+?)\.\*\*/m)?.[1] ?? "";
  return { title: match[1], by: people.filter((person) => doneBy.includes(person)) };
});
const shortTitle = (title) => title.split(" — ")[0];
const cell = (titles) => (titles.length ? titles.map(shortTitle).join(", ") : "—");
const doneBy = (person) => doneTasks.filter((task) => task.by.includes(person)).map((task) => task.title);
const openFor = (person) => openTasks.filter((task) => task.owner === person).map((task) => task.title);
const unassignedDone = doneTasks.filter((task) => task.by.length === 0).map((task) => task.title);
const whoTable = `**Qui a fait quoi**

| | ${people.join(" | ")} |
|---|${people.map(() => "---").join("|")}|
| Fait | ${people.map((person) => `**${doneBy(person).length}** : ${cell(doneBy(person))}`).join(" | ")} |
| À faire | ${people.map((person) => `**${openFor(person).length}** : ${cell(openFor(person))}`).join(" | ")} |
${unassignedDone.length ? `\n_Tâches closes sans « Fait par » : ${cell(unassignedDone)}._\n` : ""}`;
const block = `${startMarker}
## Progression globale

**${completed} tâches terminées sur ${total} — ${percent} %**

\`${gauge}\` · ${remaining} tâches restantes

${whoTable}
${owners.map((owner) => `**À faire par ${owner}**\n\n${taskList(owner) || "- Rien pour l'instant"}\n`).join("\n")}${unclassified ? `\n**À classer**\n\n${unclassified}\n` : ""}
_Une tâche faite à deux compte pour chacun. Chaque tâche ouverte est classée selon qui doit agir ensuite. Cette jauge compte les tâches closes, sans pondération de leur taille. Recalcul et synchronisation des copies : \`npm run todo:progress\`, automatiquement avant \`npm run docs:verify\`._
${endMarker}`;

const blockPattern = new RegExp(`${startMarker}[\\s\\S]*?${endMarker}`);
if (blockPattern.test(todo)) {
  todo = todo.replace(blockPattern, block);
} else {
  const titleEnd = todo.indexOf("\n", todo.indexOf("\n") + 1);
  todo = `${todo.slice(0, titleEnd)}\n\n${block}${todo.slice(titleEnd)}`;
}

const todoChanged = writeIfChanged(todoPath, todo);
const shareChanged = writeIfChanged(sharePath, todo);

console.log(JSON.stringify({
  total,
  completed,
  remaining,
  percent,
  todoChanged,
  shareChanged,
}));
