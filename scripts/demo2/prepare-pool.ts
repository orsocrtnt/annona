import "./node-websocket";
import { prisma } from "../../src/services/prisma/client";
import { DEMO_COMPANY_SLUG, DEMO_POOL_MIN_READY } from "../../src/lib/demo/constants";
import { prepareDemoPool } from "../../src/domains/demo/demo-pool.service";

async function main() {
  const requestedSize = Number.parseInt(process.env.DEMO_POOL_SIZE ?? String(DEMO_POOL_MIN_READY), 10);
  const size = Number.isFinite(requestedSize) ? requestedSize : DEMO_POOL_MIN_READY;
  if (size < DEMO_POOL_MIN_READY) throw new Error(`DEMO_POOL_SIZE doit être >= ${DEMO_POOL_MIN_READY}`);
  const base = await prisma.company.findUnique({ where: { slug: DEMO_COMPANY_SLUG } });
  if (!base?.isDemo) throw new Error("Modèle permanent de démonstration introuvable");
  const stats = await prepareDemoPool({ baseCompanyId: base.id, size });
  if (stats.ready < DEMO_POOL_MIN_READY) {
    throw new Error(`Stock prêt insuffisant: ${stats.ready}/${DEMO_POOL_MIN_READY}`);
  }
  console.log(JSON.stringify({ success: true, stats }));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
