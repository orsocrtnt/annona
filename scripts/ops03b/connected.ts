import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { prisma } from "../../src/services/prisma/client";
import { getUserByAuthId } from "../../src/domains/user/user.service";
import { getServiceHealth } from "../../src/domains/operations/service-health.service";

const output = resolve(process.argv[2] ?? "outputs/ops03b/connected.json");
const startedAt = new Date();

async function main() {
  const fixture = await prisma.user.findFirst({
    where: { status: "ACTIVE" },
    select: { authId: true },
  });
  if (!fixture) throw new Error("OPS03B_ACTIVE_FIXTURE_MISSING");

  const authStarted = performance.now();
  const users = await Promise.all(
    Array.from({ length: 20 }, () => getUserByAuthId(fixture.authId))
  );
  if (users.some((user) => !user)) throw new Error("OPS03B_AUTH_READ_FAILED");

  const health = await getServiceHealth();
  if (health.status !== "ok") throw new Error("OPS03B_HEALTH_NOT_OK");

  const proof = {
    task: "OPS-03B-local",
    passed: true,
    startedAt: startedAt.toISOString(),
    completedAt: new Date().toISOString(),
    concurrentAuth: {
      reads: users.length,
      durationMs: Math.round(performance.now() - authStarted),
      allResolved: true,
    },
    health: {
      status: health.status,
      checks: health.checks,
      configuration: health.configuration,
    },
    mutations: 0,
  };
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(proof, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({
    passed: proof.passed,
    concurrentAuthReads: proof.concurrentAuth.reads,
    health: proof.health.status,
    mutations: proof.mutations,
  }));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "OPS03B_UNKNOWN_ERROR");
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
