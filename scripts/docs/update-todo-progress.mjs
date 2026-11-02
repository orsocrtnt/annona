import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const root = process.cwd();
const todoPath = resolve(root, "TODO.md");
const sharePath = resolve(root, "outputs/TODO-TutelLiv-vente.md");
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
// Chaque tâche ouverte porte « **Qui : Claude.** » ou « **Qui : Toi — condition.** » : celui qui agit ensuite.
const openTasks = [...todo.matchAll(/^- \[ \] \*\*(.+?)\.?\*\*[\s\S]*?(?=^- \[[ xX]\] |^## |(?![\s\S]))/gm)].map((match) => {
  const owner = match[0].match(/^\s*\*\*Qui : (Claude|Toi)(?: — (.+?))?\.\*\*/m);
  return { title: match[1], owner: owner?.[1] ?? null, when: owner?.[2] ?? null };
});
function taskList(owner) {
  const rows = openTasks.filter((task) => task.owner === owner);
  return [...rows.filter((task) => !task.when), ...rows.filter((task) => task.when)]
    .map((task) => `- ${task.title}${task.when ? ` (${task.when})` : ""}`)
    .join("\n");
}
const unclassified = taskList(null);
const block = `${startMarker}
## Progression globale

**${completed} tâches terminées sur ${total} — ${percent} %**

\`${gauge}\` · ${remaining} tâches restantes

**À faire par Claude**

${taskList("Claude")}

**À faire par toi**

${taskList("Toi")}
${unclassified ? `\n**À classer**\n\n${unclassified}\n` : ""}
_Chaque tâche est classée selon qui doit agir ensuite. Cette jauge compte les tâches closes, sans pondération de leur taille. Recalcul et synchronisation des copies : \`npm run todo:progress\`, automatiquement avant \`npm run docs:verify\`._
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
