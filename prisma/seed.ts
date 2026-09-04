import { PrismaClient, SystemRole } from "@prisma/client";

const prisma = new PrismaClient();

const PERMISSIONS = [
  // Users
  { slug: "users:read", name: "Lire les utilisateurs", resource: "users", action: "read" },
  { slug: "users:create", name: "Créer des utilisateurs", resource: "users", action: "create" },
  { slug: "users:update", name: "Modifier les utilisateurs", resource: "users", action: "update" },
  { slug: "users:delete", name: "Supprimer les utilisateurs", resource: "users", action: "delete" },
  // Companies
  { slug: "companies:read", name: "Lire les entreprises", resource: "companies", action: "read" },
  { slug: "companies:create", name: "Créer des entreprises", resource: "companies", action: "create" },
  { slug: "companies:update", name: "Modifier les entreprises", resource: "companies", action: "update" },
  { slug: "companies:delete", name: "Supprimer les entreprises", resource: "companies", action: "delete" },
  // Deliveries (future)
  { slug: "deliveries:read", name: "Lire les livraisons", resource: "deliveries", action: "read" },
  { slug: "deliveries:create", name: "Créer des livraisons", resource: "deliveries", action: "create" },
  { slug: "deliveries:update", name: "Modifier les livraisons", resource: "deliveries", action: "update" },
  { slug: "deliveries:delete", name: "Supprimer les livraisons", resource: "deliveries", action: "delete" },
  { slug: "deliveries:dispatch", name: "Dispatcher les livraisons", resource: "deliveries", action: "dispatch" },
  // Orders (future)
  { slug: "orders:read", name: "Lire les commandes", resource: "orders", action: "read" },
  { slug: "orders:create", name: "Créer des commandes", resource: "orders", action: "create" },
  { slug: "orders:update", name: "Modifier les commandes", resource: "orders", action: "update" },
  // Drivers (future)
  { slug: "drivers:read", name: "Lire les chauffeurs", resource: "drivers", action: "read" },
  { slug: "drivers:manage", name: "Gérer les chauffeurs", resource: "drivers", action: "manage" },
  // Vehicles (future)
  { slug: "vehicles:read", name: "Lire les véhicules", resource: "vehicles", action: "read" },
  { slug: "vehicles:manage", name: "Gérer les véhicules", resource: "vehicles", action: "manage" },
  // Analytics (future)
  { slug: "analytics:read", name: "Lire les analytics", resource: "analytics", action: "read" },
  // Settings
  { slug: "settings:read", name: "Lire les paramètres", resource: "settings", action: "read" },
  { slug: "settings:update", name: "Modifier les paramètres", resource: "settings", action: "update" },
  // Dashboard
  { slug: "dashboard:admin", name: "Dashboard Super Admin", resource: "dashboard", action: "admin" },
  { slug: "dashboard:company", name: "Dashboard Entreprise", resource: "dashboard", action: "company" },
  { slug: "dashboard:dispatcher", name: "Dashboard Dispatcher", resource: "dashboard", action: "dispatcher" },
  { slug: "dashboard:driver", name: "Dashboard Chauffeur", resource: "dashboard", action: "driver" },
  { slug: "dashboard:client", name: "Dashboard Client", resource: "dashboard", action: "client" },
  // Invoices
  { slug: "invoices:read", name: "Lire les factures", resource: "invoices", action: "read" },
  { slug: "invoices:create", name: "Créer des factures", resource: "invoices", action: "create" },
  { slug: "invoices:update", name: "Modifier les factures", resource: "invoices", action: "update" },
  // Support
  { slug: "support:read", name: "Lire le support", resource: "support", action: "read" },
  { slug: "support:create", name: "Créer une demande support", resource: "support", action: "create" },
] as const;

const ROLE_PERMISSIONS: Record<SystemRole, string[]> = {
  SUPER_ADMIN: PERMISSIONS.map((p) => p.slug),
  COMPANY_ADMIN: [
    "users:read", "users:create", "users:update", "users:delete",
    "companies:read", "companies:update",
    "deliveries:read", "deliveries:create", "deliveries:update", "deliveries:delete", "deliveries:dispatch",
    "orders:read", "orders:create", "orders:update",
    "drivers:read", "drivers:manage",
    "vehicles:read", "vehicles:manage",
    "analytics:read",
    "settings:read", "settings:update",
    "invoices:read", "invoices:create", "invoices:update",
    "dashboard:company",
  ],
  DISPATCHER: [
    "deliveries:read", "deliveries:create", "deliveries:update", "deliveries:dispatch",
    "orders:read", "orders:create", "orders:update",
    "drivers:read",
    "vehicles:read",
    "dashboard:dispatcher",
  ],
  MINI_ADMIN: [
    "users:read", "users:create", "users:update", "users:delete",
    "companies:read", "companies:update",
    "deliveries:read", "deliveries:create", "deliveries:update", "deliveries:delete", "deliveries:dispatch",
    "orders:read", "orders:create", "orders:update",
    "drivers:read", "drivers:manage",
    "vehicles:read", "vehicles:manage",
    "analytics:read",
    "settings:read", "settings:update",
    "invoices:read", "invoices:create", "invoices:update",
    "support:read",
    "dashboard:company",
    "dashboard:dispatcher",
  ],
  DRIVER: [
    "deliveries:read", "deliveries:update",
    "dashboard:driver",
  ],
  CLIENT: [
    "orders:read",
    "orders:create",
    "deliveries:read",
    "invoices:read",
    "support:read",
    "support:create",
    "settings:read",
    "settings:update",
    "dashboard:client",
  ],
};

const ROLES = [
  { slug: "super-admin", name: "Super Admin", systemRole: SystemRole.SUPER_ADMIN, description: "Accès complet à la plateforme" },
  { slug: "company-admin", name: "Administrateur", systemRole: SystemRole.COMPANY_ADMIN, description: "Gestion complète de l'entreprise" },
  { slug: "mini-admin", name: "Mini-admin", systemRole: SystemRole.MINI_ADMIN, description: "Ops quotidien sans paramètres ni gestion des comptes" },
  { slug: "dispatcher", name: "Dispatcher", systemRole: SystemRole.DISPATCHER, description: "Gestion des livraisons et dispatch" },
  { slug: "driver", name: "Chauffeur", systemRole: SystemRole.DRIVER, description: "Exécution des livraisons" },
  { slug: "client", name: "Client", systemRole: SystemRole.CLIENT, description: "Suivi des commandes et livraisons" },
] as const;

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
      where: { slug: { in: permissionSlugs } },
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
