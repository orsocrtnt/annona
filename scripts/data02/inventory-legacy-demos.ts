import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { inspectLegacyDemoSessions } from "../../src/domains/data-lifecycle/demo-legacy-inventory.service";
import { prisma } from "../../src/services/prisma/client";

async function main() {
  const args = process.argv.slice(2);
  const deep = args.includes("--deep");
  const paths = args.filter((arg) => arg !== "--deep");
  if (paths.length > 1 || args.some((arg) => arg.startsWith("--") && arg !== "--deep")) {
    throw new Error("INVALID_ARGUMENTS");
  }
  const output = resolve(paths[0] ?? "outputs/data02/demo-legacy-inventory.json");
  const inventory = await inspectLegacyDemoSessions({ deep });
  const proof = {
    task: "DATA-02-legacy-demo-inventory",
    inspectedAt: new Date().toISOString(),
    status: inventory.truncated ? "incomplete" : "passed-read-only",
    inventory,
  };
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(proof, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({
    status: proof.status,
    inspected: inventory.inspected,
    truncated: inventory.truncated,
    classification: inventory.classification,
    safetySignals: inventory.safetySignals,
    databaseReviewCandidates: inventory.databaseReviewCandidates,
    deepSafety: inventory.deepSafety,
    deepReviewCandidates: inventory.deepReviewCandidates,
    mutations: inventory.mutations,
    identifiersDisclosed: inventory.identifiersDisclosed,
  }));
  if (inventory.truncated) process.exitCode = 2;
}

main()
  .catch(() => {
    console.error("DEMO_LEGACY_INVENTORY_FAILED");
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
