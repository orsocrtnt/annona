import { PrismaClient } from "@prisma/client";
import { createClientOrder } from "../src/domains/order/order.service";
import type { CreateClientOrderInput } from "../src/lib/validations/order";

const prisma = new PrismaClient();

const STANDARD_ITEMS = [
  "Colis documents",
  "Carton 5 kg",
  "Enveloppe express",
  "Pièces détachées",
  "Matériel informatique",
  "Échantillons produits",
  "Fournitures bureau",
  "Petit électroménager",
  "Vêtements",
  "Produits cosmétiques",
];

const COURIER_MISSIONS = [
  "Documents urgents",
  "Clés à récupérer",
  "Échantillon labo",
  "Contrat à signer",
  "Matériel événement",
];

const PARIS_ADDRESSES = [
  { address: "12 Rue de Rivoli", city: "Paris", postalCode: "75001" },
  { address: "45 Avenue des Champs-Élysées", city: "Paris", postalCode: "75008" },
  { address: "8 Boulevard Haussmann", city: "Paris", postalCode: "75009" },
  { address: "22 Rue de la Roquette", city: "Paris", postalCode: "75011" },
  { address: "5 Place de la Bastille", city: "Paris", postalCode: "75012" },
  { address: "18 Rue de Vaugirard", city: "Paris", postalCode: "75015" },
  { address: "3 Rue de Belleville", city: "Paris", postalCode: "75020" },
  { address: "14 Avenue de la République", city: "Boulogne-Billancourt", postalCode: "92100" },
  { address: "27 Rue Gabriel Péri", city: "Levallois-Perret", postalCode: "92300" },
  { address: "9 Rue de la Gare", city: "Montreuil", postalCode: "93100" },
  { address: "6 Avenue Jean Jaurès", city: "Saint-Denis", postalCode: "93200" },
  { address: "11 Rue de la Paix", city: "Neuilly-sur-Seine", postalCode: "92200" },
];

const PICKUP_ADDRESSES = [
  { address: "2 Rue du Louvre", city: "Paris", postalCode: "75001" },
  { address: "30 Rue de la Boétie", city: "Paris", postalCode: "75008" },
  { address: "15 Rue Oberkampf", city: "Paris", postalCode: "75011" },
  { address: "4 Place d'Italie", city: "Paris", postalCode: "75013" },
  { address: "10 Rue de la Convention", city: "Paris", postalCode: "75015" },
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function pickN<T>(arr: T[], n: number): T[] {
  const copy = [...arr];
  const result: T[] = [];
  for (let i = 0; i < n && copy.length > 0; i++) {
    const idx = Math.floor(Math.random() * copy.length);
    result.push(copy.splice(idx, 1)[0]!);
  }
  return result;
}

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomDeliveryDate(): string {
  const days = randomInt(1, 7);
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(randomInt(9, 18), randomInt(0, 3) * 15, 0, 0);
  return d.toISOString();
}

function buildStandardOrder(): CreateClientOrderInput {
  const dest = pick(PARIS_ADDRESSES);
  const itemCount = randomInt(1, 3);
  const items = pickN(STANDARD_ITEMS, itemCount).map((name) => ({
    name,
    quantity: randomInt(1, 4),
    estimatedPrice: randomInt(5, 80),
  }));

  return {
    deliveryCategory: "STANDARD",
    items,
    stops: undefined,
    pickupStops: undefined,
    shippingAddress: dest.address,
    shippingCity: dest.city,
    shippingPostalCode: dest.postalCode,
    deliveryInstructions: Math.random() > 0.6 ? "Sonner à l'interphone" : undefined,
    requestedDeliveryDate: randomDeliveryDate(),
    notes: Math.random() > 0.7 ? "Commande test auto-dispatch" : undefined,
  };
}

function buildCourierOrder(): CreateClientOrderInput {
  const pickup = pick(PICKUP_ADDRESSES);
  const dest = pick(PARIS_ADDRESSES);
  const mission = pick(COURIER_MISSIONS);

  return {
    deliveryCategory: "COURIER",
    items: [{ name: mission, quantity: 1, estimatedPrice: randomInt(15, 60) }],
    stops: undefined,
    pickupStops: undefined,
    pickupAddress: pickup.address,
    pickupCity: pickup.city,
    pickupPostalCode: pickup.postalCode,
    pickupInstructions: Math.random() > 0.5 ? "Demander à l'accueil" : undefined,
    shippingAddress: dest.address,
    shippingCity: dest.city,
    shippingPostalCode: dest.postalCode,
    deliveryInstructions: Math.random() > 0.5 ? "Livraison en main propre" : undefined,
    requestedDeliveryDate: randomDeliveryDate(),
    notes: "Course test auto-dispatch",
  };
}

function buildRandomOrder(): CreateClientOrderInput {
  return Math.random() < 0.35 ? buildCourierOrder() : buildStandardOrder();
}

async function resolveCompanyId(): Promise<string> {
  const preferredAdminEmail = process.env.SEED_COMPANY_ADMIN_EMAIL?.trim();
  const admin = preferredAdminEmail
    ? await prisma.user.findFirst({
        where: { email: preferredAdminEmail, companyId: { not: null } },
        select: { companyId: true },
      })
    : null;
  if (admin?.companyId) return admin.companyId;

  const company = await prisma.company.findFirst({
    where: { status: { in: ["ACTIVE", "TRIAL"] } },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (!company) throw new Error("Aucune entreprise trouvée");
  return company.id;
}

async function main() {
  const count = Math.max(1, Number(process.argv[2]) || 12);

  console.log(`🎲 Génération de ${count} commande(s) / course(s) aléatoires...\n`);

  const companyId = await resolveCompanyId();
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { name: true },
  });

  const clients = await prisma.user.findMany({
    where: {
      companyId,
      status: "ACTIVE",
      role: { systemRole: "CLIENT" },
    },
    select: { id: true, email: true, firstName: true, lastName: true },
    orderBy: { email: "asc" },
  });

  if (clients.length === 0) {
    throw new Error("Aucun client trouvé — lancez npm run db:seed-test-accounts");
  }

  console.log(`Entreprise : ${company?.name ?? companyId}`);
  console.log(`Clients disponibles : ${clients.length}\n`);

  const results: { ref: string; type: string; client: string; assigned: boolean; driver?: string }[] = [];

  for (let i = 0; i < count; i++) {
    const client = pick(clients);
    const input = buildRandomOrder();

    const order = await createClientOrder(client.id, companyId, client.email, input);

    const delivery = await prisma.delivery.findFirst({
      where: { orderId: order.id },
      select: {
        reference: true,
        status: true,
        driverName: true,
        driverId: true,
        deliveryCategory: true,
      },
    });

    const assigned = !!delivery?.driverId;
    const label = `${order.reference} (${input.deliveryCategory === "COURIER" ? "Course" : "Commande"})`;
    const clientName = `${client.firstName} ${client.lastName}`;

    results.push({
      ref: order.reference,
      type: input.deliveryCategory,
      client: clientName,
      assigned,
      driver: delivery?.driverName ?? undefined,
    });

    console.log(
      `  ${assigned ? "✅" : "⏳"} ${label} — ${clientName}${assigned ? ` → ${delivery?.driverName}` : " (non assignée)"}`
    );

    await new Promise((r) => setTimeout(r, 150));
  }

  const assignedCount = results.filter((r) => r.assigned).length;
  const courierCount = results.filter((r) => r.type === "COURIER").length;

  console.log("\n────────────────────────────────────────");
  console.log(`Total : ${count} | Assignées : ${assignedCount} | Courses : ${courierCount}`);
  if (assignedCount < count) {
    console.log("ℹ️  Les non-assignées : vérifiez que l'auto-dispatch est activé dans Paramètres.");
  }
  console.log("────────────────────────────────────────\n");
  console.log("✅ Terminé — consultez /dispatch pour voir la file");
}

main()
  .catch((error) => {
    console.error("❌ Erreur:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
