import { prisma } from "@/services/prisma/client";
import { updateCompanySettingsWithClaim, updateUserSettingsWithClaim } from "@/lib/database/settings-claims";
import type {
  DeliveryCategory,
  DeliveryStatus,
  InvoiceStatus,
  OrderStatus,
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
  generateDeliveryReferences,
  generateOrderReference,
  generateOrderReferences,
} from "@/lib/order-reference";
import { getPrimaryCourierPickupFields } from "@/lib/order/courier-pickups";
import { demoInvoiceLineItems } from "@/domains/demo/demo-invoice-lines";
import { DEMO_SIGNAL_LAG_SECONDS } from "@/lib/demo/demo-live-position";
import { DEMO_SCENARIO_ANCHOR_KEY } from "@/domains/demo/demo-time-shift.service";
import { fromParisDateTimeInput, toParisDateTimeInput } from "@/lib/format/paris-datetime-input";

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

export interface ScenarioItem {
  label: string;
  /** Client imposé (index dans DEMO_FIXTURE_CLIENTS ; 0 = compte de la vue Client) ; sinon rotation. */
  clientIndex?: number;
  /** Livreur imposé (index dans DEMO_FIXTURE_DRIVERS ; 0 = compte de la vue Livreur) ; sinon rotation. */
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
  invoice?: { status: InvoiceStatus; dueInDays?: number; paidOffsetHours?: number };
  proof?: { recipientName: string };
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

const QUARTER_HOUR_MS = 15 * 60 * 1000;

/** Instant d'ancrage du scénario : arrondi au quart d'heure, pour des heures lisibles. */
export function demoScenarioAnchor(referenceDate: Date): Date {
  return new Date(Math.round(referenceDate.getTime() / QUARTER_HOUR_MS) * QUARTER_HOUR_MS);
}

/** Écart en heures entre l'ancrage et une heure de Paris, `days` jours plus tard (négatif = avant). */
export function parisClockOffsetHours(anchor: Date, days: number, time: string): number {
  const [datePart] = toParisDateTimeInput(anchor).split("T");
  const day = new Date(`${datePart}T12:00:00Z`);
  day.setUTCDate(day.getUTCDate() + days);
  const target = fromParisDateTimeInput(`${day.toISOString().slice(0, 10)}T${time}`);
  if (!target) throw new Error("DEMO_SCENARIO_PARIS_TIME_INVALID");
  return (new Date(target).getTime() - anchor.getTime()) / (60 * 60 * 1000);
}

/** Preuve de remise : nom du réceptionnaire, heure et position (sans photo ni signature stockées). */
const proof = (recipientName: string) => ({ recipientName });

/**
 * Journée type d'une société de coursiers (DEMO-REFONTE, partie 1), relative à l'ancrage T :
 * 4 livrées aujourd'hui (T−4 h à T−1 h), 3 en route, 1 en retard, 2 affectées, 2 sans livreur, 2 demain.
 * Le client 0 et le livreur 0 sont les comptes des vues Client et Livreur.
 */
export function buildScenario(anchor: Date): ScenarioItem[] {
  const tomorrowMorning = parisClockOffsetHours(anchor, 1, "10:00");
  const tomorrowAfternoon = parisClockOffsetHours(anchor, 1, "14:30");
  return [
    // — Livrées aujourd'hui (T−5 h à T−1 h), avec preuve —
    {
      label: "Livrée — facture payée",
      clientIndex: 0,
      driverIndex: 0,
      deliveryCategory: "STANDARD",
      orderStatus: "DELIVERED",
      deliveryStatus: "DELIVERED",
      assignDriver: true,
      requestedDeliveryDateOffsetHours: -3.5,
      missionStartedAtOffsetHours: -4.5,
      completedAtOffsetHours: -4,
      shipping: { address: "12 Rue de Rivoli", city: "Paris", postalCode: "75001" },
      items: [
        { name: "Colis documents", quantity: 2, unitPrice: 29.95 },
        { name: "Emballage fragile", quantity: 1, unitPrice: 30.0 },
      ],
      tracking: [
        { label: "Commande reçue", offsetHours: -5.5 },
        { label: "En livraison", offsetHours: -4.5, latitude: 48.8606, longitude: 2.3376 },
        { label: "Livré", description: "Colis remis au destinataire", offsetHours: -4, latitude: 48.86244, longitude: 2.3362 },
      ],
      proof: proof("Marie Dubois"),
      invoice: { status: "PAID", paidOffsetHours: -1 },
    },
    {
      label: "Livrée — facture à régler",
      clientIndex: 1,
      driverIndex: 1,
      deliveryCategory: "STANDARD",
      orderStatus: "DELIVERED",
      deliveryStatus: "DELIVERED",
      assignDriver: true,
      requestedDeliveryDateOffsetHours: -2.5,
      missionStartedAtOffsetHours: -3.5,
      completedAtOffsetHours: -3,
      shipping: { address: "30 Rue de la Boétie", city: "Paris", postalCode: "75008" },
      items: [{ name: "Dossier de plaidoirie", quantity: 1, unitPrice: 35.0 }],
      tracking: [
        { label: "Commande reçue", offsetHours: -4.5 },
        { label: "En livraison", offsetHours: -3.5 },
        { label: "Livré", description: "Remis à l'accueil", offsetHours: -3, latitude: 48.87393, longitude: 2.31534 },
      ],
      proof: proof("Accueil du cabinet"),
      invoice: { status: "PENDING", dueInDays: 30 },
    },
    {
      label: "Course livrée",
      clientIndex: 2,
      driverIndex: 2,
      deliveryCategory: "COURIER",
      orderStatus: "DELIVERED",
      deliveryStatus: "DELIVERED",
      assignDriver: true,
      requestedDeliveryDateOffsetHours: -1.5,
      missionStartedAtOffsetHours: -2.75,
      completedAtOffsetHours: -2,
      shipping: { address: "50 Rue de Belleville", city: "Paris", postalCode: "75020" },
      pickupStops: [
        {
          label: "Collecte grossiste",
          address: "4 Place d'Italie",
          city: "Paris",
          postalCode: "75013",
          items: [{ name: "Bouquets de saison", quantity: 6, unitPrice: 12.0 }],
        },
      ],
      tracking: [
        { label: "Course reçue", offsetHours: -4 },
        { label: "Collecte faite", offsetHours: -2.5 },
        { label: "Livré", description: "Remis en boutique", offsetHours: -2, latitude: 48.87311, longitude: 2.38148 },
      ],
      proof: proof("Léa Martin"),
    },
    {
      label: "Livrée",
      clientIndex: 3,
      driverIndex: 4,
      deliveryCategory: "STANDARD",
      orderStatus: "DELIVERED",
      deliveryStatus: "DELIVERED",
      assignDriver: true,
      requestedDeliveryDateOffsetHours: -0.5,
      missionStartedAtOffsetHours: -1.75,
      completedAtOffsetHours: -1,
      shipping: { address: "5 Place de la Bastille", city: "Paris", postalCode: "75012" },
      items: [{ name: "Jeux de clés et dossiers", quantity: 1, unitPrice: 28.0 }],
      tracking: [
        { label: "Commande reçue", offsetHours: -3 },
        { label: "En livraison", offsetHours: -1.75 },
        { label: "Livré", description: "Remis en main propre", offsetHours: -1, latitude: 48.85277, longitude: 2.36994 },
      ],
      proof: proof("Hugo Lambert"),
    },
    // — En route : suivi en direct, plusieurs collectes, achat —
    {
      label: "En route — suivi en direct",
      clientIndex: 0,
      driverIndex: 0,
      deliveryCategory: "STANDARD",
      orderStatus: "IN_DELIVERY",
      deliveryStatus: "IN_DELIVERY",
      assignDriver: true,
      requestedDeliveryDateOffsetHours: 1.5,
      estimatedArrivalOffsetHours: 0.5,
      missionStartedAtOffsetHours: -0.5,
      shipping: { address: "45 Avenue des Champs-Élysées", city: "Paris", postalCode: "75008" },
      items: [{ name: "Préparations magistrales", quantity: 1, unitPrice: 45.0 }],
      deliveryInstructions: "Sonner à l'interphone, 3e étage",
      tracking: [
        { label: "Commande reçue", offsetHours: -2 },
        { label: "Assignée", description: "Livreur affecté", offsetHours: -1 },
        { label: "En livraison", description: "Le livreur est en route", offsetHours: -0.5, latitude: 48.8698, longitude: 2.3078 },
      ],
      supportTicket: {
        subject: "Heure d'arrivée du livreur",
        message: "Bonjour, pouvez-vous me confirmer l'heure d'arrivée du livreur ? Le cabinet ferme à 13 h. Merci.",
      },
    },
    {
      label: "Course en route — trois collectes",
      clientIndex: 4,
      driverIndex: 2,
      deliveryCategory: "COURIER",
      orderStatus: "IN_DELIVERY",
      deliveryStatus: "IN_DELIVERY",
      assignDriver: true,
      requestedDeliveryDateOffsetHours: 2,
      estimatedArrivalOffsetHours: 1,
      missionStartedAtOffsetHours: -0.75,
      shipping: { address: "14 Avenue de Versailles", city: "Paris", postalCode: "75016" },
      pickupStops: [
        {
          label: "Collecte 1 — Imprimerie",
          address: "15 Rue Oberkampf",
          city: "Paris",
          postalCode: "75011",
          items: [{ name: "Catalogues imprimés", quantity: 2, unitPrice: 15.0 }],
        },
        {
          label: "Collecte 2 — Showroom",
          address: "8 Place de la Nation",
          city: "Paris",
          postalCode: "75011",
          items: [{ name: "Échantillons de tissus", quantity: 1, unitPrice: 20.0 }],
        },
        {
          label: "Collecte 3 — Entrepôt",
          address: "20 Boulevard Diderot",
          city: "Paris",
          postalCode: "75012",
          items: [{ name: "Petit colis", quantity: 1, unitPrice: 12.0 }],
        },
      ],
      tracking: [
        { label: "Course reçue", offsetHours: -2.5 },
        { label: "Collecte 1", description: "15 Rue Oberkampf, Paris", offsetHours: -0.75 },
        { label: "Collecte 2", description: "8 Place de la Nation, Paris", offsetHours: -0.5 },
        { label: "Collecte 3", description: "20 Boulevard Diderot, Paris", offsetHours: -0.25 },
      ],
    },
    {
      label: "Course — en achat",
      clientIndex: 2,
      driverIndex: 3,
      deliveryCategory: "COURIER",
      orderStatus: "PURCHASING",
      deliveryStatus: "PURCHASING",
      assignDriver: true,
      requestedDeliveryDateOffsetHours: 2.5,
      estimatedArrivalOffsetHours: 1.5,
      missionStartedAtOffsetHours: -0.5,
      shipping: { address: "12 Rue Lepic", city: "Paris", postalCode: "75018" },
      pickupStops: [
        {
          label: "Achat papeterie",
          address: "2 Rue du Louvre",
          city: "Paris",
          postalCode: "75001",
          items: [{ name: "Rubans et papier cadeau", quantity: 3, unitPrice: 8.0 }],
        },
      ],
      deliveryInstructions: "Livraison en main propre",
      tracking: [
        { label: "Course reçue", offsetHours: -1.5 },
        { label: "En cours d'achat", description: "Le livreur fait les achats", offsetHours: -0.5, latitude: 48.86285, longitude: 2.34182 },
      ],
    },
    // — La seule alerte attendue : en route, échéance dépassée de 25 minutes —
    {
      label: "En retard — en route",
      clientIndex: 1,
      driverIndex: 1,
      deliveryCategory: "STANDARD",
      orderStatus: "IN_DELIVERY",
      deliveryStatus: "IN_DELIVERY",
      assignDriver: true,
      requestedDeliveryDateOffsetHours: -25 / 60,
      estimatedArrivalOffsetHours: 0.25,
      missionStartedAtOffsetHours: -1,
      shipping: { address: "25 Rue de Passy", city: "Paris", postalCode: "75016" },
      items: [{ name: "Actes à signer", quantity: 1, unitPrice: 35.0 }],
      tracking: [
        { label: "Commande reçue", offsetHours: -3 },
        { label: "En livraison", description: "Circulation dense, arrivée décalée", offsetHours: -1 },
      ],
    },
    // — Affectées, non démarrées —
    {
      label: "Affectée — à démarrer",
      clientIndex: 0,
      driverIndex: 0,
      deliveryCategory: "STANDARD",
      orderStatus: "ASSIGNED",
      deliveryStatus: "ASSIGNED",
      assignDriver: true,
      requestedDeliveryDateOffsetHours: 2.5,
      estimatedArrivalOffsetHours: 2.25,
      shipping: { address: "18 Rue Mouffetard", city: "Paris", postalCode: "75005" },
      items: [{ name: "Fournitures médicales", quantity: 2, unitPrice: 24.0 }],
      tracking: [
        { label: "Commande reçue", offsetHours: -1.5 },
        { label: "Assignée au livreur", offsetHours: -1 },
      ],
    },
    {
      label: "Affectée — après-midi",
      clientIndex: 3,
      driverIndex: 4,
      deliveryCategory: "STANDARD",
      orderStatus: "ASSIGNED",
      deliveryStatus: "ASSIGNED",
      assignDriver: true,
      requestedDeliveryDateOffsetHours: 3,
      estimatedArrivalOffsetHours: 2.75,
      shipping: { address: "27 Rue de Lévis", city: "Paris", postalCode: "75017" },
      items: [{ name: "Panneaux d'affichage", quantity: 2, unitPrice: 30.0 }],
      deliveryInstructions: "Accès parking livraison, badge à l'accueil",
      tracking: [
        { label: "Commande reçue", offsetHours: -2 },
        { label: "Assignée au livreur", offsetHours: -1.5 },
      ],
    },
    // — Sans livreur (étape 1 de « À essayer ») —
    {
      label: "Sans livreur",
      clientIndex: 4,
      deliveryCategory: "STANDARD",
      orderStatus: "PENDING",
      deliveryStatus: "PENDING",
      assignDriver: false,
      requestedDeliveryDateOffsetHours: 3,
      shipping: { address: "22 Rue de la Roquette", city: "Paris", postalCode: "75011" },
      items: [{ name: "Pièces détachées", quantity: 1, unitPrice: 42.0 }],
      tracking: [{ label: "Commande reçue", description: "En attente d'un livreur", offsetHours: -0.5 }],
    },
    {
      label: "Sans livreur",
      clientIndex: 2,
      deliveryCategory: "STANDARD",
      orderStatus: "PENDING",
      deliveryStatus: "PENDING",
      assignDriver: false,
      requestedDeliveryDateOffsetHours: 4,
      shipping: { address: "120 Rue de la Convention", city: "Paris", postalCode: "75015" },
      items: [{ name: "Compositions florales", quantity: 2, unitPrice: 28.0 }],
      tracking: [{ label: "Commande reçue", description: "En attente d'un livreur", offsetHours: -0.25 }],
    },
    // — Prévues demain (heure de Paris) —
    {
      label: "Demain matin",
      clientIndex: 0,
      driverIndex: 3,
      deliveryCategory: "STANDARD",
      orderStatus: "ASSIGNED",
      deliveryStatus: "ASSIGNED",
      assignDriver: true,
      requestedDeliveryDateOffsetHours: tomorrowMorning,
      estimatedArrivalOffsetHours: tomorrowMorning - 0.25,
      shipping: { address: "8 Boulevard Haussmann", city: "Paris", postalCode: "75009" },
      items: [{ name: "Carton de médicaments", quantity: 1, unitPrice: 38.5 }],
      tracking: [{ label: "Commande reçue", description: "Livraison prévue demain matin", offsetHours: -1 }],
    },
    {
      label: "Demain après-midi",
      clientIndex: 3,
      driverIndex: 1,
      deliveryCategory: "STANDARD",
      orderStatus: "ASSIGNED",
      deliveryStatus: "ASSIGNED",
      assignDriver: true,
      requestedDeliveryDateOffsetHours: tomorrowAfternoon,
      estimatedArrivalOffsetHours: tomorrowAfternoon - 0.25,
      shipping: { address: "15 Rue des Martyrs", city: "Paris", postalCode: "75009" },
      items: [{ name: "Mobilier de bureau", quantity: 1, unitPrice: 95.0 }],
      tracking: [{ label: "Commande reçue", description: "Livraison prévue demain après-midi", offsetHours: -2 }],
    },
  ];
}

const HISTORY_SLOTS = ["09:40", "11:15", "14:30", "16:50"] as const;
/** Livraisons terminées par jour, de la veille (J−1) à J−7. */
const HISTORY_DAILY_COUNTS = [3, 2, 4, 3, 2, 3, 4] as const;
const HISTORY_ADDRESSES = [
  { address: "12 Rue de Rivoli", city: "Paris", postalCode: "75001" },
  { address: "30 Rue de la Boétie", city: "Paris", postalCode: "75008" },
  { address: "50 Rue de Belleville", city: "Paris", postalCode: "75020" },
  { address: "5 Place de la Bastille", city: "Paris", postalCode: "75012" },
  { address: "18 Rue Mouffetard", city: "Paris", postalCode: "75005" },
  { address: "27 Rue de Lévis", city: "Paris", postalCode: "75017" },
  { address: "8 Boulevard Haussmann", city: "Paris", postalCode: "75009" },
] as const;

/** Sept jours d'historique : graphiques non vides, une seule livraison en retard sur la période. */
export function buildScenarioHistory(anchor: Date): ScenarioItem[] {
  const items: ScenarioItem[] = [];
  HISTORY_DAILY_COUNTS.forEach((count, dayIndex) => {
    for (let slot = 0; slot < count; slot += 1) {
      const n = items.length;
      const completed = parisClockOffsetHours(anchor, -(dayIndex + 1), HISTORY_SLOTS[slot] ?? "12:00");
      const late = dayIndex === 2 && slot === 1;
      items.push({
        label: late ? "Historique — livrée en retard" : "Historique — livrée",
        clientIndex: n % 5,
        driverIndex: n % 5,
        deliveryCategory: "STANDARD",
        orderStatus: "DELIVERED",
        deliveryStatus: "DELIVERED",
        assignDriver: true,
        requestedDeliveryDateOffsetHours: late ? completed - 40 / 60 : completed + 0.5,
        missionStartedAtOffsetHours: completed - 0.75,
        completedAtOffsetHours: completed,
        shipping: { ...HISTORY_ADDRESSES[n % HISTORY_ADDRESSES.length]! },
        items: [{ name: "Colis", quantity: 1, unitPrice: 25.0 + (n % 4) * 5 }],
        tracking: [
          { label: "Commande reçue", offsetHours: completed - 3 },
          { label: "Livré", offsetHours: completed },
        ],
        proof: proof("Réception"),
      });
    }
  });
  return items;
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

  // Réclamation sur updatedAt : un réglage enregistré pendant la réinitialisation n'est pas écrasé.
  await updateCompanySettingsWithClaim(companyId, {
    apply: (settings) => {
      const previousDispatch =
        settings.dispatchRules && typeof settings.dispatchRules === "object"
          ? { ...(settings.dispatchRules as Record<string, unknown>) }
          : {};
      return {
        ...settings,
        dispatchRules: {
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
        },
      };
    },
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

/** Fige le retard fictif du signal de chaque livreur de démo (en direct, estimé ou perdu). */
async function applyDemoSignalLags(drivers: Array<{ id: string }>) {
  // Réclamation sur updatedAt : l'état du service de suivi écrit en parallèle n'est pas écrasé.
  await Promise.all(drivers.map((driver, index) => updateUserSettingsWithClaim(driver.id, {
    apply: (settings) => ({ ...settings, demoSignalLagSeconds: DEMO_SIGNAL_LAG_SECONDS[index] ?? 0 }),
  })));
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
    // E-mails de commande reçus : sans cette purge, ceux des recettes restaient visibles au prospect suivant.
    prisma.inboundOrderEmail.deleteMany({ where: { companyId } }),
    prisma.invoice.deleteMany({ where: { companyId } }),
    ...(driverIds.length > 0
      ? [prisma.driverLocation.deleteMany({ where: { driverId: { in: driverIds } } })]
      : []),
    prisma.order.deleteMany({ where: { companyId } }),
    // Une seule commande récurrente dans le scénario : les anciennes (deux par espace) disparaissent.
    prisma.recurringOrder.deleteMany({ where: { companyId } }),
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

/** Jours écoulés depuis lundi, à l'heure de Paris (0 = lundi). */
function daysSinceMonday(anchor: Date): number {
  const [datePart] = toParisDateTimeInput(anchor).split("T");
  return (new Date(`${datePart}T12:00:00Z`).getUTCDay() + 6) % 7;
}

async function ensureRecurringOrder(
  actors: DemoActors,
  referenceDate: Date = new Date(),
  label = "Réassort hebdomadaire de la pharmacie"
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
    startAt: hoursFromNow(parisClockOffsetHours(referenceDate, -daysSinceMonday(referenceDate) - 7, "09:00"), referenceDate),
    nextRunAt: hoursFromNow(parisClockOffsetHours(referenceDate, 7 - daysSinceMonday(referenceDate), "09:00"), referenceDate),
    deliveryCategory: "STANDARD" as const,
    shippingAddress: "11 Rue de la Paix",
    shippingCity: "Neuilly-sur-Seine",
    shippingPostalCode: "92200",
    deliveryInstructions: "Déposer au bureau — étage 2",
    notes: "Chaque lundi à 9 h",
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
        ...(scenario.proof && scenario.completedAtOffsetHours != null
          ? {
            podOutcome: "SUCCESS",
            podRecipientName: scenario.proof.recipientName,
            podCapturedAt: hoursFromNow(scenario.completedAtOffsetHours, referenceDate),
            podLatitude: destinationCoordinates?.latitude ?? null,
            podLongitude: destinationCoordinates?.longitude ?? null,
            podPositionAt: destinationCoordinates ? hoursFromNow(scenario.completedAtOffsetHours, referenceDate) : null,
          }
          : {}),
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
          paidAt: scenario.invoice.paidOffsetHours != null
            ? hoursFromNow(scenario.invoice.paidOffsetHours, referenceDate)
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

/**
 * Historique des 7 jours en quelques requêtes groupées : livraisons standard terminées,
 * sans facture ni ticket. Une transaction par livraison prenait plus d'une minute.
 */
async function createScenarioHistory(
  items: ScenarioItem[],
  actorsFor: (item: ScenarioItem, index: number) => DemoActors,
  referenceDate: Date
): Promise<void> {
  if (items.length === 0) return;
  if (items.some((item) => item.deliveryCategory !== "STANDARD" || item.invoice || item.supportTicket || item.pickupStops)) {
    throw new Error("DEMO_HISTORY_ITEM_UNSUPPORTED");
  }
  const [orderReferences, deliveryReferences] = await Promise.all([
    generateOrderReferences("STANDARD", items.length),
    generateDeliveryReferences(items.length),
  ]);
  const actors = items.map(actorsFor);
  const at = (offset: number | undefined) => (offset != null ? hoursFromNow(offset, referenceDate) : null);

  await prisma.$transaction(async (tx) => {
    const orders = await tx.order.createManyAndReturn({
      data: items.map((item, index) => {
        const lines = item.items ?? [];
        return {
          reference: orderReferences[index]!,
          status: item.orderStatus,
          source: "CLIENT" as const,
          totalAmount: lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0),
          itemCount: Math.max(lines.reduce((sum, line) => sum + line.quantity, 0), 1),
          notes: item.notes ?? null,
          deliveryCategory: item.deliveryCategory,
          shippingAddress: item.shipping.address,
          shippingCity: item.shipping.city,
          shippingPostalCode: item.shipping.postalCode,
          deliveryInstructions: item.deliveryInstructions ?? null,
          requestedDeliveryDate: hoursFromNow(item.requestedDeliveryDateOffsetHours, referenceDate),
          companyId: actors[index]!.companyId,
          customerId: actors[index]!.clientId,
          customerEmail: actors[index]!.clientEmail,
        };
      }),
      select: { id: true, reference: true },
    });
    const orderIds = new Map(orders.map((order) => [order.reference, order.id]));
    const orderIdAt = (index: number) => orderIds.get(orderReferences[index]!)!;

    await tx.orderItem.createMany({
      data: items.flatMap((item, index) => (item.items ?? []).map((line) => ({
        orderId: orderIdAt(index),
        name: line.name,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
      }))),
    });

    const deliveries = await tx.delivery.createManyAndReturn({
      data: items.map((item, index) => {
        const coordinates = demoCoordinates(item.shipping);
        const completedAt = at(item.completedAtOffsetHours);
        return {
          reference: deliveryReferences[index]!,
          status: item.deliveryStatus,
          deliveryCategory: item.deliveryCategory,
          address: item.shipping.address,
          city: item.shipping.city,
          postalCode: item.shipping.postalCode,
          latitude: coordinates?.latitude ?? null,
          longitude: coordinates?.longitude ?? null,
          driverId: item.assignDriver ? actors[index]!.driverId : null,
          driverName: item.assignDriver ? formatDriverDisplayName(actors[index]!.driverName) : null,
          companyId: actors[index]!.companyId,
          orderId: orderIdAt(index),
          customerId: actors[index]!.clientId,
          scheduledAt: at(item.scheduledAtOffsetHours ?? item.requestedDeliveryDateOffsetHours),
          estimatedArrival: at(item.estimatedArrivalOffsetHours),
          completedAt,
          missionStartedAt: at(item.missionStartedAtOffsetHours),
          ...(item.proof && completedAt
            ? {
              podOutcome: "SUCCESS",
              podRecipientName: item.proof.recipientName,
              podCapturedAt: completedAt,
              podLatitude: coordinates?.latitude ?? null,
              podLongitude: coordinates?.longitude ?? null,
              podPositionAt: coordinates ? completedAt : null,
            }
            : {}),
        };
      }),
      select: { id: true, reference: true },
    });
    const deliveryIds = new Map(deliveries.map((delivery) => [delivery.reference, delivery.id]));

    await tx.trackingEvent.createMany({
      data: items.flatMap((item, index) => item.tracking.map((event) => ({
        deliveryId: deliveryIds.get(deliveryReferences[index]!)!,
        label: event.label,
        description: event.description ?? null,
        latitude: event.latitude ?? null,
        longitude: event.longitude ?? null,
        occurredAt: hoursFromNow(event.offsetHours, referenceDate),
      }))),
    });
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
  if (!firstClient || !firstDriver) {
    throw new Error("DEMO_PERSONAS_MISSING");
  }

  const anchor = demoScenarioAnchor(referenceDate);
  const scenarios = buildScenario(anchor);
  const history = buildScenarioHistory(anchor);
  const actorsFor = (scenario: ScenarioItem, index: number): DemoActors => {
    const client = clients[scenario.clientIndex ?? index % clients.length] ?? firstClient;
    const driver =
      (scenario.driverIndex != null ? drivers[scenario.driverIndex] : drivers[index % drivers.length]) ??
      firstDriver;
    return {
      companyId,
      clientId: client.id,
      clientEmail: client.email,
      driverId: driver.id,
      driverName: `${driver.firstName} ${driver.lastName}`,
    };
  };
  // Chaque scénario utilise une transaction interactive. Les lancer tous ensemble
  // peut saturer le petit pool applicatif et faire échouer les démos suivantes.
  // Deux transactions simultanées conservent un montage rapide tout en laissant de
  // la capacité aux lectures d'authentification et aux autres requêtes du serveur.
  const scenarioConcurrency = 2;
  for (let start = 0; start < scenarios.length; start += scenarioConcurrency) {
    const batch = scenarios.slice(start, start + scenarioConcurrency);
    await Promise.all(batch.map((scenario, batchIndex) =>
      createScenarioDelivery(actorsFor(scenario, start + batchIndex), scenario, anchor)));
  }
  await createScenarioHistory(history, actorsFor, anchor);

  await ensureRecurringOrder(
    {
      companyId,
      clientId: firstClient.id,
      clientEmail: firstClient.email,
      driverId: firstDriver.id,
      driverName: `${firstDriver.firstName} ${firstDriver.lastName}`,
    },
    anchor
  );

  await Promise.all([
    ensureDemoDriverLocations(drivers),
    ensureDemoClientAddresses(clients),
    applyDemoSignalLags(drivers),
  ]);
  await applyDemoDispatchDrivers(
    companyId,
    drivers.map((driver) => driver.id)
  );

  // Marque la version du scénario : la maintenance du pool recycle les espaces dépassés.
  await updateCompanySettingsWithClaim(companyId, {
    apply: (settings) => ({
      ...settings,
      demoScenarioVersion: DEMO_SCENARIO_VERSION,
      [DEMO_SCENARIO_ANCHOR_KEY]: anchor.toISOString(),
    }),
  });

  return { deliveries: scenarios.length + history.length };
}
