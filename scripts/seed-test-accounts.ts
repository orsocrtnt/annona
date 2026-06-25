import { PrismaClient } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";
import ws from "ws";
import { linkPortalDataToClient } from "../src/domains/client-portal/client-data.service";

const prisma = new PrismaClient();

const TEST_PASSWORD = "Test1234!";

const DRIVERS = [
  { firstName: "Jean", lastName: "Test", email: "livreur-test-1@tutelliv.fr" },
  { firstName: "Pierre", lastName: "Test", email: "livreur-test-2@tutelliv.fr" },
  { firstName: "Marc", lastName: "Test", email: "livreur-test-3@tutelliv.fr" },
] as const;

const CLIENTS = [
  { firstName: "Marie", lastName: "Test", email: "client-test-1@tutelliv.fr" },
  { firstName: "Sophie", lastName: "Test", email: "client-test-2@tutelliv.fr" },
  { firstName: "Lucas", lastName: "Test", email: "client-test-3@tutelliv.fr" },
  { firstName: "Emma", lastName: "Test", email: "client-test-4@tutelliv.fr" },
  { firstName: "Thomas", lastName: "Test", email: "client-test-5@tutelliv.fr" },
  { firstName: "Julie", lastName: "Test", email: "client-test-6@tutelliv.fr" },
  { firstName: "Antoine", lastName: "Test", email: "client-test-7@tutelliv.fr" },
  { firstName: "Camille", lastName: "Test", email: "client-test-8@tutelliv.fr" },
  { firstName: "Nicolas", lastName: "Test", email: "client-test-9@tutelliv.fr" },
  { firstName: "Laura", lastName: "Test", email: "client-test-10@tutelliv.fr" },
] as const;

function createSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Variables Supabase manquantes (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)");
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
    realtime: { transport: ws as never },
  });
}

async function resolveCompanyId(): Promise<string> {
  const admin = await prisma.user.findFirst({
    where: {
      email: "orsocarotenuto@gmail.com",
      companyId: { not: null },
    },
    select: { companyId: true },
  });
  if (admin?.companyId) return admin.companyId;

  const companyAdmin = await prisma.user.findFirst({
    where: {
      companyId: { not: null },
      role: { systemRole: "COMPANY_ADMIN" },
    },
    orderBy: { createdAt: "asc" },
    select: { companyId: true },
  });
  if (companyAdmin?.companyId) return companyAdmin.companyId;

  const company = await prisma.company.findFirst({
    where: { status: { in: ["ACTIVE", "TRIAL"] } },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true },
  });
  if (!company) throw new Error("Aucune entreprise trouvée");
  return company.id;
}

async function createTestUser(
  companyId: string,
  roleSlug: "driver" | "client",
  account: { firstName: string; lastName: string; email: string }
) {
  const existing = await prisma.user.findUnique({ where: { email: account.email } });
  if (existing) {
    console.log(`  ⏭  ${account.email} — déjà existant`);
    return { email: account.email, skipped: true as const };
  }

  const role = await prisma.role.findUnique({ where: { slug: roleSlug } });
  if (!role) throw new Error(`Rôle ${roleSlug} introuvable — lancez npm run db:seed`);

  const supabase = createSupabaseAdmin();
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: account.email,
    password: TEST_PASSWORD,
    email_confirm: true,
    user_metadata: {
      first_name: account.firstName,
      last_name: account.lastName,
    },
  });

  if (authError || !authData.user) {
    const msg = authError?.message?.toLowerCase() ?? "";
    if (msg.includes("already") || msg.includes("exists") || msg.includes("registered")) {
      console.log(`  ⏭  ${account.email} — déjà dans Supabase`);
      return { email: account.email, skipped: true as const };
    }
    throw new Error(`Supabase: ${authError?.message ?? "échec création"}`);
  }

  try {
    const user = await prisma.user.create({
      data: {
        authId: authData.user.id,
        email: account.email,
        firstName: account.firstName,
        lastName: account.lastName,
        roleId: role.id,
        companyId,
        status: "ACTIVE",
        phone:
          roleSlug === "driver"
            ? `06${String(10 + DRIVERS.findIndex((d) => d.email === account.email)).padStart(2, "0")}000000`
            : null,
      },
    });

    if (roleSlug === "client") {
      await linkPortalDataToClient(user.id, account.email);
    }

    console.log(`  ✅ ${account.email}`);
    return { email: account.email, skipped: false as const };
  } catch (error) {
    await supabase.auth.admin.deleteUser(authData.user.id);
    throw error;
  }
}

async function main() {
  console.log("🧪 Création des comptes de test...\n");

  const companyId = await resolveCompanyId();
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { name: true },
  });
  console.log(`Entreprise : ${company?.name ?? companyId}\n`);

  console.log("Chauffeurs (3) :");
  for (const driver of DRIVERS) {
    await createTestUser(companyId, "driver", driver);
  }

  console.log("\nClients (10) :");
  for (const client of CLIENTS) {
    await createTestUser(companyId, "client", client);
  }

  console.log("\n────────────────────────────────────────");
  console.log(`Mot de passe commun : ${TEST_PASSWORD}`);
  console.log("Connexion livreur → /login/driver");
  console.log("Connexion client   → /login/client");
  console.log("────────────────────────────────────────\n");
  console.log("✅ Terminé");
}

main()
  .catch((error) => {
    console.error("❌ Erreur:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
