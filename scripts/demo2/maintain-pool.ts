import "./node-websocket";
import { prisma } from "../../src/services/prisma/client";
import { getDemoPoolStats, maintainDemoPool } from "../../src/domains/demo/demo-pool.service";

async function main() {
  const results = await maintainDemoPool({ limit: 10 });
  const stats = await getDemoPoolStats();
  console.log(JSON.stringify({ success: results.every((item) => item.status !== "quarantined"), stats, processed: results.length }));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
