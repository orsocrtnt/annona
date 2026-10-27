import { PrismaClient } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";
import ws from "ws";
import { planOwnerAccount, OwnerProvisionError } from "../../src/domains/admin/platform-owner";
import { validatePreproductionEnvironment } from "../ci/verify-preproduction-env";

const FIRST_NAME = "Propriétaire";
const LAST_NAME = "Plateforme";

function fail(message: string): never {
  console.error(message);
  process.exitCode = 1;
  throw new Error(message);
}

async function main() {
  const errors = validatePreproductionEnvironment(process.env);
  if (errors.length) fail("La cible n'est pas la préproduction autorisée.");

  const email = process.env.PLATFORM_OWNER_EMAIL ?? "";
  const password = process.env.PLATFORM_OWNER_PASSWORD ?? "";
  if (!email || !password) fail("E-mail ou mot de passe absent de l'environnement.");

  if (process.env.DIRECT_URL) process.env.DATABASE_URL = process.env.DIRECT_URL;
  const prisma = new PrismaClient();
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { autoRefreshToken: false, persistSession: false },
      realtime: { transport: ws as never },
    },
  );

  try {
    const existing = await prisma.user.findFirst({
      where: { email: email.trim().toLowerCase() },
      include: { role: { select: { systemRole: true } } },
    });
    if (existing) {
      const ready =
        existing.role.systemRole === "SUPER_ADMIN" &&
        existing.companyId === null &&
        existing.status === "ACTIVE";
      if (!ready) fail("Cet e-mail est déjà un autre compte.");
      console.log("Compte propriétaire déjà en place.");
      return;
    }

    const existingSuperAdminCount = await prisma.user.count({
      where: { role: { systemRole: "SUPER_ADMIN" } },
    });
    const plan = planOwnerAccount({ email, password, existingSuperAdminCount });
    const role = await prisma.role.findUnique({
      where: { slug: plan.roleSlug },
      select: { id: true },
    });
    if (!role) fail("Rôle super-admin introuvable.");

    const created = await supabase.auth.admin.createUser({
      email: plan.email,
      password: plan.password,
      email_confirm: true,
      user_metadata: { first_name: FIRST_NAME, last_name: LAST_NAME },
    });
    if (created.error || !created.data.user) fail("Création de l'authentification impossible.");

    try {
      await prisma.user.create({
        data: {
          authId: created.data.user.id,
          email: plan.email,
          firstName: FIRST_NAME,
          lastName: LAST_NAME,
          status: plan.status,
          roleId: role.id,
          companyId: plan.companyId,
        },
      });
    } catch {
      await supabase.auth.admin.deleteUser(created.data.user.id);
      fail("Création du compte impossible.");
    }

    console.log(`Compte propriétaire prêt : ${plan.email}`);
    console.log("Aucun mot de passe n'est affiché.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  if (error instanceof OwnerProvisionError) {
    console.error(error.message);
    process.exitCode = 1;
    return;
  }
  if (process.exitCode !== 1) {
    console.error("Création impossible.");
    process.exitCode = 1;
  }
});
