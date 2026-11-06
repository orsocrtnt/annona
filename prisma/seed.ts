/**
 * Données de démonstration (SCHEMA-1) : une boulangerie, son catalogue, 20 commerçants à Paris,
 * 3 créneaux, 5 livreurs, 1 boulanger, 1 administrateur, un super-administrateur, l'historique de
 * la semaine (commandes livrées, tournées) et une commande récurrente.
 *
 * Idempotent : référentiel en `upsert` sur des identifiants préfixés `demo_` ; commandes, tournées et
 * commandes récurrentes de l'entreprise de démonstration supprimées puis recréées par rapport à
 * aujourd'hui. Aucune autre donnée n'est touchée.
 *
 * Comptes connectables créés dans Supabase Auth (clé service_role). Les mots de passe sont écrits
 * dans `outputs/comptes-demo.md` (dossier ignoré par git), jamais dans la console ni le dépôt.
 * Réutilisés d'une exécution à l'autre (`outputs/comptes-demo.json`).
 *
 * Usage : npm run db:seed   (base de développement annona-dev uniquement)
 */
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync } from "node:fs";
import { resolve } from "node:path";
import { PrismaClient, type OrderStatus, type SystemRole } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";
import ws from "ws";
import { PERMISSIONS, ROLE_PERMISSIONS, ROLES } from "./reference-data";
import { addCalendarDays, parisParts, parisWallTimeToUtc, type CalendarDate } from "../src/lib/time/paris";

const prisma = new PrismaClient();

export const DEMO_PREFIX = "demo_";
export const DEMO_COMPANY_ID = "demo_company_boulangerie";
const ACCOUNTS_JSON = resolve("outputs/comptes-demo.json");
const ACCOUNTS_MD = resolve("outputs/comptes-demo.md");

// ---------------------------------------------------------------------------
// Référentiel
// ---------------------------------------------------------------------------

const SLOTS = [
  { id: "demo_slot_0500", label: "5h – 6h", startTime: "05:00", endTime: "06:00" },
  { id: "demo_slot_0600", label: "6h – 7h", startTime: "06:00", endTime: "07:00" },
  { id: "demo_slot_0700", label: "7h – 8h", startTime: "07:00", endTime: "08:00" },
] as const;

type ProductRow = readonly [name: string, unit: string, priceCents: number];

/** 7 catégories, 100 produits ; prix de gros HT en centimes. */
const CATALOG: ReadonlyArray<{ id: string; name: string; products: readonly ProductRow[] }> = [
  {
    id: "pains",
    name: "Pains",
    products: [
      ["Baguette tradition", "pièce", 110],
      ["Baguette classique", "pièce", 95],
      ["Demi-baguette tradition", "pièce", 65],
      ["Ficelle", "pièce", 90],
      ["Flûte", "pièce", 120],
      ["Bâtard", "pièce", 150],
      ["Pain de campagne 400 g", "pièce", 260],
      ["Pain de campagne 800 g", "pièce", 480],
      ["Boule de campagne 1 kg", "pièce", 590],
      ["Pain au levain 500 g", "pièce", 420],
      ["Pain complet 500 g", "pièce", 330],
      ["Pain de seigle 500 g", "pièce", 360],
      ["Pain aux céréales 500 g", "pièce", 340],
      ["Couronne", "pièce", 380],
      ["Pain de mie nature", "pièce", 350],
      ["Pain de mie complet", "pièce", 380],
      ["Pain viennois", "pièce", 180],
      ["Pain au levain au kilo", "kg", 690],
    ],
  },
  {
    id: "pains-speciaux",
    name: "Pains spéciaux",
    products: [
      ["Pain aux noix", "pièce", 390],
      ["Pain aux figues", "pièce", 420],
      ["Pain aux olives", "pièce", 410],
      ["Pain aux raisins secs", "pièce", 400],
      ["Pain d'épeautre", "pièce", 450],
      ["Pain au maïs", "pièce", 360],
      ["Pain nordique", "pièce", 470],
      ["Pain sans gluten", "pièce", 520],
      ["Pain burger (sachet de 6)", "sachet de 6", 390],
      ["Pain hot-dog (sachet de 6)", "sachet de 6", 360],
      ["Petit pain individuel", "pièce", 45],
      ["Pain bagnat", "pièce", 95],
      ["Focaccia au romarin", "plaque", 1450],
      ["Ciabatta", "pièce", 210],
    ],
  },
  {
    id: "viennoiseries",
    name: "Viennoiseries",
    products: [
      ["Croissant au beurre", "pièce", 85],
      ["Pain au chocolat", "pièce", 95],
      ["Pain aux raisins", "pièce", 110],
      ["Chausson aux pommes", "pièce", 120],
      ["Croissant aux amandes", "pièce", 160],
      ["Pain au chocolat aux amandes", "pièce", 170],
      ["Suisse aux pépites", "pièce", 140],
      ["Kouign-amann", "pièce", 180],
      ["Brioche individuelle", "pièce", 90],
      ["Brioche tressée", "pièce", 520],
      ["Brioche Nanterre", "pièce", 480],
      ["Pain au lait (sachet de 6)", "sachet de 6", 290],
      ["Mini-croissant", "pièce", 45],
      ["Mini-pain au chocolat", "pièce", 50],
      ["Torsade au chocolat", "pièce", 150],
      ["Chouquettes (sachet de 20)", "sachet de 20", 350],
    ],
  },
  {
    id: "patisseries",
    name: "Pâtisseries individuelles",
    products: [
      ["Éclair au chocolat", "pièce", 260],
      ["Éclair au café", "pièce", 260],
      ["Religieuse au chocolat", "pièce", 300],
      ["Paris-Brest individuel", "pièce", 340],
      ["Tartelette aux fraises", "pièce", 360],
      ["Tartelette citron meringuée", "pièce", 320],
      ["Millefeuille", "pièce", 330],
      ["Opéra", "part", 340],
      ["Flan pâtissier", "part", 230],
      ["Tarte aux pommes", "part", 240],
      ["Chou chantilly", "pièce", 210],
      ["Macarons (boîte de 6)", "boîte de 6", 720],
      ["Financier", "pièce", 110],
      ["Madeleines (sachet de 10)", "sachet de 10", 390],
      ["Cookie aux pépites", "pièce", 150],
      ["Muffin myrtille", "pièce", 180],
    ],
  },
  {
    id: "gateaux",
    name: "Gâteaux à partager",
    products: [
      ["Fraisier 6 parts", "pièce", 2200],
      ["Tarte aux pommes 6 parts", "pièce", 1350],
      ["Tarte au citron 6 parts", "pièce", 1550],
      ["Forêt-noire 8 parts", "pièce", 2600],
      ["Moka 6 parts", "pièce", 2100],
      ["Fondant au chocolat 8 parts", "pièce", 1900],
      ["Paris-Brest 6 parts", "pièce", 2300],
      ["Flan pâtissier entier", "pièce", 1500],
      ["Cake au citron", "pièce", 950],
      ["Cake marbré", "pièce", 900],
      ["Saint-Honoré 6 parts", "pièce", 2500],
      ["Tarte Tatin 6 parts", "pièce", 1650],
    ],
  },
  {
    id: "sale",
    name: "Salé et traiteur",
    products: [
      ["Quiche lorraine", "part", 320],
      ["Quiche saumon épinards", "part", 360],
      ["Feuilleté jambon fromage", "pièce", 290],
      ["Croque-monsieur", "pièce", 340],
      ["Pizza margherita", "part", 280],
      ["Sandwich jambon beurre", "pièce", 330],
      ["Sandwich poulet crudités", "pièce", 390],
      ["Sandwich thon mayonnaise", "pièce", 370],
      ["Wrap végétarien", "pièce", 380],
      ["Friand à la viande", "pièce", 260],
      ["Tarte fine à la tomate", "part", 300],
      ["Mini-quiches (plaque de 20)", "plaque de 20", 1400],
      ["Gougères (sachet de 20)", "sachet de 20", 650],
      ["Pâté en croûte", "kg", 2400],
    ],
  },
  {
    id: "snacking",
    name: "Biscuits et gourmandises",
    products: [
      ["Sablés au beurre (sachet)", "sachet de 250 g", 420],
      ["Meringues", "sachet de 200 g", 380],
      ["Palmier", "pièce", 140],
      ["Tuiles aux amandes", "sachet de 150 g", 450],
      ["Brownie", "pièce", 190],
      ["Cannelé", "pièce", 150],
      ["Pain d'épices", "pièce", 680],
      ["Biscuits secs en vrac", "kg", 1600],
      ["Croquants aux amandes", "sachet de 200 g", 520],
      ["Rochers coco", "pièce", 130],
    ],
  },
];

type MerchantSeed = {
  name: string;
  address: string;
  postalCode: string;
  latitude: number;
  longitude: number;
  access: string;
  contact: string;
  billing: "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";
  payment: "VIREMENT" | "PRELEVEMENT" | "ESPECES";
  slot: 0 | 1 | 2;
  /** Produits habituels (indices du catalogue aplati) et quantité moyenne. */
  usual: ReadonlyArray<readonly [productIndex: number, quantity: number]>;
};

// Noms inventés ; adresses de rues parisiennes, coordonnées approchées.
const MERCHANTS: readonly MerchantSeed[] = [
  { name: "Café Lumière (démo)", address: "12 rue des Abbesses", postalCode: "75018", latitude: 48.8846, longitude: 2.3382, access: "Rideau à moitié levé dès 6h, déposer derrière le comptoir.", contact: "Inès Martin", billing: "MONTHLY", payment: "PRELEVEMENT", slot: 0, usual: [[0, 40], [18, 6], [32, 30], [33, 25], [38, 8]] },
  { name: "Bistrot Valmy (démo)", address: "54 quai de Valmy", postalCode: "75010", latitude: 48.8723, longitude: 2.3641, access: "Livraison par la cour, digicode 4821B.", contact: "Hugo Lefèvre", billing: "WEEKLY", payment: "VIREMENT", slot: 1, usual: [[0, 30], [6, 4], [7, 2], [32, 20], [33, 20], [82, 6]] },
  { name: "Épicerie Oberkampf & Co (démo)", address: "98 rue Oberkampf", postalCode: "75011", latitude: 48.8656, longitude: 2.3788, access: "Sonner à l'interphone « Épicerie ».", contact: "Nadia Benali", billing: "MONTHLY", payment: "VIREMENT", slot: 1, usual: [[0, 25], [11, 4], [18, 5], [19, 4], [20, 4], [88, 6]] },
  { name: "Hôtel des Tourelles (démo)", address: "21 rue de Turenne", postalCode: "75004", latitude: 48.8568, longitude: 2.3638, access: "Réception ouverte 24h/24, accès livraison côté rue.", contact: "Paul Girard", billing: "MONTHLY", payment: "PRELEVEMENT", slot: 0, usual: [[32, 60], [33, 60], [40, 20], [44, 30], [14, 6], [0, 20]] },
  { name: "Brasserie du Faubourg (démo)", address: "3 rue du Faubourg Saint-Antoine", postalCode: "75011", latitude: 48.8532, longitude: 2.3707, access: "Entrée de service à gauche de la terrasse.", contact: "Karim Haddad", billing: "WEEKLY", payment: "VIREMENT", slot: 0, usual: [[0, 50], [1, 20], [6, 6], [42, 20], [82, 10]] },
  { name: "Comptoir du Four (démo)", address: "45 rue du Four", postalCode: "75006", latitude: 48.8531, longitude: 2.3314, access: "Clé dans la boîte à code, code communiqué par téléphone.", contact: "Claire Dubois", billing: "MONTHLY", payment: "PRELEVEMENT", slot: 1, usual: [[0, 35], [32, 25], [33, 25], [48, 8], [49, 8]] },
  { name: "Café Montorgueil Matin (démo)", address: "60 rue Montorgueil", postalCode: "75002", latitude: 48.8651, longitude: 2.3474, access: "Déposer devant la porte vitrée si fermé, sous la bâche.", contact: "Léa Fontaine", billing: "DAILY", payment: "ESPECES", slot: 0, usual: [[0, 20], [32, 30], [33, 30], [34, 10]] },
  { name: "Table des Batignolles (démo)", address: "18 rue des Batignolles", postalCode: "75017", latitude: 48.8846, longitude: 2.3197, access: "Livraison en cuisine, sonnette « Fournisseurs ».", contact: "Julien Roche", billing: "WEEKLY", payment: "VIREMENT", slot: 2, usual: [[0, 30], [9, 4], [26, 6], [62, 2], [83, 6]] },
  { name: "Supérette Convention (démo)", address: "120 rue de la Convention", postalCode: "75015", latitude: 48.8396, longitude: 2.2954, access: "Ouverture 7h, attendre le gérant.", contact: "Samir Ouali", billing: "WEEKLY", payment: "ESPECES", slot: 2, usual: [[0, 40], [1, 30], [14, 10], [15, 6], [43, 10]] },
  { name: "Café de la Butte (démo)", address: "22 rue de la Butte-aux-Cailles", postalCode: "75013", latitude: 48.828, longitude: 2.3502, access: "Porte de droite, poser sur l'étagère inox.", contact: "Margaux Petit", billing: "MONTHLY", payment: "VIREMENT", slot: 1, usual: [[0, 25], [32, 20], [33, 20], [61, 6], [92, 8]] },
  { name: "Hôtel Diderot Gare (démo)", address: "8 boulevard Diderot", postalCode: "75012", latitude: 48.8462, longitude: 2.3738, access: "Quai de livraison au sous-sol, badge à la réception.", contact: "Thomas Bernard", billing: "MONTHLY", payment: "PRELEVEMENT", slot: 0, usual: [[32, 80], [33, 80], [35, 20], [44, 40], [14, 8], [41, 6]] },
  { name: "Épicerie Mouffetard (démo)", address: "75 rue Mouffetard", postalCode: "75005", latitude: 48.8419, longitude: 2.3498, access: "Rue piétonne : se garer rue Monge, 2 minutes à pied.", contact: "Élodie Moreau", billing: "WEEKLY", payment: "VIREMENT", slot: 1, usual: [[0, 20], [18, 4], [21, 3], [22, 3], [95, 4]] },
  { name: "Brasserie Italie (démo)", address: "1 place d'Italie", postalCode: "75013", latitude: 48.8311, longitude: 2.3558, access: "Entrée fournisseurs rue Bobillot.", contact: "Antoine Garnier", billing: "MONTHLY", payment: "VIREMENT", slot: 0, usual: [[0, 45], [1, 25], [7, 4], [56, 10], [57, 10]] },
  { name: "Café Belleville Haut (démo)", address: "30 rue de Belleville", postalCode: "75020", latitude: 48.8723, longitude: 2.3802, access: "Volet roulant fermé avant 7h : déposer dans le sas.", contact: "Yasmine Diallo", billing: "WEEKLY", payment: "ESPECES", slot: 2, usual: [[0, 20], [32, 15], [33, 15], [82, 8], [85, 6]] },
  { name: "Bio Pernety (démo)", address: "41 rue Pernety", postalCode: "75014", latitude: 48.8339, longitude: 2.3181, access: "Livrer avant 8h, porte de service à droite.", contact: "Romain Lambert", billing: "MONTHLY", payment: "PRELEVEMENT", slot: 2, usual: [[9, 6], [11, 6], [12, 6], [22, 4], [25, 4]] },
  { name: "Restaurant Rue Cler (démo)", address: "33 rue Cler", postalCode: "75007", latitude: 48.8561, longitude: 2.3061, access: "Rue piétonne : accès véhicule avant 7h30 uniquement.", contact: "Sophie Laurent", billing: "WEEKLY", payment: "VIREMENT", slot: 1, usual: [[0, 30], [6, 4], [8, 2], [64, 2], [66, 2]] },
  { name: "Café Eylau (démo)", address: "5 avenue d'Eylau", postalCode: "75016", latitude: 48.8651, longitude: 2.2874, access: "Sonner chez le gardien, local au fond de la cour.", contact: "Louis Mercier", billing: "MONTHLY", payment: "VIREMENT", slot: 2, usual: [[0, 25], [32, 25], [33, 25], [36, 8], [49, 6]] },
  { name: "Coffee Frochot (démo)", address: "15 rue Frochot", postalCode: "75009", latitude: 48.8818, longitude: 2.3375, access: "Boîte de livraison verrouillée, cadenas 1904.", contact: "Chloé Henry", billing: "DAILY", payment: "ESPECES", slot: 0, usual: [[32, 25], [33, 25], [60, 8], [61, 8], [92, 6]] },
  { name: "Cantine Ledru (démo)", address: "90 avenue Ledru-Rollin", postalCode: "75011", latitude: 48.8531, longitude: 2.3766, access: "Cuisine en sous-sol, escalier à gauche de l'entrée.", contact: "Mehdi Robin", billing: "WEEKLY", payment: "VIREMENT", slot: 1, usual: [[0, 35], [6, 4], [83, 12], [84, 8], [86, 8]] },
  { name: "Hôtel des Ternes (démo)", address: "26 avenue des Ternes", postalCode: "75017", latitude: 48.8795, longitude: 2.2959, access: "Accès livraison par la rue Poncelet.", contact: "Anne Faure", billing: "MONTHLY", payment: "PRELEVEMENT", slot: 0, usual: [[32, 50], [33, 50], [44, 20], [45, 20], [14, 6], [53, 10]] },
];

/** Prix spécifiques (RG-05) : commerçant, produit, prix HT en centimes. */
const SPECIFIC_PRICES: ReadonlyArray<readonly [merchantIndex: number, productIndex: number, priceCents: number]> = [
  [0, 0, 100],
  [0, 32, 78],
  [0, 33, 88],
  [3, 32, 75],
  [3, 33, 85],
  [3, 40, 80],
  [10, 32, 74],
  [10, 33, 84],
  [10, 0, 99],
  [4, 0, 102],
];

type AccountSeed = {
  key: string;
  email: string;
  firstName: string;
  lastName: string;
  role: SystemRole;
  phone?: string;
  merchantIndex?: number;
};

const ACCOUNTS: readonly AccountSeed[] = [
  { key: "super-admin", email: "demo-super-admin@annona.fr", firstName: "Sacha", lastName: "Plateforme", role: "SUPER_ADMIN" },
  { key: "admin", email: "demo-admin@annona.fr", firstName: "Camille", lastName: "Durand", role: "ADMIN", phone: "0601020304" },
  { key: "boulanger", email: "demo-boulanger@annona.fr", firstName: "Bastien", lastName: "Fournier", role: "BAKER", phone: "0601020305" },
  ...[1, 2, 3, 4, 5].map((n): AccountSeed => ({
    key: `livreur-${n}`,
    email: `demo-livreur-${n}@annona.fr`,
    firstName: ["Mathis", "Lina", "Yanis", "Clara", "Noah"][n - 1]!,
    lastName: "Livreur",
    role: "DRIVER",
    phone: `06110000${String(n).padStart(2, "0")}`,
  })),
  { key: "client-1", email: "demo-client-1@annona.fr", firstName: "Inès", lastName: "Martin", role: "MERCHANT", merchantIndex: 0 },
  { key: "client-2", email: "demo-client-2@annona.fr", firstName: "Hugo", lastName: "Lefèvre", role: "MERCHANT", merchantIndex: 1 },
  { key: "client-3", email: "demo-client-3@annona.fr", firstName: "Nadia", lastName: "Benali", role: "MERCHANT", merchantIndex: 2 },
];

const ROLE_SLUG: Record<SystemRole, string> = {
  SUPER_ADMIN: "super-admin",
  ADMIN: "admin",
  BAKER: "baker",
  DRIVER: "driver",
  MERCHANT: "merchant",
};

// ---------------------------------------------------------------------------
// Outils
// ---------------------------------------------------------------------------

/** Générateur pseudo-aléatoire déterministe : mêmes quantités à chaque exécution du même jour. */
function prng(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pad = (value: number) => String(value).padStart(2, "0");
const dayKey = (date: CalendarDate) => `${date.year}${pad(date.month)}${pad(date.day)}`;
/** Jour civil stocké en colonne `date` : minuit UTC du jour de Paris. */
const dbDate = (date: CalendarDate) => new Date(Date.UTC(date.year, date.month - 1, date.day));
const isoWeekday = (date: CalendarDate) => ((dbDate(date).getUTCDay() + 6) % 7) + 1;
const at = (date: CalendarDate, time: string) => {
  const [hour, minute] = time.split(":").map(Number) as [number, number];
  return parisWallTimeToUtc(date, { hour, minute });
};
const slugify = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

function haversineKm(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLng = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

function readStoredPasswords(): Record<string, string> {
  if (!existsSync(ACCOUNTS_JSON)) return {};
  try {
    const parsed = JSON.parse(readFileSync(ACCOUNTS_JSON, "utf8")) as Record<string, { password?: unknown }>;
    return Object.fromEntries(
      Object.entries(parsed).flatMap(([key, value]) => (typeof value?.password === "string" ? [[key, value.password]] : []))
    );
  } catch {
    return {};
  }
}

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requis (.env.local).");
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
    realtime: { transport: ws as never },
  });
}

// ---------------------------------------------------------------------------
// Étapes
// ---------------------------------------------------------------------------

async function seedReferenceData() {
  for (const permission of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { slug: permission.slug },
      update: { name: permission.name, resource: permission.resource, action: permission.action },
      create: permission,
    });
  }
  for (const role of ROLES) {
    const upserted = await prisma.role.upsert({
      where: { slug: role.slug },
      update: { name: role.name, description: role.description, systemRole: role.systemRole, isSystem: true },
      create: { name: role.name, slug: role.slug, description: role.description, systemRole: role.systemRole, isSystem: true },
    });
    const permissions = await prisma.permission.findMany({ where: { slug: { in: [...ROLE_PERMISSIONS[role.systemRole]] } } });
    await prisma.rolePermission.deleteMany({ where: { roleId: upserted.id, permissionId: { notIn: permissions.map((p) => p.id) } } });
    await prisma.rolePermission.createMany({
      data: permissions.map((permission) => ({ roleId: upserted.id, permissionId: permission.id })),
      skipDuplicates: true,
    });
  }
}

async function seedCompany() {
  const data = {
    name: "Boulangerie Démo Annona",
    email: "contact-demo@annona.fr",
    phone: "0140000000",
    address: "8 rue de la Roquette",
    city: "Paris",
    country: "FR",
    status: "ACTIVE" as const,
    cutoffTime: "17:00",
    timezone: "Europe/Paris",
    reminderLeadMinutes: 120,
    legalName: "Boulangerie Démo Annona SAS",
    billingAddress: "8 rue de la Roquette",
    billingPostalCode: "75011",
    billingCity: "Paris",
    depotLatitude: 48.8547,
    depotLongitude: 2.3725,
    settings: {
      demo: true,
      units: ["pièce", "part", "kg", "sachet de 6", "sachet de 10", "sachet de 20", "boîte de 6", "plaque", "plaque de 20"],
      billing: { invoice: { footerNote: "Données de démonstration : aucune facture réelle." } },
    },
  };
  await prisma.company.upsert({
    where: { id: DEMO_COMPANY_ID },
    update: data,
    create: { id: DEMO_COMPANY_ID, slug: "demo-boulangerie", ...data },
  });
}

async function seedCatalog() {
  const productIds: string[] = [];
  for (const [categoryIndex, category] of CATALOG.entries()) {
    const categoryId = `demo_category_${category.id}`;
    await prisma.category.upsert({
      where: { id: categoryId },
      update: { name: category.name, sortOrder: categoryIndex },
      create: { id: categoryId, companyId: DEMO_COMPANY_ID, name: category.name, sortOrder: categoryIndex },
    });
    for (const [productIndex, [name, unit, basePriceCents]] of category.products.entries()) {
      const id = `demo_product_${slugify(name)}`;
      const data = { categoryId, name, unit, basePriceCents, vatRateBasisPoints: 550, sortOrder: productIndex, active: true };
      await prisma.product.upsert({ where: { id }, update: data, create: { id, companyId: DEMO_COMPANY_ID, ...data } });
      productIds.push(id);
    }
  }
  if (productIds.length !== 100) throw new Error(`Catalogue de démonstration : ${productIds.length} produits au lieu de 100.`);
  return productIds;
}

async function seedSlots() {
  for (const [index, slot] of SLOTS.entries()) {
    const data = { label: slot.label, startTime: slot.startTime, endTime: slot.endTime, active: true, sortOrder: index };
    await prisma.slot.upsert({ where: { id: slot.id }, update: data, create: { id: slot.id, companyId: DEMO_COMPANY_ID, ...data } });
  }
}

async function seedMerchants(productIds: string[]) {
  const merchantIds: string[] = [];
  for (const [index, merchant] of MERCHANTS.entries()) {
    const id = `demo_merchant_${pad(index + 1)}`;
    const email = `demo-commercant-${pad(index + 1)}@annona.fr`;
    const data = {
      name: merchant.name,
      address: merchant.address,
      postalCode: merchant.postalCode,
      city: "Paris",
      latitude: merchant.latitude,
      longitude: merchant.longitude,
      accessInstructions: merchant.access,
      contactName: merchant.contact,
      contactPhone: `0612${pad(index + 1)}0000`,
      contactEmail: email,
      billingEmail: email,
      billingPeriod: merchant.billing,
      paymentMethod: merchant.payment,
      active: true,
    };
    await prisma.merchant.upsert({ where: { id }, update: data, create: { id, companyId: DEMO_COMPANY_ID, ...data } });
    merchantIds.push(id);
  }
  for (const [merchantIndex, productIndex, priceCents] of SPECIFIC_PRICES) {
    const merchantId = merchantIds[merchantIndex]!;
    const productId = productIds[productIndex]!;
    await prisma.merchantPrice.upsert({
      where: { merchantId_productId: { merchantId, productId } },
      update: { priceCents },
      create: { id: `demo_price_${merchantIndex}_${productIndex}`, companyId: DEMO_COMPANY_ID, merchantId, productId, priceCents },
    });
  }
  return merchantIds;
}

async function seedAccounts(merchantIds: string[]) {
  const stored = readStoredPasswords();
  const supabase = supabaseAdmin();
  const roles = new Map((await prisma.role.findMany()).map((role) => [role.slug, role.id]));
  const manifest: Record<string, { email: string; password: string; role: SystemRole; space: string }> = {};
  const userIds = new Map<string, string>();
  const space: Record<SystemRole, string> = {
    SUPER_ADMIN: "/admin",
    ADMIN: "/dashboard",
    BAKER: "/bakery",
    DRIVER: "/driver",
    MERCHANT: "/portal",
  };

  for (const account of ACCOUNTS) {
    const password = stored[account.key] ?? `Demo-${randomBytes(9).toString("base64url")}!`;
    const roleId = roles.get(ROLE_SLUG[account.role]);
    if (!roleId) throw new Error(`Rôle ${account.role} absent : appliquer la migration initiale.`);

    const existing = await prisma.user.findUnique({ where: { email: account.email } });
    let authId = existing?.authId ?? null;
    if (authId) {
      const { error } = await supabase.auth.admin.updateUserById(authId, { password, email_confirm: true });
      if (error) authId = null;
    }
    if (!authId) {
      const created = await supabase.auth.admin.createUser({
        email: account.email,
        password,
        email_confirm: true,
        user_metadata: { first_name: account.firstName, last_name: account.lastName },
      });
      if (created.error || !created.data.user) {
        // Compte Auth déjà présent sans profil (exécution interrompue) : retrouvé par l'adresse.
        const { data: list, error: listError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
        const found = list?.users.find((user) => user.email?.toLowerCase() === account.email);
        if (listError || !found) throw new Error(`Supabase Auth : création impossible pour ${account.email}.`);
        const { error } = await supabase.auth.admin.updateUserById(found.id, { password, email_confirm: true });
        if (error) throw new Error(`Supabase Auth : mise à jour impossible pour ${account.email}.`);
        authId = found.id;
      } else {
        authId = created.data.user.id;
      }
    }

    const data = {
      authId,
      firstName: account.firstName,
      lastName: account.lastName,
      phone: account.phone ?? null,
      status: "ACTIVE" as const,
      roleId,
      companyId: account.role === "SUPER_ADMIN" ? null : DEMO_COMPANY_ID,
      merchantId: account.merchantIndex === undefined ? null : merchantIds[account.merchantIndex]!,
    };
    const user = await prisma.user.upsert({
      where: { email: account.email },
      update: data,
      create: { id: `demo_user_${account.key.replace(/-/g, "_")}`, email: account.email, ...data },
    });
    userIds.set(account.key, user.id);
    manifest[account.key] = { email: account.email, password, role: account.role, space: space[account.role] };
  }

  mkdirSync(resolve("outputs"), { recursive: true });
  writeFileSync(ACCOUNTS_JSON, JSON.stringify(manifest, null, 2));
  chmodSync(ACCOUNTS_JSON, 0o600);
  const lines = [
    "# Comptes de démonstration — annona-dev",
    "",
    "Fichier local, ignoré par git (`outputs/`). Ne pas copier dans un document versionné.",
    "Généré par `npm run db:seed` ; les mots de passe sont conservés d'une exécution à l'autre.",
    "",
    "| Compte | Rôle | Espace | E-mail | Mot de passe |",
    "|---|---|---|---|---|",
    ...Object.entries(manifest).map(([key, value]) => `| ${key} | ${value.role} | ${value.space} | ${value.email} | \`${value.password}\` |`),
    "",
  ];
  writeFileSync(ACCOUNTS_MD, lines.join("\n"));
  chmodSync(ACCOUNTS_MD, 0o600);
  return userIds;
}

/** Ordre de passage au plus proche voisin depuis le laboratoire (le calcul réel viendra avec TOUR-1). */
function nearestNeighbourOrder<T extends { latitude: number; longitude: number }>(depot: { latitude: number; longitude: number }, stops: T[]) {
  const remaining = [...stops];
  const ordered: T[] = [];
  let current = depot;
  while (remaining.length) {
    let best = 0;
    for (let i = 1; i < remaining.length; i += 1) {
      if (haversineKm(current, remaining[i]!) < haversineKm(current, remaining[best]!)) best = i;
    }
    const [next] = remaining.splice(best, 1);
    ordered.push(next!);
    current = next!;
  }
  return ordered;
}

async function seedOrders(productIds: string[], merchantIds: string[], userIds: Map<string, string>, now: Date) {
  // Seules les données transactionnelles de l'entreprise de démonstration sont recréées.
  await prisma.round.deleteMany({ where: { companyId: DEMO_COMPANY_ID } });
  await prisma.order.deleteMany({ where: { companyId: DEMO_COMPANY_ID } });
  await prisma.recurringOrder.deleteMany({ where: { companyId: DEMO_COMPANY_ID } });

  const parisNow = parisParts(now);
  const today: CalendarDate = { year: parisNow.year, month: parisNow.month, day: parisNow.day };
  const products = await prisma.product.findMany({ where: { companyId: DEMO_COMPANY_ID }, select: { id: true, basePriceCents: true } });
  const basePrice = new Map(products.map((product) => [product.id, product.basePriceCents]));
  const specific = new Map(
    (await prisma.merchantPrice.findMany({ where: { companyId: DEMO_COMPANY_ID } })).map((price) => [`${price.merchantId}:${price.productId}`, price.priceCents])
  );
  const drivers = [1, 2, 3, 4, 5].map((n) => userIds.get(`livreur-${n}`)!);
  const admin = userIds.get("admin")!;
  const depot = { latitude: 48.8547, longitude: 2.3725 };

  // Commande récurrente active : Bistrot Valmy, du lundi au samedi, créneau 6h-7h.
  await prisma.recurringOrder.create({
    data: {
      id: "demo_recurring_bistrot_valmy",
      companyId: DEMO_COMPANY_ID,
      merchantId: merchantIds[1]!,
      slotId: SLOTS[1].id,
      label: "Commande de la semaine",
      weekdays: [1, 2, 3, 4, 5, 6],
      active: true,
      lines: {
        create: MERCHANTS[1]!.usual.map(([productIndex, quantity]) => ({
          companyId: DEMO_COMPANY_ID,
          productId: productIds[productIndex]!,
          quantity,
        })),
      },
    },
  });

  let orderCount = 0;
  // Historique : 7 jours livrés (J-7 à J-1, et ce matin), puis demain, commandes validées.
  for (let offset = -7; offset <= 1; offset += 1) {
    const day = addCalendarDays(today, offset);
    const delivered = offset <= 0;
    const random = prng(Number(dayKey(day)));
    const ordersBySlot = new Map<number, Array<{ id: string; latitude: number; longitude: number }>>();

    for (const [merchantIndex, merchant] of MERCHANTS.entries()) {
      // Environ 80 % des commerçants commandent chaque jour ; le dimanche, moins.
      const chance = isoWeekday(day) === 7 ? 0.45 : 0.8;
      if (random() > chance) continue;
      const merchantId = merchantIds[merchantIndex]!;
      const slot = SLOTS[merchant.slot];
      const reference = `DEMO-${dayKey(day)}-${pad(merchantIndex + 1)}`;
      const id = `demo_order_${dayKey(day)}_${pad(merchantIndex + 1)}`;
      const recurring = merchantIndex === 1 && isoWeekday(day) <= 6;
      const status: OrderStatus = delivered ? "DELIVERED" : "VALIDATED";
      const lockedAt = at(addCalendarDays(day, -1), "17:00");
      const validatedAt = at(addCalendarDays(day, -1), `${pad(9 + Math.floor(random() * 7))}:${pad(Math.floor(random() * 60))}`);
      const deliveredAt = at(day, `${slot.startTime.slice(0, 2)}:${pad(10 + Math.floor(random() * 45))}`);

      const lines = merchant.usual.map(([productIndex, quantity]) => {
        const productId = productIds[productIndex]!;
        const ordered = Math.max(1, Math.round(quantity * (0.75 + random() * 0.5)));
        // Un manquant de temps en temps (BOU-06) : la facture portera sur la quantité livrée.
        const shortage = delivered && random() < 0.04 ? Math.min(ordered, 1 + Math.floor(random() * 3)) : 0;
        return {
          companyId: DEMO_COMPANY_ID,
          productId,
          quantityOrdered: ordered,
          quantityDelivered: delivered ? ordered - shortage : null,
          unitPriceFrozenCents: delivered ? specific.get(`${merchantId}:${productId}`) ?? basePrice.get(productId)! : null,
        };
      });

      await prisma.order.create({
        data: {
          id,
          companyId: DEMO_COMPANY_ID,
          reference,
          merchantId,
          deliveryDate: dbDate(day),
          slotId: slot.id,
          status,
          origin: recurring ? "RECURRING" : "MANUAL",
          recurringOrderId: recurring ? "demo_recurring_bistrot_valmy" : null,
          createdById: recurring ? null : merchantIndex < 3 ? userIds.get(`client-${merchantIndex + 1}`)! : admin,
          validatedAt,
          lockedAt: delivered ? lockedAt : null,
          preparedAt: delivered ? at(day, "04:30") : null,
          deliveredAt: delivered ? deliveredAt : null,
          lines: { create: lines },
        },
      });
      orderCount += 1;
      if (delivered) {
        const list = ordersBySlot.get(merchant.slot) ?? [];
        list.push({ id, latitude: merchant.latitude, longitude: merchant.longitude });
        ordersBySlot.set(merchant.slot, list);
      }
    }

    if (!delivered) continue;
    // Tournées terminées : chaque créneau partagé entre deux livreurs, ordre au plus proche voisin.
    for (const [slotIndex, orders] of ordersBySlot.entries()) {
      const slot = SLOTS[slotIndex as 0 | 1 | 2];
      const halves = [orders.filter((_, i) => i % 2 === 0), orders.filter((_, i) => i % 2 === 1)].filter((half) => half.length);
      for (const [half, stops] of halves.entries()) {
        const driverId = drivers[(slotIndex * 2 + half) % drivers.length]!;
        const ordered = nearestNeighbourOrder(depot, stops);
        await prisma.round.create({
          data: {
            id: `demo_round_${dayKey(day)}_${slotIndex}_${half}`,
            companyId: DEMO_COMPANY_ID,
            date: dbDate(day),
            slotId: slot.id,
            driverId,
            name: `Tournée ${slot.label} · ${half === 0 ? "A" : "B"}`,
            status: "COMPLETED",
            startedAt: at(day, slot.startTime),
            completedAt: at(day, slot.endTime),
            stops: {
              create: ordered.map((stop, index) => ({
                companyId: DEMO_COMPANY_ID,
                orderId: stop.id,
                sequence: index + 1,
                status: "DELIVERED" as const,
                estimatedArrivalAt: at(day, `${slot.startTime.slice(0, 2)}:${pad(Math.min(55, 5 + index * 8))}`),
                deliveredAt: at(day, `${slot.startTime.slice(0, 2)}:${pad(Math.min(59, 8 + index * 8))}`),
              })),
            },
          },
        });
      }
    }
  }
  return orderCount;
}

async function main() {
  const now = new Date();
  const host = (() => {
    try {
      return new URL(process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "").hostname;
    } catch {
      return "";
    }
  })();
  // Garde-fou : la démonstration ne va que sur la base de développement Supabase.
  if (process.env.SEED_ALLOW_ANY_DATABASE !== "1" && !/supabase\.(co|com)$/.test(host)) {
    throw new Error("Seed refusé : base inattendue.");
  }

  await seedReferenceData();
  await seedCompany();
  const productIds = await seedCatalog();
  await seedSlots();
  const merchantIds = await seedMerchants(productIds);
  const userIds = await seedAccounts(merchantIds);
  const orders = await seedOrders(productIds, merchantIds, userIds, now);

  console.log(
    JSON.stringify({
      seeded: true,
      company: DEMO_COMPANY_ID,
      products: productIds.length,
      merchants: merchantIds.length,
      accounts: userIds.size,
      orders,
      credentials: "outputs/comptes-demo.md",
    })
  );
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
