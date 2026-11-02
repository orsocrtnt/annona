import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const root = process.cwd();
const todoPath = resolve(root, "TODO.md");
const sharePath = resolve(root, "outputs/TODO-TutelLiv-vente.md");
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
const tasks = [...todo.matchAll(/^- \[([ xX])\] /gm)];
const total = tasks.length;
const completed = tasks.filter((match) => match[1].toLowerCase() === "x").length;
const remaining = total - completed;
const percent = total === 0 ? 0 : Math.round((completed / total) * 100);
const gaugeWidth = 20;
const filled = total === 0 ? 0 : Math.round((completed / total) * gaugeWidth);
const gauge = `${"█".repeat(filled)}${"░".repeat(gaugeWidth - filled)}`;
// Liste en simples tirets : seules les cases des tâches comptent dans la jauge.
const openTasks = [...todo.matchAll(/^- \[ \] \*\*(.+?)\.?\*\*/gm)].map((match) => `- ${match[1]}`).join("\n");
const block = `${startMarker}
## Progression globale

**${completed} tâches terminées sur ${total} — ${percent} %**

\`${gauge}\` · ${remaining} tâches restantes

${openTasks}

_Cette jauge compte les tâches closes, sans pondération de leur taille. Recalcul et synchronisation des copies : \`npm run todo:progress\`, automatiquement avant \`npm run docs:verify\`._
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
