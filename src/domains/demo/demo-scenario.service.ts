import { prisma } from "@/services/prisma/client";
import type {
  DeliveryCategory,
  DeliveryStatus,
  InvoiceStatus,
  OrderStatus,
  Prisma,
} from "@prisma/client";
import { attachRolesById } from "@/domains/user/user.service";
import {
  demoKeepEmails,
  demoRosterAuthIds,
  ensureDemoRosterUsers,
} from "@/domains/demo/demo-users.service";
import {
  DEMO_FIXTURE_CLIENTS,
  DEMO_FIXTURE_DRIVERS,
  DEMO_SCENARIO_VERSION,
} from "@/lib/demo/constants";
import { createAdminClient } from "@/services/supabase/admin";
import { formatDriverDisplayName } from "@/lib/format/person-labels";
import {
  generateDeliveryReference,
  generateOrderReference,
} from "@/lib/order-reference";
import { getPrimaryCourierPickupFields } from "@/lib/order/courier-pickups";
import { demoInvoiceLineItems } from "@/domains/demo/demo-invoice-lines";

interface DemoActors {
  companyId: string;
  clientId: string;
  clientEmail: string;
  driverId: string;
  driverName: string;
}

interface TrackingSeed {
  label: string;
  description?: string;
  latitude?: number;
  longitude?: number;
  offsetHours: number;
}

interface ScenarioItem {
  label: string;
  /** Livreur imposé (index dans DEMO_FIXTURE_DRIVERS) ; sinon rotation. */
  driverIndex?: number;
  deliveryCategory: DeliveryCategory;
  orderStatus: OrderStatus;
  deliveryStatus: DeliveryStatus;
  assignDriver: boolean;
  requestedDeliveryDateOffsetHours: number;
  scheduledAtOffsetHours?: number;
  completedAtOffsetHours?: number;
  estimatedArrivalOffsetHours?: number;
  missionStartedAtOffsetHours?: number;
  shipping: { address: string; city: string; postalCode: string };
  pickup?: { address: string; city: string; postalCode: string };
  pickupStops?: Array<{
    label: string;
    address: string;
    city: string;
    postalCode: string;
    items: Array<{ name: string; quantity: number; unitPrice: number }>;
  }>;
  items?: Array<{ name: string; quantity: number; unitPrice: number }>;
  notes?: string;
  deliveryInstructions?: string;
  tracking: TrackingSeed[];
  invoice?: { status: InvoiceStatus; dueInDays?: number; paidDaysAgo?: number };
  supportTicket?: { subject: string; message: string };
}

type Coordinates = { latitude: number; longitude: number };

/**
 * Coordonnées fixes des adresses de démo, relevées sur la Base Adresse Nationale : la carte
 * n'attend pas le géocodage en ligne, qui peut échouer ou expirer. Clé : « adresse|code postal ».
 */
const DEMO_ADDRESS_COORDINATES: Record<string, Coordinates> = {
  "12 Rue de Rivoli|75001": { latitude: 48.86244, longitude: 2.3362 },
  "45 Avenue des Champs-Élysées|75008": { latitude: 48.87105, longitude: 2.30373 },
  "8 Boulevard Haussmann|75009": { latitude: 48.87234, longitude: 2.33864 },
  "22 Rue de la Roquette|75011": { latitude: 48.85399, longitude: 2.37112 },
  "5 Place de la Bastille|75012": { latitude: 48.85277, longitude: 2.36994 },
  "18 Rue de Vaugirard|75015": { latitude: 48.83956, longitude: 2.30316 },
  "2 Rue du Louvre|75001": { latitude: 48.86285, longitude: 2.34182 },
  "14 Avenue de Versailles|75016": { latitude: 48.85073, longitude: 2.27713 },
  "27 Rue de Lévis|75017": { latitude: 48.88243, longitude: 2.31516 },
  "30 Rue de la Boétie|75008": { latitude: 48.87393, longitude: 2.31534 },
  "120 Rue de la Convention|75015": { latitude: 48.84052, longitude: 2.28939 },
  "20 Boulevard Diderot|75012": { latitude: 48.84552, longitude: 2.37208 },
  "15 Rue des Martyrs|75009": { latitude: 48.87784, longitude: 2.33942 },
  "8 Place de la Nation|75011": { latitude: 48.84911, longitude: 2.39636 },
  "25 Rue de Passy|75016": { latitude: 48.85803, longitude: 2.28223 },
  "12 Rue Lepic|75018": { latitude: 48.88448, longitude: 2.33353 },
  "50 Rue de Belleville|75020": { latitude: 48.87311, longitude: 2.38148 },
  "18 Rue Mouffetard|75005": { latitude: 48.84434, longitude: 2.34923 },
  "15 Rue Oberkampf|75011": { latitude: 48.8633, longitude: 2.36878 },
  "4 Place d'Italie|75013": { latitude: 48.83204, longitude: 2.35459 },
};

function demoCoordinates(place: { address: string; postalCode: string } | undefined): Coordinates | null {
  return place ? DEMO_ADDRESS_COORDINATES[`${place.address}|${place.postalCode}`] ?? null : null;
}

function hoursFromNow(hours: number, referenceDate: Date = new Date()): Date {
  return new Date(referenceDate.getTime() + hours * 60 * 60 * 1000);
}

function buildScenario(): ScenarioItem[] {
  return [
    {
      label: "Livrée + facture payée",
      driverIndex: 0,
      deliveryCategory: "STANDARD",
      orderStatus: "DELIVERED",
      deliveryStatus: "DELIVERED",
      assignDriver: true,
      requestedDeliveryDateOffsetHours: -72,
      completedAtOffsetHours: -24,
      shipping: {
        address: "12 Rue de Rivoli",
        city: "Paris",
        postalCode: "75001",
      },
      items: [
        { name: "Colis documents", quantity: 2, unitPrice: 29.95 },
        { name: "Emballage fragile", quantity: 1, unitPrice: 30.0 },
      ],
      notes: "Livraison démo — historique client",
      tracking: [
        { label: "Commande reçue", offsetHours: -72 },
        { label: "En préparation", offsetHours: -48 },
        { label: "En livraison", offsetHours: -30, latitude: 48.8566, longitude: 2.3522 },
        {
          label: "Livré",
          description: "Colis remis au destinataire",
          offsetHours: -24,
          latitude: 48.8566,
          longitude: 2.3522,
        },
      ],
      invoice: { status: "PAID", paidDaysAgo: 2 },
    },
    {
      label: "En livraison (suivi actif)",
      driverIndex: 0,
      deliveryCategory: "STANDARD",
      orderStatus: "IN_DELIVERY",
      deliveryStatus: "IN_DELIVERY",
      assignDriver: true,
      requestedDeliveryDateOffsetHours: -4,
      estimatedArrivalOffsetHours: 2,
      missionStartedAtOffsetHours: -1,
      shipping: {
        address: "45 Avenue des Champs-Élysées",
        city: "Paris",
        postalCode: "75008",
      },
      items: [{ name: "Livraison express", quantity: 1, unitPrice: 45.0 }],
      deliveryInstructions: "Sonner à l'interphone — 3e étage",
      tracking: [
        { label: "Commande reçue", offsetHours: -6 },
        { label: "Assignée", description: "Chauffeur affecté", offsetHours: -3 },
        {
          label: "En livraison",
          description: "Le chauffeur est en route",
          offsetHours: -1,
          latitude: 48.8698,
          longitude: 2.3078,
        },
      ],
      invoice: { status: "PENDING", dueInDays: 15 },
      supportTicket: {
        subject: "Question sur l'heure de livraison",
        message:
          "Bonjour, pouvez-vous me confirmer l'heure estimée d'arrivée du chauffeur ? Merci.",
      },
    },
    {
      label: "En attente dispatch",
      deliveryCategory: "STANDARD",
      orderStatus: "PENDING",
      deliveryStatus: "PENDING",
      assignDriver: false,
      requestedDeliveryDateOffsetHours: 24,
      scheduledAtOffsetHours: 24,
      shipping: {
        address: "8 Boulevard Haussmann",
        city: "Paris",
        postalCode: "75009",
      },
      items: [{ name: "Carton 5 kg", quantity: 1, unitPrice: 38.5 }],
      tracking: [
        {
          label: "Commande reçue",
          description: "En attente d'assignation chauffeur",
          offsetHours: -2,
        },
      ],
    },
    {
      label: "En retard",
      deliveryCategory: "STANDARD",
      orderStatus: "PENDING",
      deliveryStatus: "PENDING",
      assignDriver: false,
      requestedDeliveryDateOffsetHours: -48,
      scheduledAtOffsetHours: -48,
      shipping: {
        address: "22 Rue de la Roquette",
        city: "Paris",
        postalCode: "75011",
      },
      items: [{ name: "Pièces détachées", quantity: 1, unitPrice: 62.0 }],
      notes: "Date demandée dépassée — priorité dispatch",
      tracking: [
        { label: "Commande reçue", offsetHours: -72 },
        { label: "En attente chauffeur", description: "Retard sur la date prévue", offsetHours: -24 },
      ],
    },
    {
      label: "Planifiée à venir",
      deliveryCategory: "STANDARD",
      orderStatus: "PENDING",
      deliveryStatus: "PENDING",
      assignDriver: false,
      requestedDeliveryDateOffsetHours: 48,
      scheduledAtOffsetHours: 48,
      shipping: {
        address: "5 Place de la Bastille",
        city: "Paris",
        postalCode: "75012",
      },
      items: [{ name: "Fournitures bureau", quantity: 3, unitPrice: 18.0 }],
      tracking: [{ label: "Commande reçue", description: "Livraison planifiée", offsetHours: -1 }],
    },
    {
      label: "Course simple — en achat",
      driverIndex: 1,
      deliveryCategory: "COURIER",
      orderStatus: "PURCHASING",
      deliveryStatus: "PURCHASING",
      assignDriver: true,
      requestedDeliveryDateOffsetHours: 4,
      estimatedArrivalOffsetHours: 6,
      missionStartedAtOffsetHours: -1,
      pickup: {
        address: "2 Rue du Louvre",
        city: "Paris",
        postalCode: "75001",
      },
      shipping: {
        address: "18 Rue de Vaugirard",
        city: "Paris",
        postalCode: "75015",
      },
      pickupStops: [
        {
          label: "Collecte pharmacie",
          address: "2 Rue du Louvre",
          city: "Paris",
          postalCode: "75001",
          items: [{ name: "Ordonnance urgente", quantity: 1, unitPrice: 25.0 }],
        },
      ],
      deliveryInstructions: "Livraison en main propre",
      tracking: [
        { label: "Course reçue", offsetHours: -3 },
        { label: "Chauffeur en route collecte", offsetHours: -1, latitude: 48.8606, longitude: 2.3376 },
        { label: "En cours d'achat", description: "Récupération en cours", offsetHours: 0 },
      ],
    },
    {
      label: "Course — collectes multiples",
      driverIndex: 0,
      deliveryCategory: "COURIER",
      orderStatus: "ASSIGNED",
      deliveryStatus: "ASSIGNED",
      assignDriver: true,
      requestedDeliveryDateOffsetHours: 8,
      estimatedArrivalOffsetHours: 10,
      shipping: {
        address: "14 Avenue de Versailles",
        city: "Paris",
        postalCode: "75016",
      },
      pickupStops: [
        {
          label: "Collecte 1 — Imprimerie",
          address: "30 Rue de la Boétie",
          city: "Paris",
          postalCode: "75008",
          items: [{ name: "Documents à signer", quantity: 1, unitPrice: 0 }],
        },
        {
          label: "Collecte 2 — Showroom",
          address: "15 Rue Oberkampf",
          city: "Paris",
          postalCode: "75011",
          items: [{ name: "Échantillons produits", quantity: 2, unitPrice: 35.0 }],
        },
        {
          label: "Collecte 3 — Entrepôt",
          address: "4 Place d'Italie",
          city: "Paris",
          postalCode: "75013",
          items: [{ name: "Petit colis", quantity: 1, unitPrice: 12.0 }],
        },
      ],
      notes: "Course multi-points démo",
      tracking: [
        { label: "Course reçue", offsetHours: -2 },
        { label: "Collecte 1", description: "30 Rue de la Boétie, Paris", offsetHours: -1 },
        { label: "Collecte 2", description: "15 Rue Oberkampf, Paris", offsetHours: 0 },
        { label: "Collecte 3", description: "4 Place d'Italie, Paris", offsetHours: 0 },
        {
          label: "Livraison",
          description: "14 Avenue de Versailles, Paris",
          offsetHours: 0,
        },
      ],
    },
    {
      label: "Commande multi-articles",
      driverIndex: 1,
      deliveryCategory: "STANDARD",
      orderStatus: "ASSIGNED",
      deliveryStatus: "ASSIGNED",
      assignDriver: true,
      requestedDeliveryDateOffsetHours: 12,
      estimatedArrivalOffsetHours: 14,
      shipping: {
        address: "27 Rue de Lévis",
        city: "Paris",
        postalCode: "75017",
      },
      items: [
        { name: "Matériel informatique", quantity: 1, unitPrice: 120.0 },
        { name: "Câbles réseau", quantity: 4, unitPrice: 15.0 },
        { name: "Écran 24 pouces", quantity: 1, unitPrice: 189.0 },
        { name: "Souris sans fil", quantity: 2, unitPrice: 25.0 },
        { name: "Clavier mécanique", quantity: 1, unitPrice: 89.0 },
      ],
      deliveryInstructions: "Accès parking livraison — badge à l'accueil",
      tracking: [
        { label: "Commande reçue", offsetHours: -4 },
        { label: "Assignée au chauffeur", offsetHours: -2 },
      ],
    },
    // Carte « suivi en direct » : plusieurs livreurs en route, toutes les missions à Paris.
    {
      label: "En route — Convention",
      driverIndex: 3,
      deliveryCategory: "STANDARD",
      orderStatus: "IN_DELIVERY",
      deliveryStatus: "IN_DELIVERY",
      assignDriver: true,
      requestedDeliveryDateOffsetHours: 3,
      estimatedArrivalOffsetHours: 1,
      missionStartedAtOffsetHours: -0.4,
      shipping: { address: "120 Rue de la Convention", city: "Paris", postalCode: "75015" },
      items: [{ name: "Matériel événementiel", quantity: 3, unitPrice: 42.0 }],
      tracking: [
        { label: "Commande reçue", offsetHours: -3 },
        { label: "En livraison", description: "Le chauffeur est en route", offsetHours: -0.4 },
      ],
    },
    {
      label: "Course en route — Gare de Lyon",
      driverIndex: 2,
      deliveryCategory: "COURIER",
      orderStatus: "IN_DELIVERY",
      deliveryStatus: "IN_DELIVERY",
      assignDriver: true,
      requestedDeliveryDateOffsetHours: 2,
      estimatedArrivalOffsetHours: 1,
      missionStartedAtOffsetHours: -0.6,
      shipping: { address: "15 Rue des Martyrs", city: "Paris", postalCode: "75009" },
      pickupStops: [
        {
          label: "Collecte — Gare de Lyon",
          address: "20 Boulevard Diderot",
          city: "Paris",
          postalCode: "75012",
          items: [{ name: "Pli urgent", quantity: 1, unitPrice: 18.0 }],
        },
      ],
      tracking: [
        { label: "Course reçue", offsetHours: -2 },
        { label: "En livraison", description: "Collecte faite, en route", offsetHours: -0.3 },
      ],
    },
    {
      label: "En route — Nation",
      driverIndex: 4,
      deliveryCategory: "STANDARD",
      orderStatus: "IN_DELIVERY",
      deliveryStatus: "IN_DELIVERY",
      assignDriver: true,
      requestedDeliveryDateOffsetHours: 4,
      estimatedArrivalOffsetHours: 1,
      missionStartedAtOffsetHours: -0.5,
      shipping: { address: "8 Place de la Nation", city: "Paris", postalCode: "75011" },
      items: [{ name: "Palette textile", quantity: 1, unitPrice: 95.0 }],
      tracking: [
        { label: "Commande reçue", offsetHours: -5 },
        { label: "En livraison", description: "Départ de l'entrepôt", offsetHours: -0.5 },
      ],
    },
    {
      label: "Assignée en retard",
      driverIndex: 1,
      deliveryCategory: "STANDARD",
      orderStatus: "ASSIGNED",
      deliveryStatus: "ASSIGNED",
      assignDriver: true,
      requestedDeliveryDateOffsetHours: -3,
      estimatedArrivalOffsetHours: 1,
      shipping: { address: "25 Rue de Passy", city: "Paris", postalCode: "75016" },
      items: [{ name: "Dossier juridique", quantity: 1, unitPrice: 35.0 }],
      notes: "Créneau dépassé — mission pas encore démarrée",
      tracking: [
        { label: "Commande reçue", offsetHours: -8 },
        { label: "Assignée au chauffeur", offsetHours: -5 },
      ],
    },
    {
      label: "Sans livreur — Montmartre",
      deliveryCategory: "STANDARD",
      orderStatus: "PENDING",
      deliveryStatus: "PENDING",
      assignDriver: false,
      requestedDeliveryDateOffsetHours: 3,
      scheduledAtOffsetHours: 3,
      shipping: { address: "12 Rue Lepic", city: "Paris", postalCode: "75018" },
      items: [{ name: "Fleurs — commande boutique", quantity: 2, unitPrice: 28.0 }],
      tracking: [{ label: "Commande reçue", description: "En attente d'assignation chauffeur", offsetHours: -1 }],
    },
    {
      label: "Sans livreur — Belleville",
      deliveryCategory: "STANDARD",
      orderStatus: "PENDING",
      deliveryStatus: "PENDING",
      assignDriver: false,
      requestedDeliveryDateOffsetHours: 6,
      scheduledAtOffsetHours: 6,
      shipping: { address: "50 Rue de Belleville", city: "Paris", postalCode: "75020" },
      items: [{ name: "Colis boutique", quantity: 4, unitPrice: 22.0 }],
      tracking: [{ label: "Commande reçue", offsetHours: -2 }],
    },
    {
      label: "À démarrer — Mouffetard",
      driverIndex: 3,
      deliveryCategory: "STANDARD",
      orderStatus: "ASSIGNED",
      deliveryStatus: "ASSIGNED",
      assignDriver: true,
      requestedDeliveryDateOffsetHours: 5,
      estimatedArrivalOffsetHours: 5,
      shipping: { address: "18 Rue Mouffetard", city: "Paris", postalCode: "75005" },
      items: [{ name: "Fournitures médicales", quantity: 2, unitPrice: 54.0 }],
      tracking: [
        { label: "Commande reçue", offsetHours: -2 },
        { label: "Assignée au chauffeur", offsetHours: -1 },
      ],
    },
  ];
}

const CLIENT_ADDRESS_SEEDS = [
  [
    {
      label: "Siège",
      address: "12 Rue de Rivoli",
      city: "Paris",
      postalCode: "75001",
    },
    {
      label: "Entrepôt",
      address: "9 Rue de l'Ourcq",
      city: "Paris",
      postalCode: "75019",
    },
  ],
  [
    {
      label: "Bureau",
      address: "45 Avenue des Champs-Élysées",
      city: "Paris",
      postalCode: "75008",
    },
  ],
  [
    {
      label: "Boutique",
      address: "8 Boulevard Haussmann",
      city: "Paris",
      postalCode: "75009",
    },
  ],
  [
    {
      label: "Atelier",
      address: "22 Rue de la Roquette",
      city: "Paris",
      postalCode: "75011",
    },
  ],
  [
    {
      label: "Agence",
      address: "27 Rue de Lévis",
      city: "Paris",
      postalCode: "75017",
    },
  ],
] as const;

const DRIVER_LOCATION_SEEDS = [
  { latitude: 48.8698, longitude: 2.3078 },
  { latitude: 48.8532, longitude: 2.3691 },
  { latitude: 48.8443, longitude: 2.3744 },
  { latitude: 48.8467, longitude: 2.3016 },
  { latitude: 48.8566, longitude: 2.3897 },
] as const;

async function applyDemoDispatchDrivers(companyId: string, driverIds: string[]) {
  if (driverIds.length === 0) return;

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { settings: true },
  });
  const settings =
    company?.settings && typeof company.settings === "object"
      ? { ...(company.settings as Record<string, unknown>) }
      : {};
  const previousDispatch =
    settings.dispatchRules && typeof settings.dispatchRules === "object"
      ? { ...(settings.dispatchRules as Record<string, unknown>) }
      : {};

  settings.dispatchRules = {
    ...previousDispatch,
    enabled: true,
    defaultDriverId: driverIds[0],
    driverRules: driverIds.map((driverId, index) => ({
      driverId,
      priority: index + 1,
      allowedCategories: {
        STANDARD: true,
        COURIER: true,
        SPECIAL_MISSION: false,
      },
      zoneIds: [],
      postalCodePrefixes: ["75", "92", "93", "94"],
      dispatchStatus: "ACTIVE",
    })),
  };

  await prisma.company.update({
    where: { id: companyId },
    data: { settings: settings as Prisma.InputJsonValue },
  });
}

async function ensureDemoClientAddresses(
  clients: Array<{ id: string }>
) {
  await Promise.all(clients.map(async (client, index) => {
    const seeds = CLIENT_ADDRESS_SEEDS[index] ?? CLIENT_ADDRESS_SEEDS[0];
    const addressCount = await prisma.customerAddress.count({
      where: { userId: client.id },
    });
    if (addressCount > 0) return;

    await prisma.customerAddress.createMany({
      data: seeds.map((seed, seedIndex) => ({
        userId: client.id,
        label: seed.label,
        address: seed.address,
        city: seed.city,
        postalCode: seed.postalCode,
        isDefault: seedIndex === 0,
      })),
    });
  }));
}

async function ensureDemoDriverLocations(drivers: Array<{ id: string }>) {
  await Promise.all(drivers.map(async (driver, index) => {
    const coords = DRIVER_LOCATION_SEEDS[index] ?? DRIVER_LOCATION_SEEDS[0];
    await prisma.driverLocation.upsert({
      where: { driverId: driver.id },
      create: {
        driverId: driver.id,
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracy: 12,
      },
      update: {
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracy: 12,
      },
    });
  }));
}

async function purgeDemoTransactionalData(companyId: string) {
  const drivers = await prisma.user.findMany({
    where: { companyId, role: { systemRole: "DRIVER" } },
    select: { id: true },
  });
  const driverIds = drivers.map((d) => d.id);

  await prisma.$transaction([
    // Les tâches terminées ou échouées appartiennent au scénario précédent.
    // Les tâches actives sont bloquées en amont par le worker DEMO-2.
    prisma.operationJob.deleteMany({
      where: { companyId, status: { in: ["SUCCEEDED", "FAILED"] } },
    }),
    prisma.supportTicket.deleteMany({ where: { companyId } }),
    prisma.invoice.deleteMany({ where: { companyId } }),
    ...(driverIds.length > 0
      ? [prisma.driverLocation.deleteMany({ where: { driverId: { in: driverIds } } })]
      : []),
    prisma.order.deleteMany({ where: { companyId } }),
  ]);
}

/** Comptes créés pendant la démo (mini-admin, etc.) — le roster figé reste. */
async function purgeDemoExtraAccounts(companyId: string) {
  const keep = new Set(demoKeepEmails());
  const keepAuthIds = new Set(demoRosterAuthIds(companyId));
  const extras = (
    await prisma.user.findMany({
      where: { companyId },
      select: { id: true, authId: true, email: true },
    })
  ).filter(
    (user) =>
      !keep.has(user.email.toLowerCase()) && !keepAuthIds.has(user.authId)
  );

  if (extras.length === 0) return;

  const supabase = createAdminClient();
  // Supprimer Auth avant la ligne locale évite de perdre la trace d'un compte
  // externe si le fournisseur est indisponible au milieu du recyclage.
  for (const user of extras.filter((candidate) => !candidate.authId.startsWith("demo-persona-"))) {
    const { error } = await supabase.auth.admin.deleteUser(user.authId);
    if (error && error.status !== 404) {
      throw new Error("DEMO_AUTH_CLEANUP_FAILED");
    }
  }

  await prisma.user.deleteMany({
    where: { id: { in: extras.map((user) => user.id) } },
  });
}

async function ensureRecurringOrder(
  actors: DemoActors,
  referenceDate: Date = new Date(),
  label = "Livraison hebdomadaire fournitures"
) {
  const existing = await prisma.recurringOrder.findFirst({
    where: { companyId: actors.companyId, customerId: actors.clientId },
  });

  const payload = {
    label,
    frequency: "WEEKLY" as const,
    intervalValue: 1,
    intervalUnit: "WEEKS" as const,
    status: "ACTIVE" as const,
    startAt: hoursFromNow(-168, referenceDate),
    nextRunAt: hoursFromNow(120, referenceDate),
    deliveryCategory: "STANDARD" as const,
    shippingAddress: "11 Rue de la Paix",
    shippingCity: "Neuilly-sur-Seine",
    shippingPostalCode: "92200",
    deliveryInstructions: "Déposer au bureau — étage 2",
    notes: "Commande récurrente démo",
    items: [{ name: "Pack fournitures", quantity: 1, estimatedPrice: 55 }],
  };

  if (existing) {
    await prisma.recurringOrder.update({
      where: { id: existing.id },
      data: payload,
    });
    return existing.id;
  }

  const created = await prisma.recurringOrder.create({
    data: {
      ...payload,
      companyId: actors.companyId,
      customerId: actors.clientId,
    },
  });
  return created.id;
}

async function createScenarioDelivery(
  actors: DemoActors,
  scenario: ScenarioItem,
  referenceDate: Date = new Date()
): Promise<{ orderId: string; deliveryId: string }> {
  const isCourier = scenario.deliveryCategory === "COURIER";
  const pickupStops = scenario.pickupStops ?? [];
  const firstPickup = pickupStops[0] ?? scenario.pickup;

  const items = scenario.items ?? [];
  const courierItems = pickupStops.flatMap((stop) => stop.items);
  const totalAmount = isCourier
    ? courierItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
    : items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const itemCount = isCourier
    ? courierItems.reduce((sum, item) => sum + item.quantity, 0)
    : items.reduce((sum, item) => sum + item.quantity, 0);

  const [orderReference, deliveryReference] = await Promise.all([
    generateOrderReference(scenario.deliveryCategory),
    generateDeliveryReference(),
  ]);
  const primaryPickup = isCourier
    ? getPrimaryCourierPickupFields(
        pickupStops.map((stop) => ({
          address: stop.address,
          city: stop.city,
          postalCode: stop.postalCode,
          label: stop.label,
        }))
      )
    : null;

  const destinationCoordinates = demoCoordinates(scenario.shipping);
  const pickupCoordinates = isCourier ? demoCoordinates(firstPickup) : null;

  return prisma.$transaction(async (tx) => {
    const order = await tx.order.create({
      data: {
        reference: orderReference,
        status: scenario.orderStatus,
        source: "CLIENT",
        totalAmount,
        itemCount: Math.max(itemCount, 1),
        notes: scenario.notes ?? null,
        deliveryCategory: scenario.deliveryCategory,
        pickupAddress: isCourier ? (primaryPickup?.pickupAddress ?? firstPickup?.address ?? null) : null,
        pickupCity: isCourier ? (primaryPickup?.pickupCity ?? firstPickup?.city ?? null) : null,
        pickupPostalCode: isCourier
          ? (primaryPickup?.pickupPostalCode ?? firstPickup?.postalCode ?? null)
          : null,
        shippingAddress: scenario.shipping.address,
        shippingCity: scenario.shipping.city,
        shippingPostalCode: scenario.shipping.postalCode,
        deliveryInstructions: scenario.deliveryInstructions ?? null,
        requestedDeliveryDate: hoursFromNow(scenario.requestedDeliveryDateOffsetHours, referenceDate),
        companyId: actors.companyId,
        customerId: actors.clientId,
        customerEmail: actors.clientEmail,
        items: !isCourier
          ? {
            create: items.map((item) => ({
              name: item.name,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
            })),
          }
          : undefined,
        stops:
          isCourier && pickupStops.length > 0
            ? {
              create: pickupStops.map((stop, index) => ({
                sequence: index,
                label: stop.label,
                address: stop.address,
                city: stop.city,
                postalCode: stop.postalCode,
              })),
            }
            : undefined,
      },
      include: {
        stops: { orderBy: { sequence: "asc" } },
      },
    });

    if (isCourier && pickupStops.length > 0 && order.stops.length > 0) {
      const itemRows = order.stops.flatMap((stop) => {
        const stopInput = pickupStops[stop.sequence];
        return (stopInput?.items ?? []).map((item) => ({
          orderId: order.id,
          orderStopId: stop.id,
          name: item.name,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        }));
      });
      if (itemRows.length > 0) {
        await tx.orderItem.createMany({ data: itemRows });
      }
    }

    const delivery = await tx.delivery.create({
      data: {
        reference: deliveryReference,
        status: scenario.deliveryStatus,
        deliveryCategory: scenario.deliveryCategory,
        pickupAddress: isCourier ? (primaryPickup?.pickupAddress ?? null) : null,
        pickupCity: isCourier ? (primaryPickup?.pickupCity ?? null) : null,
        pickupPostalCode: isCourier ? (primaryPickup?.pickupPostalCode ?? null) : null,
        address: scenario.shipping.address,
        city: scenario.shipping.city,
        postalCode: scenario.shipping.postalCode,
        latitude: destinationCoordinates?.latitude ?? null,
        longitude: destinationCoordinates?.longitude ?? null,
        pickupLatitude: pickupCoordinates?.latitude ?? null,
        pickupLongitude: pickupCoordinates?.longitude ?? null,
        driverId: scenario.assignDriver ? actors.driverId : null,
        driverName: scenario.assignDriver
          ? formatDriverDisplayName(actors.driverName)
          : null,
        companyId: actors.companyId,
        orderId: order.id,
        customerId: actors.clientId,
        scheduledAt:
          scenario.scheduledAtOffsetHours != null
            ? hoursFromNow(scenario.scheduledAtOffsetHours, referenceDate)
            : hoursFromNow(scenario.requestedDeliveryDateOffsetHours, referenceDate),
        estimatedArrival:
          scenario.estimatedArrivalOffsetHours != null
            ? hoursFromNow(scenario.estimatedArrivalOffsetHours, referenceDate)
            : null,
        completedAt:
          scenario.completedAtOffsetHours != null
            ? hoursFromNow(scenario.completedAtOffsetHours, referenceDate)
            : null,
        missionStartedAt:
          scenario.missionStartedAtOffsetHours != null
            ? hoursFromNow(scenario.missionStartedAtOffsetHours, referenceDate)
            : null,
        trackingEvents: {
          create: scenario.tracking.map((event) => ({
            label: event.label,
            description: event.description ?? null,
            latitude: event.latitude ?? null,
            longitude: event.longitude ?? null,
            occurredAt: hoursFromNow(event.offsetHours, referenceDate),
          })),
        },
      },
    });

    if (scenario.invoice) {
      // Full delivery ref keeps global uniqueness (slice(-6) can collide).
      const invoiceRef = `FAC-DEMO-${deliveryReference.replace(/^LIV-/, "")}`;
      await tx.invoice.create({
        data: {
          reference: invoiceRef,
          status: scenario.invoice.status,
          amount: totalAmount,
          lineItems: demoInvoiceLineItems(items.length ? items : courierItems),
          companyId: actors.companyId,
          orderId: order.id,
          customerId: actors.clientId,
          dueDate: scenario.invoice.dueInDays
            ? hoursFromNow(scenario.invoice.dueInDays * 24, referenceDate)
            : null,
          paidAt: scenario.invoice.paidDaysAgo
            ? hoursFromNow(-scenario.invoice.paidDaysAgo * 24, referenceDate)
            : null,
        },
      });
    }

    if (scenario.supportTicket) {
      await tx.supportTicket.create({
        data: {
          subject: scenario.supportTicket.subject,
          message: scenario.supportTicket.message,
          status: "OPEN",
          priority: "NORMAL",
          contactType: "ADMIN",
          companyId: actors.companyId,
          customerId: actors.clientId,
          relatedOrderId: order.id,
          relatedDeliveryId: delivery.id,
          messages: {
            create: {
              body: scenario.supportTicket.message,
              isStaff: false,
              authorId: actors.clientId,
            },
          },
        },
      });
    }

    return { orderId: order.id, deliveryId: delivery.id };
  }, { maxWait: 10_000, timeout: 60_000 });
}

export async function resetDemoScenario(
  companyId: string,
  referenceDate: Date = new Date(),
  options: { ensureCanonicalRoster?: boolean } = {}
): Promise<{ deliveries: number }> {
  await purgeDemoTransactionalData(companyId);
  await purgeDemoExtraAccounts(companyId);
  if (options.ensureCanonicalRoster !== false) {
    await ensureDemoRosterUsers(companyId);
  }

  const roster = await attachRolesById(
    await prisma.user.findMany({ where: { companyId } })
  );

  const clients = DEMO_FIXTURE_CLIENTS.map((_, index) =>
    roster.find(
      (user) =>
        user.authId ===
        demoRosterAuthIds(companyId)[index + 1]
    )
  ).filter((user): user is NonNullable<typeof user> => Boolean(user));
  const drivers = DEMO_FIXTURE_DRIVERS.map((_, index) =>
    roster.find(
      (user) =>
        user.authId ===
        demoRosterAuthIds(companyId)[DEMO_FIXTURE_CLIENTS.length + 1 + index]
    )
  ).filter((user): user is NonNullable<typeof user> => Boolean(user));

  const firstClient = clients[0];
  const firstDriver = drivers[0];
  const secondClient = clients[1];
  if (!firstClient || !firstDriver) {
    throw new Error("DEMO_PERSONAS_MISSING");
  }

  const scenarios = buildScenario();
  // Chaque scénario utilise une transaction interactive. Les lancer tous ensemble
  // peut saturer le petit pool applicatif et faire échouer les démos suivantes.
  // Deux transactions simultanées conservent un montage rapide tout en laissant de
  // la capacité aux lectures d'authentification et aux autres requêtes du serveur.
  const scenarioConcurrency = 2;
  for (let start = 0; start < scenarios.length; start += scenarioConcurrency) {
    const batch = scenarios.slice(start, start + scenarioConcurrency);
    await Promise.all(batch.map(async (scenario, batchIndex) => {
      const index = start + batchIndex;
      const client = clients[index % clients.length] ?? firstClient;
      const driver =
        (scenario.driverIndex != null ? drivers[scenario.driverIndex] : drivers[index % drivers.length]) ??
        firstDriver;
      await createScenarioDelivery(
        {
          companyId,
          clientId: client.id,
          clientEmail: client.email,
          driverId: driver.id,
          driverName: `${driver.firstName} ${driver.lastName}`,
        },
        scenario,
        referenceDate
      );
    }));
  }

  await Promise.all([
    ensureRecurringOrder(
      {
        companyId,
        clientId: firstClient.id,
        clientEmail: firstClient.email,
        driverId: firstDriver.id,
        driverName: `${firstDriver.firstName} ${firstDriver.lastName}`,
      },
      referenceDate
    ),
    secondClient
      ? ensureRecurringOrder(
          {
            companyId,
            clientId: secondClient.id,
            clientEmail: secondClient.email,
            driverId: firstDriver.id,
            driverName: `${firstDriver.firstName} ${firstDriver.lastName}`,
          },
          referenceDate,
          "Collecte documents chaque semaine"
        )
      : Promise.resolve(null),
  ]);

  await Promise.all([
    ensureDemoDriverLocations(drivers),
    ensureDemoClientAddresses(clients),
  ]);
  await applyDemoDispatchDrivers(
    companyId,
    drivers.map((driver) => driver.id)
  );

  // Marque la version du scénario : la maintenance du pool recycle les espaces dépassés.
  const company = await prisma.company.findUnique({ where: { id: companyId }, select: { settings: true } });
  const settings = company?.settings && typeof company.settings === "object" && !Array.isArray(company.settings)
    ? (company.settings as Record<string, unknown>)
    : {};
  await prisma.company.update({
    where: { id: companyId },
    data: { settings: { ...settings, demoScenarioVersion: DEMO_SCENARIO_VERSION } },
  });

  return { deliveries: scenarios.length };
}
