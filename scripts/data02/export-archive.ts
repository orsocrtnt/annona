import { exportCompanyArchive } from "../../src/domains/data-lifecycle/company-archive.service";
import { prisma } from "../../src/services/prisma/client";

async function run() {
  const [companyId, privateParent, ...extra] = process.argv.slice(2);
  if (!companyId || !privateParent || extra.length) {
    throw new Error("Usage: tsx scripts/data02/export-archive.ts <companyId> <private-directory>");
  }
  const result = await exportCompanyArchive(companyId, privateParent);
  console.log(JSON.stringify(result, null, 2));
}
void run().catch((error) => {
  // Provider/Prisma errors may contain sensitive connection information.
  console.error(error instanceof Error && /^(ARCHIVE_|POD_STORAGE_)[A-Z_]+$/.test(error.message)
    ? error.message : "ARCHIVE_EXPORT_FAILED");
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
