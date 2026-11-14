#!/usr/bin/env node
// COLLAB-2 — Avant un push, vérifie que l'autre développeur ne travaille pas déjà sur la même chose.
// Lancé automatiquement par .githooks/pre-push (installer avec `npm run collab:install-hook`)
// ou à la main avec `npm run collab:check`.
// Contournement ponctuel, en connaissance de cause : ANNONA_COLLAB_OK=1 git push …
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import {
  FORBIDDEN_TARGETS,
  branchOwner,
  findConflicts,
  personFromGitName,
  tasksInProgress,
} from "./collab-overlap.mjs";

const ZERO = /^0+$/;
const isHook = process.argv.includes("--hook");

function git(...args) {
  return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
}
function tryGit(...args) {
  try {
    return git(...args);
  } catch {
    return null;
  }
}
const lines = (text) => (text ? text.split(/\r?\n/).filter(Boolean) : []);

// Le hook reçoit sur l'entrée standard : <réf locale> <sha local> <réf distante> <sha distant>.
function readPushedRefs() {
  if (!isHook) return [];
  let input = "";
  try {
    input = readFileSync(0, "utf8");
  } catch {
    return [];
  }
  return lines(input).map((line) => {
    const [localRef, localSha, remoteRef] = line.split(" ");
    return { localRef, localSha, remoteBranch: remoteRef?.replace(/^refs\/heads\//, "") };
  });
}

const pushed = readPushedRefs();
const blocking = [];

for (const ref of pushed) {
  if (FORBIDDEN_TARGETS.has(ref.remoteBranch)) {
    blocking.push(`Push direct sur « ${ref.remoteBranch} » interdit : passer par une branche <prénom>/<sujet> et une PR (AGENTS.md).`);
  }
}

const currentBranch = tryGit("rev-parse", "--abbrev-ref", "HEAD") ?? "";
const me =
  branchOwner(pushed.find((ref) => ref.remoteBranch)?.remoteBranch ?? "") ??
  branchOwner(currentBranch) ??
  personFromGitName(tryGit("config", "user.name") ?? "");

if (!process.argv.includes("--no-fetch") && tryGit("fetch", "origin", "--prune", "--quiet") === null) {
  console.warn("⚠ Impossible de récupérer origin : comparaison avec l'état connu localement.");
}

const tips = pushed.filter((ref) => ref.localSha && !ZERO.test(ref.localSha)).map((ref) => ref.localSha);
if (!tips.length) tips.push("HEAD");

const myFiles = [...new Set(tips.flatMap((tip) => lines(tryGit("diff", "--name-only", `origin/base...${tip}`))))];
const myTodo = tryGit("show", `${tips[0]}:TODO.md`) ?? "";
const myTasks = tasksInProgress(myTodo).filter((task) => task.person === me);

const others = [];
// Tâches annoncées sur base (la référence commune).
const baseTasks = tasksInProgress(tryGit("show", "origin/base:TODO.md") ?? "");
others.push({ branch: "origin/base", person: "", files: [], tasks: baseTasks });

for (const remote of lines(tryGit("for-each-ref", "--format=%(refname:short)", "refs/remotes/origin"))) {
  const branch = remote.replace(/^origin\//, "");
  const person = branchOwner(branch);
  if (!person || person === me || remote === "origin/HEAD") continue;
  // Branche déjà fusionnée dans base : plus de travail en cours.
  if (tryGit("merge-base", "--is-ancestor", remote, "origin/base") !== null) continue;
  others.push({
    branch: remote,
    person,
    files: lines(tryGit("diff", "--name-only", `origin/base...${remote}`)),
    tasks: tasksInProgress(tryGit("show", `${remote}:TODO.md`) ?? ""),
  });
}

const result = findConflicts({ me, myFiles, myTasks, others });
blocking.push(...result.blocking);

const activeOthers = others.filter((other) => other.person && other.person !== me);
console.log(`Garde-fou travail à deux — toi : ${me || "inconnu"}, ${myFiles.length} fichier(s) changé(s) par rapport à base.`);
console.log(
  activeOthers.length
    ? `Branches en cours de l'autre : ${activeOthers.map((other) => other.branch).join(", ")}`
    : "Aucune branche en cours de l'autre sur GitHub.",
);
for (const warning of result.warnings) console.log(`  ⚠ ${warning}`);

if (blocking.length) {
  console.error("\n✖ Conflit possible avec le travail de l'autre :");
  for (const reason of blocking) console.error(`  - ${reason}`);
  console.error("\nParlez-vous avant de pousser. Si c'est voulu : ANNONA_COLLAB_OK=1 git push …");
  if (process.env.ANNONA_COLLAB_OK === "1") {
    console.error("ANNONA_COLLAB_OK=1 : push autorisé malgré tout.");
    process.exit(0);
  }
  process.exit(1);
}
console.log("✔ Rien en commun avec le travail en cours de l'autre.");
