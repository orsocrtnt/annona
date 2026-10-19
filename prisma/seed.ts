import { PrismaClient } from "@prisma/client";
import { PERMISSIONS, ROLE_PERMISSIONS, ROLES } from "./reference-data";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  for (const perm of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { slug: perm.slug },
      update: {},
      create: perm,
    });
  }

  for (const role of ROLES) {
    const permissionSlugs = ROLE_PERMISSIONS[role.systemRole];
    const permissions = await prisma.permission.findMany({
      where: { slug: { in: [...permissionSlugs] } },
    });

    const upserted = await prisma.role.upsert({
      where: { slug: role.slug },
      update: {
        name: role.name,
        description: role.description,
        systemRole: role.systemRole,
      },
      create: {
        name: role.name,
        slug: role.slug,
        description: role.description,
        systemRole: role.systemRole,
        isSystem: true,
      },
    });

    await prisma.rolePermission.createMany({
      data: permissions.map((p) => ({
        roleId: upserted.id,
        permissionId: p.id,
      })),
      skipDuplicates: true,
    });
  }

  console.log("✅ Seed completed");
  console.log("ℹ️  Pour l'environnement de démo commerciale : npm run db:seed-demo");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
