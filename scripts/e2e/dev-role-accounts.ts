import { randomBytes } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { PrismaClient } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";
import ws from "ws";
import { validateDevEnvironment } from "../env2/verify-dev-env";
import { buildMiniAdminSettings, type MiniAdminModuleId } from "../../src/lib/permissions/mini-admin";

/**
 * Comptes de recette navigateur par rôle, sur la base de développement uniquement (ENV-2).
 * La démo n'offre que les personas administrateur, client et livreur : ces comptes couvrent
 * le dispatcher, le mini-admin et le super-admin. Ils sont rattachés à l'entreprise modèle
 * « LogiExpress Démo », hors du pool de démo, et supprimés par `cleanup`.
 *
 *   npm run e2e:role-accounts -- setup    # crée ou réarme, écrit outputs/e2e-role-accounts.json
 *   npm run e2e:role-accounts -- cleanup  # supprime comptes et manifeste
 */
export const ROLE_ACCOUNTS_MANIFEST = resolve("outputs/e2e-role-accounts.json");

type Account = {
  key: "dispatcher" | "miniAdminDispatch" | "miniAdminSupport" | "superAdmin";
  email: string;
  roleSlug: "dispatcher" | "mini-admin" | "super-admin";
  firstName: string;
  modules?: MiniAdminModuleId[];
  company: boolean;
};

const ACCOUNTS: Account[] = [
  { key: "dispatcher", email: "e2e-role-dispatcher@tutelliv.fr", roleSlug: "dispatcher", firstName: "Dispatch", company: true },
  { key: "miniAdminDispatch", email: "e2e-role-mini-dispatch@tutelliv.fr", roleSlug: "mini-admin", firstName: "MiniDispatch", modules: ["dispatch", "delivery-map"], company: true },
  { key: "miniAdminSupport", email: "e2e-role-mini-support@tutelliv.fr", roleSlug: "mini-admin", firstName: "MiniSupport", modules: ["support"], company: true },
  { key: "superAdmin", email: "e2e-role-super-admin@tutelliv.fr", roleSlug: "super-admin", firstName: "SuperAdmin", company: false },
];

const prisma = new PrismaClient();

function supabaseAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
    realtime: { transport: ws as never },
  });
}

async function templateCompanyId() {
  const company = await prisma.company.findFirst({
    where: { isDemo: true, name: "LogiExpress Démo", demoPoolEnvironment: { is: null } },
    select: { id: true, _count: { select: { deliveries: true } } },
  });
  if (!company || company._count.deliveries === 0) throw new Error("TEMPLATE_DEMO_COMPANY_MISSING");
  return company.id;
}

async function setup() {
  const admin = supabaseAdmin();
  const companyId = await templateCompanyId();
  const manifest: Record<string, { email: string; password: string }> = {};

  for (const account of ACCOUNTS) {
    const password = `E2e-${randomBytes(12).toString("base64url")}!`;
    const role = await prisma.role.findUnique({ where: { slug: account.roleSlug }, select: { id: true } });
    if (!role) throw new Error(`ROLE_MISSING:${account.roleSlug}`);
    const settings = account.modules ? buildMiniAdminSettings("Recette e2e", account.modules) : {};
    const existing = await prisma.user.findUnique({ where: { email: account.email }, select: { authId: true } });

    if (existing) {
      const { error } = await admin.auth.admin.updateUserById(existing.authId, { password });
      if (error) throw new Error(`AUTH_UPDATE_FAILED:${account.key}`);
      await prisma.user.update({
        where: { email: account.email },
        data: { roleId: role.id, companyId: account.company ? companyId : null, status: "ACTIVE", settings },
      });
    } else {
      const { data, error } = await admin.auth.admin.createUser({
        email: account.email,
        password,
        email_confirm: true,
        user_metadata: { first_name: account.firstName, last_name: "E2E" },
      });
      if (error || !data.user) throw new Error(`AUTH_CREATE_FAILED:${account.key}`);
      try {
        await prisma.user.create({
          data: {
            authId: data.user.id,
            email: account.email,
            firstName: account.firstName,
            lastName: "E2E",
            roleId: role.id,
            companyId: account.company ? companyId : null,
            status: "ACTIVE",
            settings,
          },
        });
      } catch (createError) {
        await admin.auth.admin.deleteUser(data.user.id);
        throw createError;
      }
    }
    manifest[account.key] = { email: account.email, password };
  }

  mkdirSync(dirname(ROLE_ACCOUNTS_MANIFEST), { recursive: true });
  writeFileSync(ROLE_ACCOUNTS_MANIFEST, JSON.stringify(manifest, null, 2));
  chmodSync(ROLE_ACCOUNTS_MANIFEST, 0o600);
  console.log(JSON.stringify({ passed: true, accounts: ACCOUNTS.map((account) => account.key), manifest: "outputs/e2e-role-accounts.json" }));
}

async function cleanup() {
  const admin = supabaseAdmin();
  const users = await prisma.user.findMany({
    where: { email: { in: ACCOUNTS.map((account) => account.email) } },
    select: { id: true, authId: true },
  });
  await prisma.user.deleteMany({ where: { id: { in: users.map((user) => user.id) } } });
  for (const user of users) {
    const { error } = await admin.auth.admin.deleteUser(user.authId);
    if (error && !/not found/i.test(error.message)) throw new Error("AUTH_DELETE_FAILED");
  }
  if (existsSync(ROLE_ACCOUNTS_MANIFEST)) rmSync(ROLE_ACCOUNTS_MANIFEST);
  console.log(JSON.stringify({ passed: true, removed: users.length }));
}

async function main() {
  const command = process.argv[2];
  if (command !== "setup" && command !== "cleanup") throw new Error("USAGE: setup | cleanup");
  const errors = validateDevEnvironment(process.env);
  if (errors.length) throw new Error(`DEV_ENVIRONMENT_REQUIRED:${errors.join(",")}`);
  await (command === "setup" ? setup() : cleanup());
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "FAILED");
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
