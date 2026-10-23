import { PrismaClient } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";
import ws from "ws";
import { DEMO_CLIENT_EMAIL, DEMO_DRIVER_EMAIL, DEMO_LOGIN_EMAIL } from "../src/lib/demo/constants";
import { OFFER_ENVIRONMENTS } from "../src/domains/saas/offer-environments";

const APPLY = process.argv.includes("--apply");
const prisma = new PrismaClient();

function createAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("OFFER_SUPABASE_CONFIG_MISSING");
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
    realtime: { transport: ws as never },
  });
}

function isProtectedCompany(company: {
  isDemo: boolean;
  slug: string;
  demoPoolEnvironment: { id: string } | null;
}) {
  if (company.isDemo) return true;
  if (company.demoPoolEnvironment) return true;
  return OFFER_ENVIRONMENTS.some((environment) => environment.slug === company.slug);
}

async function listAuthUsers() {
  const admin = createAdmin();
  const users: Array<{ id: string; email?: string }> = [];
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    users.push(...data.users.map((user) => ({ id: user.id, email: user.email ?? undefined })));
    if (data.users.length < 200) break;
  }
  return users;
}

async function deleteCompanyGraph(companyId: string) {
  const users = await prisma.user.findMany({ where: { companyId }, select: { id: true } });
  const userIds = users.map((user) => user.id);
  await prisma.signupJourney.updateMany({ where: { companyId }, data: { companyId: null } });
  await prisma.operationJob.deleteMany({ where: { companyId } });
  await prisma.supportTicket.deleteMany({ where: { companyId } });
  await prisma.invoice.deleteMany({ where: { companyId } });
  await prisma.recurringOrder.deleteMany({ where: { companyId } });
  await prisma.delivery.deleteMany({ where: { companyId } });
  if (userIds.length > 0) {
    await prisma.driverLocation.deleteMany({ where: { driverId: { in: userIds } } });
  }
  await prisma.order.deleteMany({ where: { companyId } });
  await prisma.user.deleteMany({ where: { companyId } });
  await prisma.company.delete({ where: { id: companyId } });
}

async function main() {
  const offerEmails = new Set(OFFER_ENVIRONMENTS.map((environment) => environment.adminEmail.toLowerCase()));
  const companies = await prisma.company.findMany({
    select: {
      id: true,
      name: true,
      slug: true,
      email: true,
      isDemo: true,
      siren: true,
      siret: true,
      demoPoolEnvironment: { select: { id: true, slot: true } },
      signupJourney: { select: { id: true, status: true, email: true } },
      _count: { select: { users: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  const journeys = await prisma.signupJourney.findMany({
    select: {
      id: true,
      status: true,
      email: true,
      companyName: true,
      authUserId: true,
      companyId: true,
      siren: true,
      siret: true,
      failureCode: true,
    },
    orderBy: { createdAt: "desc" },
  });
  const dbUsers = await prisma.user.findMany({
    select: { id: true, email: true, authId: true, companyId: true, role: { select: { slug: true } } },
  });
  const authUsers = await listAuthUsers();

  const removableCompanies = companies.filter((company) => !isProtectedCompany(company));
  const removableJourneys = journeys.filter((journey) => {
    const email = journey.email?.toLowerCase();
    if (email && offerEmails.has(email)) return false;
    return true;
  });
  const protectedAuthIds = new Set(
    dbUsers
      .filter((user) => companies.some((company) => company.id === user.companyId && isProtectedCompany(company)))
      .map((user) => user.authId)
  );
  const removableAuth = authUsers.filter((user) => {
    const email = user.email?.toLowerCase();
    if (email && offerEmails.has(email)) return false;
    if (email && [DEMO_LOGIN_EMAIL, DEMO_CLIENT_EMAIL, DEMO_DRIVER_EMAIL].includes(email)) return false;
    if (protectedAuthIds.has(user.id)) return false;
    return true;
  });

  console.log(JSON.stringify({
    apply: APPLY,
    keep: companies.filter(isProtectedCompany).map((company) => ({
      slug: company.slug,
      name: company.name,
      isDemo: company.isDemo,
      demoSlot: company.demoPoolEnvironment?.slot ?? null,
    })),
    removeCompanies: removableCompanies.map((company) => ({
      slug: company.slug,
      name: company.name,
      email: company.email,
      users: company._count.users,
      signup: company.signupJourney?.email ?? null,
      siren: company.siren,
      siret: company.siret,
    })),
    removeJourneys: removableJourneys.map((journey) => ({
      status: journey.status,
      email: journey.email,
      companyName: journey.companyName,
      siren: journey.siren,
      siret: journey.siret,
    })),
    removeAuth: removableAuth.map((user) => user.email ?? user.id),
  }, null, 2));

  if (!APPLY) {
    console.log("Dry-run. Relancer avec --apply pour supprimer.");
    return;
  }

  const admin = createAdmin();
  for (const company of removableCompanies) {
    await deleteCompanyGraph(company.id);
    console.log(`company removed: ${company.slug}`);
  }
  await prisma.signupJourney.deleteMany({
    where: { id: { in: removableJourneys.map((journey) => journey.id) } },
  });
  for (const user of removableAuth) {
    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) console.error(`auth delete failed ${user.email ?? user.id}: ${error.message}`);
    else console.log(`auth removed: ${user.email ?? user.id}`);
  }
  const leftoverUsers = await prisma.user.findMany({
    where: {
      OR: [
        { companyId: null },
        { companyId: { in: removableCompanies.map((company) => company.id) } },
      ],
    },
    select: { id: true, email: true, authId: true },
  });
  if (leftoverUsers.length > 0) {
    await prisma.user.deleteMany({ where: { id: { in: leftoverUsers.map((user) => user.id) } } });
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
