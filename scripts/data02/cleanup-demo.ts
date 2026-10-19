import { prisma } from "../../src/services/prisma/client";
import {
  cleanupExpiredDemoSessions,
} from "../../src/domains/data-lifecycle/demo-cleanup-batch.service";
import {
  DEMO_CLEANUP_AUTHORIZATION,
} from "../../src/domains/data-lifecycle/demo-cleanup.service";

async function main() {
  const args = process.argv.slice(2);
  if (args.some((arg) => arg !== "--apply") || args.length > 1) throw new Error("INVALID_ARGUMENTS");
  const apply = args.includes("--apply");
  if (apply && process.env.DEMO_CLEANUP_ENABLED !== DEMO_CLEANUP_AUTHORIZATION) throw new Error("EXPLICIT_ACTIVATION_REQUIRED");
  const result = await cleanupExpiredDemoSessions({
    apply,
    authorization: process.env.DEMO_CLEANUP_ENABLED,
  });
  console.log(JSON.stringify(result));
  if (!result.success) process.exitCode = 2;
}
main().catch(() => { console.error("DEMO_CLEANUP_FAILED"); process.exitCode = 1; }).finally(() => prisma.$disconnect());
