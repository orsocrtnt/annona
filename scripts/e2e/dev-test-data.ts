import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { deflateSync } from "node:zlib";
import { PrismaClient } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";
import ws from "ws";
import { validateDevEnvironment } from "../env2/verify-dev-env";

/**
 * Données de test E2E sur la base de développement (ENV-2), rejouables et identifiables.
 * Tout ce qui est créé porte un identifiant fixe `e2e-data-*` et une référence `E2E-DATA-*` ;
 * `cleanup` ne supprime que ces identifiants (jamais par motif large). Prérequis : les comptes de
 * `npm run e2e:role-accounts -- setup` (entreprises A/B de facturation, entreprise modèle, livreur).
 *
 *   npm run e2e:test-data -- seed     # idempotent ; écrit outputs/e2e-test-data.json
 *   npm run e2e:test-data -- cleanup  # supprime exactement ce que seed a créé
 *
 * Aucune donnée réelle : e-mails en `.invalid` (non routables), noms fictifs préfixés « E2E ».
 */
export const TEST_DATA_MANIFEST = resolve("outputs/e2e-test-data.json");

const POD_BUCKET = "delivery-pods";
const ACCOUNT_EMAILS = {
  billingA: "e2e-role-billing-a@tutelliv.fr",
  billingB: "e2e-role-billing-b@tutelliv.fr",
  dispatcher: "e2e-role-dispatcher@tutelliv.fr",
  driver: "e2e-role-driver@tutelliv.fr",
} as const;

const ID = {
  orderA: "e2e-data-order-a",
  orderB: "e2e-data-order-b",
  orderDelivered: "e2e-data-order-delivered",
  orderMission: "e2e-data-order-mission",
  invoiceAOverdue: "e2e-data-invoice-a-overdue",
  invoiceAPending: "e2e-data-invoice-a-pending",
  invoiceAPaid: "e2e-data-invoice-a-paid",
  invoiceBPending: "e2e-data-invoice-b-pending",
  invoiceBOverdue: "e2e-data-invoice-b-overdue",
  deliveryDelivered: "e2e-data-delivery-delivered",
  deliveryMission: "e2e-data-delivery-mission",
} as const;
const ORDER_IDS = [ID.orderA, ID.orderB, ID.orderDelivered, ID.orderMission];
const INVOICE_IDS = [ID.invoiceAOverdue, ID.invoiceAPending, ID.invoiceAPaid, ID.invoiceBPending, ID.invoiceBOverdue];
const DELIVERY_IDS = [ID.deliveryDelivered, ID.deliveryMission];
const CLIENT_IDS = { a: "e2e-data-client-a", b: "e2e-data-client-b" } as const;

const DAY = 86_400_000;
const prisma = new PrismaClient();

/** Upsert qui réapplique TOUS les champs au rejeu (société, statut, échéance…) : jamais de valeur périmée. */
function same<T extends { id: string }>(create: T) {
  const { id, ...update } = create;
  // Cast : les littéraux de statut sont élargis en string ici ; Prisma valide la forme à l'exécution.
  return { where: { id }, update, create } as never;
}

function supabaseAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
    realtime: { transport: ws as never },
  });
}

/** PNG valide (RGB, dégradé) généré sans dépendance : accepté par les contrôles de preuve et par pdf-lib. */
function makePng(width: number, height: number, pixel: (x: number, y: number) => [number, number, number]) {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buffer: Buffer) => {
    let c = 0xffffffff;
    for (const byte of buffer) c = crcTable[(c ^ byte) & 0xff]! ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Buffer) => {
    const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const sum = Buffer.alloc(4);
    sum.writeUInt32BE(crc(body));
    return Buffer.concat([length, body, sum]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 2;
  const rows: Buffer[] = [];
  for (let y = 0; y < height; y++) {
    const row = Buffer.alloc(1 + width * 3);
    for (let x = 0; x < width; x++) row.set(pixel(x, y), 1 + x * 3);
    rows.push(row);
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(Buffer.concat(rows))),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const photoPng = () => makePng(160, 120, (x, y) => [40 + x, 120 + (y >> 1), 90]);
const signaturePng = () =>
  makePng(320, 120, (x, y) => (Math.abs(y - (60 + Math.round(30 * Math.sin(x / 18)))) < 3 ? [20, 20, 60] : [255, 255, 255]));

/** Chemins déterministes (compatibles avec les contrôles de src/lib/storage/pod.ts) : un rejeu écrase, ne duplique pas. */
const photoPath = (companyId: string) => `${companyId}/${ID.deliveryDelivered}-1.png`;
const signaturePath = (companyId: string) => `${companyId}/${ID.deliveryDelivered}-sig-1-00000000-0000-4000-8000-0000000000e2.png`;

async function companyOf(email: string) {
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, companyId: true } });
  if (!user?.companyId) throw new Error(`ROLE_ACCOUNTS_REQUIRED:${email} (lancer npm run e2e:role-accounts -- setup)`);
  return { userId: user.id, companyId: user.companyId };
}

async function ensureBucket(admin: ReturnType<typeof supabaseAdmin>) {
  const { data, error } = await admin.storage.listBuckets();
  if (error) throw new Error("POD_STORAGE_UNAVAILABLE");
  const bucket = data?.find((entry) => entry.name === POD_BUCKET);
  if (bucket?.public) throw new Error("POD_STORAGE_PUBLIC");
  if (!bucket) {
    const created = await admin.storage.createBucket(POD_BUCKET, { public: false, fileSizeLimit: 5 * 1024 * 1024, allowedMimeTypes: ["image/jpeg", "image/png"] });
    if (created.error) throw new Error("POD_STORAGE_UNAVAILABLE");
  }
}

async function seed() {
  const admin = supabaseAdmin();
  const a = await companyOf(ACCOUNT_EMAILS.billingA);
  const b = await companyOf(ACCOUNT_EMAILS.billingB);
  const dispatcher = await companyOf(ACCOUNT_EMAILS.dispatcher);
  const driver = await companyOf(ACCOUNT_EMAILS.driver);
  if (a.companyId === b.companyId) throw new Error("BILLING_COMPANIES_NOT_DISTINCT");
  if (driver.companyId !== dispatcher.companyId) throw new Error("DRIVER_COMPANY_MISMATCH");
  const now = Date.now();

  // Clients fictifs (sans compte de connexion) : les factures et le Factur-X exigent un client rattaché.
  const clientRole = await prisma.role.findUnique({ where: { slug: "client" }, select: { id: true } });
  if (!clientRole) throw new Error("ROLE_MISSING:client");
  for (const [key, companyId] of [["a", a.companyId], ["b", b.companyId]] as const) {
    await prisma.user.upsert(same({
        id: CLIENT_IDS[key],
        authId: `e2e-data-auth-${key}`,
        email: `e2e-client-${key}@example.invalid`,
        firstName: `E2E Client`,
        lastName: key.toUpperCase(),
        roleId: clientRole.id,
        companyId,
        status: "ACTIVE",
      }));
  }

  const order = (id: string, companyId: string, status: "INVOICED" | "DELIVERED" | "IN_DELIVERY", email: string, extra: object = {}) =>
    prisma.order.upsert(same({
        id,
        reference: id.toUpperCase(),
        status,
        totalAmount: 120,
        companyId,
        customerEmail: email,
        shippingAddress: "1 rue des Tests",
        shippingCity: "Paris",
        shippingPostalCode: "75001",
        notes: "Donnée de test E2E — supprimable",
        ...extra,
      }));
  const invoice = (id: string, companyId: string, orderId: string, status: "PENDING" | "OVERDUE" | "PAID", dueInDays: number, amount: number, customerId: string) =>
    prisma.invoice.upsert(same({
        id,
        reference: id.toUpperCase(),
        status,
        amount,
        lineItems: [{ label: "Prestation E2E", quantity: 1, unitPrice: amount }],
        notes: "Donnée de test E2E — supprimable",
        dueDate: new Date(now + dueInDays * DAY),
        paidAt: status === "PAID" ? new Date(now - 2 * DAY) : null,
        companyId,
        orderId,
        customerId,
      }));

  await order(ID.orderA, a.companyId, "INVOICED", "e2e-client-a@example.invalid", { customerId: CLIENT_IDS.a });
  await order(ID.orderB, b.companyId, "INVOICED", "e2e-client-b@example.invalid", { customerId: CLIENT_IDS.b });
  await invoice(ID.invoiceAOverdue, a.companyId, ID.orderA, "OVERDUE", -20, 120, CLIENT_IDS.a);
  await invoice(ID.invoiceAPending, a.companyId, ID.orderA, "PENDING", 15, 80, CLIENT_IDS.a);
  await invoice(ID.invoiceAPaid, a.companyId, ID.orderA, "PAID", -5, 60, CLIENT_IDS.a);
  await invoice(ID.invoiceBPending, b.companyId, ID.orderB, "PENDING", 15, 90, CLIENT_IDS.b);
  await invoice(ID.invoiceBOverdue, b.companyId, ID.orderB, "OVERDUE", -10, 110, CLIENT_IDS.b);

  // Livraison terminée avec preuve complète (photo, signature, nom du réceptionnaire).
  await ensureBucket(admin);
  const photo = photoPath(dispatcher.companyId);
  const signature = signaturePath(dispatcher.companyId);
  for (const [path, bytes] of [[photo, photoPng()], [signature, signaturePng()]] as const) {
    const { error } = await admin.storage.from(POD_BUCKET).upload(path, bytes, { contentType: "image/png", upsert: true });
    if (error) throw new Error("POD_UPLOAD_FAILED");
  }
  await order(ID.orderDelivered, dispatcher.companyId, "DELIVERED", "e2e-client-pod@example.invalid");
  const done = new Date(now - 3_600_000);
  await prisma.delivery.upsert(same({
      id: ID.deliveryDelivered,
      reference: "E2E-DATA-DELIVERED",
      status: "DELIVERED",
      address: "1 rue des Tests",
      city: "Paris",
      postalCode: "75001",
      companyId: dispatcher.companyId,
      orderId: ID.orderDelivered,
      driverId: driver.userId,
      driverName: "Livreur E2E",
      missionAcceptedAt: new Date(now - 2 * 3_600_000),
      missionStartedAt: new Date(now - 2 * 3_600_000),
      completedAt: done,
      podOutcome: "DELIVERED",
      podPhotoPath: photo,
      podSignaturePath: signature,
      podRecipientName: "E2E Mme Martin",
      podCapturedAt: done,
      podLatitude: 48.8566,
      podLongitude: 2.3522,
      podPositionAt: done,
    }));

  // Mission en cours de livraison, affectée au livreur de recette (ouvre la fenêtre de preuve).
  await order(ID.orderMission, dispatcher.companyId, "IN_DELIVERY", "e2e-client-mission@example.invalid");
  await prisma.delivery.upsert(same({
      id: ID.deliveryMission,
      reference: "E2E-DATA-MISSION",
      status: "IN_DELIVERY",
      address: "2 rue des Tests",
      city: "Paris",
      postalCode: "75002",
      companyId: dispatcher.companyId,
      orderId: ID.orderMission,
      driverId: driver.userId,
      driverName: "Livreur E2E",
      missionAcceptedAt: new Date(now - 3_600_000),
      missionStartedAt: new Date(now - 1_800_000),
    }));

  const manifest = {
    companies: { a: a.companyId, b: b.companyId, template: dispatcher.companyId },
    invoices: {
      a: { overdue: ID.invoiceAOverdue, pending: ID.invoiceAPending, paid: ID.invoiceAPaid, orderId: ID.orderA },
      b: { overdue: ID.invoiceBOverdue, pending: ID.invoiceBPending, orderId: ID.orderB },
    },
    deliveries: {
      delivered: { id: ID.deliveryDelivered, reference: "E2E-DATA-DELIVERED", recipientName: "E2E Mme Martin" },
      inDelivery: { id: ID.deliveryMission, reference: "E2E-DATA-MISSION" },
    },
  };
  mkdirSync(dirname(TEST_DATA_MANIFEST), { recursive: true });
  writeFileSync(TEST_DATA_MANIFEST, JSON.stringify(manifest, null, 2));
  chmodSync(TEST_DATA_MANIFEST, 0o600);
  console.log(JSON.stringify({ passed: true, orders: ORDER_IDS.length, invoices: INVOICE_IDS.length, deliveries: DELIVERY_IDS.length, manifest: "outputs/e2e-test-data.json" }));
}

async function cleanup() {
  const admin = supabaseAdmin();
  const deliveries = await prisma.delivery.findMany({ where: { id: { in: DELIVERY_IDS } }, select: { companyId: true } });
  const companyIds = new Set(deliveries.map((delivery) => delivery.companyId));
  // Seed interrompu avant la livraison : les fichiers déjà envoyés se retrouvent via la société du dispatcher de recette.
  const dispatcher = await prisma.user.findUnique({ where: { email: ACCOUNT_EMAILS.dispatcher }, select: { companyId: true } });
  if (dispatcher?.companyId) companyIds.add(dispatcher.companyId);
  if (existsSync(TEST_DATA_MANIFEST)) {
    try {
      const manifest = JSON.parse(readFileSync(TEST_DATA_MANIFEST, "utf8")) as { companies?: { template?: string } };
      if (manifest.companies?.template) companyIds.add(manifest.companies.template);
    } catch {
      // manifeste illisible : les livraisons en base suffisent
    }
  }
  const paths = [...companyIds].flatMap((companyId) => [photoPath(companyId), signaturePath(companyId)]);
  if (paths.length) {
    const { error } = await admin.storage.from(POD_BUCKET).remove(paths);
    if (error && !/not found/i.test(error.message)) throw new Error("POD_REMOVE_FAILED");
  }
  // Les relances jouées par les tests créent des tâches d'opération rattachées à nos factures.
  const reminders = await prisma.invoiceReminder.findMany({ where: { invoiceId: { in: INVOICE_IDS } }, select: { operationJobId: true } });
  const jobIds = reminders.flatMap((reminder) => (reminder.operationJobId ? [reminder.operationJobId] : []));
  await prisma.invoiceReminder.deleteMany({ where: { invoiceId: { in: INVOICE_IDS } } });
  if (jobIds.length) await prisma.operationJob.deleteMany({ where: { id: { in: jobIds } } });
  const invoices = await prisma.invoice.deleteMany({ where: { id: { in: INVOICE_IDS } } });
  const orders = await prisma.order.deleteMany({ where: { id: { in: ORDER_IDS } } }); // supprime les livraisons en cascade
  const clients = await prisma.user.deleteMany({ where: { id: { in: Object.values(CLIENT_IDS) } } });
  if (existsSync(TEST_DATA_MANIFEST)) rmSync(TEST_DATA_MANIFEST);
  console.log(JSON.stringify({ passed: true, removed: { clients: clients.count, invoices: invoices.count, orders: orders.count, storageObjects: paths.length } }));
}

async function verifyClean() {
  const [orders, invoices, deliveries] = await Promise.all([
    prisma.order.count({ where: { id: { in: ORDER_IDS } } }),
    prisma.invoice.count({ where: { id: { in: INVOICE_IDS } } }),
    prisma.delivery.count({ where: { id: { in: DELIVERY_IDS } } }),
  ]);
  const clients = await prisma.user.count({ where: { id: { in: Object.values(CLIENT_IDS) } } });
  const left = await prisma.order.count({ where: { reference: { startsWith: "E2E-DATA-" } } });
  console.log(JSON.stringify({ passed: orders + invoices + deliveries + clients + left === 0, orders, invoices, deliveries, clients, referencesLeft: left }));
}

async function main() {
  const command = process.argv[2];
  if (command !== "seed" && command !== "cleanup" && command !== "check-clean") throw new Error("USAGE: seed | cleanup | check-clean");
  const errors = validateDevEnvironment(process.env);
  if (errors.length) throw new Error(`DEV_ENVIRONMENT_REQUIRED:${errors.join(",")}`);
  await (command === "seed" ? seed() : command === "cleanup" ? cleanup() : verifyClean());
}

main()
  .catch((error) => {
    // Code seulement : les erreurs Prisma peuvent citer des valeurs (e-mails).
    console.error(error instanceof Error ? error.message.split("\n")[0]!.slice(0, 120) : "FAILED");
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
