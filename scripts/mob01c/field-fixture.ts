/**
 * MOB-01C — entreprise fictive pour l'essai GPS sur téléphone physique, en préproduction.
 *
 *   setup   : crée l'entreprise, un livreur et un administrateur connectables, et des livraisons
 *             STANDARD vers les adresses de MOB01C_ADDRESSES (« rue|code postal|ville;… »).
 *             Un 4e champ facultatif « lat,lng » impose la position, pour un lieu hors de France
 *             que le géocodeur IGN ne sait pas localiser.
 *   watch   : relève toutes les 5 s la dernière position du livreur (la base n'en garde qu'une)
 *             et écrit un journal horodaté, sans coordonnées, dans outputs/mob01c/.
 *   cleanup : supprime uniquement ce que le manifeste désigne, puis vérifie zéro résidu.
 *
 * Les mots de passe ne sont jamais affichés : ils sont écrits dans outputs/mob01c/acces.txt (0600).
 */
import { randomBytes, randomUUID } from "node:crypto";
import { appendFile, chmod, mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { Prisma } from "@prisma/client";
import ws from "ws";
import { prisma } from "@/services/prisma/client";
import { createClientOrder } from "@/domains/order/order.service";
import { assignDeliveryToDriver, getDriverMissions } from "@/domains/delivery/delivery.service";
import { activateManualPilot } from "@/domains/saas/saas.service";
import { trackingService } from "@/domains/tracking/tracking.policy";
import { haversineMeters } from "@/lib/maps/navigation-utils";
import { DEFAULT_BILLING_SETTINGS } from "@/lib/validations/billing-settings";
import { DEFAULT_DISPATCH_SETTINGS } from "@/lib/validations/dispatch-settings";
import { validatePreproductionEnvironment } from "../ci/verify-preproduction-env";

const OUTPUT_DIRECTORY = "outputs/mob01c";
const MANIFEST = `${OUTPUT_DIRECTORY}/fixture.json`;
const ACCESS_FILE = `${OUTPUT_DIRECTORY}/acces.txt`;
const BUCKET = "delivery-pods";
const KEY_PATTERN = /^mob01c-[a-f0-9]{8}$/;
const WATCH_INTERVAL_MS = 5_000;
const GAP_REPORT_SECONDS = 30;
// Capacité par défaut d'un livreur dans les règles de dispatch.
const DELIVERY_COUNT = 3;

type Manifest = {
  version: 1;
  key: string;
  targetRef: string;
  startedAt: string;
  companyId: string;
  driverId: string;
  authUsers: { id: string; email: string }[];
};

type Sample = {
  at: string;
  locationUpdatedAt: string | null;
  ageSeconds: number | null;
  accuracyMeters: number | null;
  movedMeters: number | null;
  serviceActive: boolean;
  deliveries: string[];
};

function assertPreproduction() {
  const errors = validatePreproductionEnvironment(process.env);
  if (errors.length) throw new Error(`PREPRODUCTION_GUARD_FAILED:${errors.join(",")}`);
  if (process.env.EMAIL_DELIVERY_MODE !== "disabled") throw new Error("EMAIL_MUST_BE_DISABLED");
}

function adminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
    realtime: { transport: ws as never },
  });
}

async function readManifest(): Promise<Manifest | null> {
  try {
    const manifest = JSON.parse(await readFile(MANIFEST, "utf8")) as Manifest;
    if (manifest.version !== 1 || !KEY_PATTERN.test(manifest.key) || manifest.targetRef !== process.env.PREPROD_EXPECTED_SUPABASE_REF) {
      throw new Error("FIXTURE_MANIFEST_INVALID");
    }
    return manifest;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

async function writePrivate(path: string, content: string) {
  await mkdir(OUTPUT_DIRECTORY, { recursive: true });
  await writeFile(path, content, { encoding: "utf8", mode: 0o600 });
  await chmod(path, 0o600);
}

function parseAddresses(raw: string | undefined) {
  const addresses = (raw ?? "").split(";").map((entry) => entry.trim()).filter(Boolean).map((entry) => {
    const [street, postalCode, city, position] = entry.split("|").map((part) => part.trim());
    if (!street || !/^\d{5}$/.test(postalCode ?? "") || !city) throw new Error(`ADDRESS_INVALID:${entry}`);
    if (!position) return { street, postalCode: postalCode!, city, coordinates: null };
    const [lat, lng] = position.split(",").map(Number);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat!) > 90 || Math.abs(lng!) > 180) throw new Error(`ADDRESS_POSITION_INVALID:${entry}`);
    return { street, postalCode: postalCode!, city, coordinates: { latitude: lat!, longitude: lng! } };
  });
  if (addresses.length === 0) throw new Error("MOB01C_ADDRESSES_MISSING");
  return addresses;
}

async function roleId(systemRole: "COMPANY_ADMIN" | "CLIENT" | "DRIVER") {
  const role = await prisma.role.findFirst({ where: { systemRole }, select: { id: true } });
  if (!role) throw new Error(`ROLE_MISSING:${systemRole}`);
  return role.id;
}

async function createLoginUser(email: string) {
  // Politique Supabase : minuscule, majuscule et chiffre garantis, quel que soit le tirage.
  const password = `Aa1${randomBytes(12).toString("base64url")}`;
  const { data, error } = await adminClient().auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw new Error(`AUTH_CREATE_FAILED:${error?.message ?? "no-user"}`);
  return { id: data.user.id, email, password };
}

async function assertCanSignIn(email: string, password: string) {
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
    realtime: { transport: ws as never },
  });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`AUTH_SIGN_IN_FAILED:${error.message}`);
  await client.auth.signOut();
}

async function setup() {
  assertPreproduction();
  if (await readManifest()) throw new Error("FIXTURE_ALREADY_EXISTS:run-cleanup-first");
  const addresses = parseAddresses(process.env.MOB01C_ADDRESSES);
  const key = `mob01c-${randomUUID().slice(0, 8)}`;
  const [adminRole, clientRole, driverRole] = await Promise.all([roleId("COMPANY_ADMIN"), roleId("CLIENT"), roleId("DRIVER")]);

  const company = await prisma.company.create({
    data: {
      name: "MOB-01C — essai terrain fictif",
      slug: `${key}-company`,
      status: "TRIAL",
      isDemo: false,
      settings: {
        deliveryCategories: { STANDARD: true, COURIER: false, SPECIAL_MISSION: false },
        billing: DEFAULT_BILLING_SETTINGS,
        dispatchRules: DEFAULT_DISPATCH_SETTINGS,
      },
    },
  });
  const manifest: Manifest = {
    version: 1,
    key,
    targetRef: process.env.PREPROD_EXPECTED_SUPABASE_REF!,
    startedAt: new Date().toISOString(),
    companyId: company.id,
    driverId: "",
    authUsers: [],
  };
  // Écrit avant toute création externe : un échec laisse toujours de quoi nettoyer.
  await writePrivate(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);

  await activateManualPilot({
    companyId: company.id,
    startsAt: new Date(),
    endsAt: new Date(Date.now() + 7 * 86_400_000),
    limits: { admins: 1, drivers: 1, dispatchers: 1, monthlyOrders: 20 },
  });

  const driverLogin = await createLoginUser(`${key}-livreur@example.com`);
  manifest.authUsers.push({ id: driverLogin.id, email: driverLogin.email });
  const adminLogin = await createLoginUser(`${key}-admin@example.com`);
  manifest.authUsers.push({ id: adminLogin.id, email: adminLogin.email });
  await writePrivate(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);

  const [driver, client] = await Promise.all([
    prisma.user.create({ data: { authId: driverLogin.id, email: driverLogin.email, firstName: "Livreur", lastName: "MOB-01C", status: "ACTIVE", companyId: company.id, roleId: driverRole } }),
    prisma.user.create({ data: { authId: `${key}-client`, email: `${key}-client@example.com`, firstName: "Client", lastName: "MOB-01C", status: "ACTIVE", companyId: company.id, roleId: clientRole } }),
    prisma.user.create({ data: { authId: adminLogin.id, email: adminLogin.email, firstName: "Admin", lastName: "MOB-01C", status: "ACTIVE", companyId: company.id, roleId: adminRole } }),
  ]);
  manifest.driverId = driver.id;
  await writePrivate(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);

  const deliveries: { label: string; geocoded: boolean }[] = [];
  for (const [index, address] of Array.from({ length: DELIVERY_COUNT }, (_, i) => addresses[i % addresses.length]!).entries()) {
    const label = `Colis fictif MOB-01C n°${index + 1}`;
    const order = await createClientOrder(
      client.id,
      company.id,
      client.email,
      {
        deliveryCategory: "STANDARD",
        items: [{ name: label, quantity: 1, estimatedPrice: 10 }],
        stops: undefined,
        pickupStops: undefined,
        shippingAddress: address.street,
        shippingCity: address.city,
        shippingPostalCode: address.postalCode,
        requestedDeliveryDate: new Date(Date.now() + 2 * 3_600_000).toISOString(),
        deliveryInstructions: "Essai terrain MOB-01C, aucune remise réelle",
        notes: key,
      },
      { idempotencyKey: `${key}:order:${index}` }
    );
    let delivery = await prisma.delivery.findFirstOrThrow({ where: { orderId: order.id }, select: { id: true, latitude: true } });
    if (address.coordinates) {
      delivery = await prisma.delivery.update({ where: { id: delivery.id }, data: address.coordinates, select: { id: true, latitude: true } });
    }
    await assignDeliveryToDriver(company.id, delivery.id, driver.id, { reason: "Essai terrain MOB-01C" });
    deliveries.push({ label, geocoded: delivery.latitude != null });
  }

  await Promise.all([assertCanSignIn(driverLogin.email, driverLogin.password), assertCanSignIn(adminLogin.email, adminLogin.password)]);
  const missions = await getDriverMissions(driver.id);
  if (missions.length !== DELIVERY_COUNT) throw new Error(`DRIVER_MISSIONS_UNEXPECTED:${missions.length}`);

  await writePrivate(
    ACCESS_FILE,
    [
      `Préproduction : https://${process.env.PREPROD_EXPECTED_APP_HOST}`,
      `Livreur (iPhone) : ${driverLogin.email} / ${driverLogin.password}`,
      `Administrateur (Mac, après la marche) : ${adminLogin.email} / ${adminLogin.password}`,
      "",
    ].join("\n")
  );
  console.log(JSON.stringify({ passed: deliveries.every((entry) => entry.geocoded), key, deliveries, access: ACCESS_FILE }));
  if (!deliveries.every((entry) => entry.geocoded)) {
    console.error("Une adresse n'a pas été localisée : la règle des 150 m ne pourra pas être testée sur cette livraison.");
    process.exitCode = 1;
  }
}

/** Trous entre deux positions reçues, au-delà de `thresholdSeconds`. */
function locationGaps(samples: Pick<Sample, "locationUpdatedAt">[], thresholdSeconds = GAP_REPORT_SECONDS) {
  const updates = [...new Set(samples.map((sample) => sample.locationUpdatedAt).filter((value): value is string => value != null))]
    .map((value) => Date.parse(value))
    .sort((left, right) => left - right);
  const gaps: { from: string; to: string; seconds: number }[] = [];
  for (let index = 1; index < updates.length; index += 1) {
    const seconds = Math.round((updates[index]! - updates[index - 1]!) / 1000);
    if (seconds > thresholdSeconds) {
      gaps.push({ from: new Date(updates[index - 1]!).toISOString(), to: new Date(updates[index]!).toISOString(), seconds });
    }
  }
  return gaps;
}

async function watch() {
  assertPreproduction();
  const manifest = await readManifest();
  if (!manifest?.driverId) throw new Error("FIXTURE_MANIFEST_ABSENT:run-setup-first");
  const journal = `${OUTPUT_DIRECTORY}/journal-${new Date().toISOString().replace(/[:.]/g, "-")}.jsonl`;
  const summaryPath = journal.replace(/\.jsonl$/, "-synthese.json");
  const samples: Sample[] = [];
  let previous: { latitude: number; longitude: number; updatedAt: number } | null = null;
  let stopping = false;
  process.on("SIGINT", () => { stopping = true; });
  console.log(`Relevé toutes les ${WATCH_INTERVAL_MS / 1000} s dans ${journal}. Ctrl+C pour arrêter.`);

  while (!stopping) {
    const [location, driver, deliveries] = await Promise.all([
      prisma.driverLocation.findUnique({ where: { driverId: manifest.driverId } }),
      prisma.user.findUniqueOrThrow({ where: { id: manifest.driverId }, select: { settings: true } }),
      prisma.delivery.findMany({ where: { companyId: manifest.companyId }, orderBy: { createdAt: "asc" }, select: { status: true, podPhotoPath: true } }),
    ]);
    const now = Date.now();
    let movedMeters: number | null = null;
    if (location && previous && location.updatedAt.getTime() !== previous.updatedAt) {
      movedMeters = Math.round(haversineMeters(previous, location));
    }
    if (location && location.updatedAt.getTime() !== previous?.updatedAt) {
      previous = { latitude: location.latitude, longitude: location.longitude, updatedAt: location.updatedAt.getTime() };
    }
    const sample: Sample = {
      at: new Date(now).toISOString(),
      locationUpdatedAt: location?.updatedAt.toISOString() ?? null,
      ageSeconds: location ? Math.round((now - location.updatedAt.getTime()) / 1000) : null,
      accuracyMeters: location?.accuracy != null ? Math.round(location.accuracy) : null,
      movedMeters,
      serviceActive: trackingService(driver.settings).active,
      deliveries: deliveries.map((delivery) => `${delivery.status}${delivery.podPhotoPath ? "+photo" : ""}`),
    };
    samples.push(sample);
    await appendFile(journal, `${JSON.stringify(sample)}\n`, "utf8");
    // Synthèse réécrite à chaque relevé : un Ctrl+C ou une mise en veille ne la perd pas.
    await writeFile(summaryPath, `${JSON.stringify(summarize(samples), null, 2)}\n`, "utf8");
    console.log(`${sample.at.slice(11, 19)}  âge ${sample.ageSeconds ?? "—"} s  précision ${sample.accuracyMeters ?? "—"} m  service ${sample.serviceActive ? "actif" : "arrêté"}  ${sample.deliveries.join(" ")}`);
    await new Promise((resolve) => setTimeout(resolve, WATCH_INTERVAL_MS));
  }
  console.log(JSON.stringify(summarize(samples)));
}

function summarize(samples: Sample[]) {
  return {
    samples: samples.length,
    from: samples[0]?.at ?? null,
    to: samples.at(-1)?.at ?? null,
    positionsReceived: new Set(samples.map((sample) => sample.locationUpdatedAt).filter(Boolean)).size,
    gapsOver30s: locationGaps(samples),
  };
}

async function cleanup() {
  assertPreproduction();
  const manifest = await readManifest();
  if (!manifest) {
    console.log(JSON.stringify({ passed: true, skipped: true, reason: "fixture-manifest-absent" }));
    return;
  }
  const company = await prisma.company.findUnique({ where: { id: manifest.companyId }, select: { id: true, slug: true, isDemo: true } });
  if (company && (company.slug !== `${manifest.key}-company` || company.isDemo)) throw new Error("FIXTURE_COMPANY_GUARD_FAILED");

  if (company) {
    const deliveries = await prisma.delivery.findMany({ where: { companyId: company.id }, select: { podPhotoPath: true } });
    const photos = deliveries.map((delivery) => delivery.podPhotoPath).filter((path): path is string => path?.startsWith(`${company.id}/`) ?? false);
    const { data: listed, error: listError } = await adminClient().storage.from(BUCKET).list(company.id, { limit: 100 });
    if (listError) throw new Error(`FIXTURE_STORAGE_LIST_FAILED:${listError.message}`);
    const paths = [...new Set([...photos, ...(listed ?? []).map((row) => `${company.id}/${row.name}`)])];
    if (paths.length) {
      const { error } = await adminClient().storage.from(BUCKET).remove(paths);
      if (error) throw new Error(`FIXTURE_STORAGE_DELETE_FAILED:${error.message}`);
    }
    await prisma.$transaction(async (tx) => {
      await tx.operationJob.deleteMany({ where: { companyId: company.id } });
      await tx.supportTicket.deleteMany({ where: { companyId: company.id } });
      await tx.invoice.deleteMany({ where: { companyId: company.id } });
      await tx.order.deleteMany({ where: { companyId: company.id } });
      await tx.recurringOrder.deleteMany({ where: { companyId: company.id } });
      await tx.user.deleteMany({ where: { companyId: company.id } });
      await tx.company.delete({ where: { id: company.id } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 10_000, timeout: 60_000 });
  }

  for (const authUser of manifest.authUsers) {
    const { data } = await adminClient().auth.admin.getUserById(authUser.id);
    if (!data.user) continue;
    if (data.user.email?.toLowerCase() !== authUser.email) throw new Error("FIXTURE_AUTH_OWNERSHIP_GUARD_FAILED");
    const { error } = await adminClient().auth.admin.deleteUser(authUser.id);
    if (error) throw new Error(`FIXTURE_AUTH_DELETE_FAILED:${error.message}`);
  }

  const [companies, users, storage] = await Promise.all([
    prisma.company.count({ where: { slug: { startsWith: manifest.key } } }),
    prisma.user.count({ where: { email: { startsWith: manifest.key } } }),
    adminClient().storage.from(BUCKET).list(manifest.companyId, { limit: 1 }),
  ]);
  const authLeft = (await Promise.all(manifest.authUsers.map((user) => adminClient().auth.admin.getUserById(user.id)))).filter((result) => result.data.user).length;
  const residue = { companies, users, authUsers: authLeft, storageObjects: storage.data?.length ?? 0 };
  if (Object.values(residue).some((count) => count !== 0)) throw new Error(`FIXTURE_RESIDUE_DETECTED:${JSON.stringify(residue)}`);
  await unlink(MANIFEST);
  await unlink(ACCESS_FILE).catch(() => undefined);
  console.log(JSON.stringify({ passed: true, clean: true, key: manifest.key, residue }));
}

const commands: Record<string, () => Promise<void>> = { setup, watch, cleanup };
const command = commands[process.argv[2] ?? ""];
if (!command) {
  console.error("Usage : field-fixture.ts setup|watch|cleanup");
  process.exitCode = 1;
} else {
  command()
    .catch((error) => {
      console.error(error instanceof Error ? error.message : "MOB01C_FIXTURE_FAILED");
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
