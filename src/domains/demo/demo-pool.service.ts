/**
 * DEMO-1 — prêt des environnements de démo : une démo par visiteur, comme sur TutelLiv.
 *
 * Un visiteur reçoit un environnement libre (prêt, expiré ou abandonné), reconstruit à l'heure du moment, et un
 * jeton de prêt aléatoire (cookie). Seule l'empreinte SHA-256 du jeton est gardée : le prêt d'un environnement
 * repris par un autre visiteur cesse aussitôt d'ouvrir ses comptes. Au plus DEMO_MAX_SLOTS environnements.
 */
import { createHash, randomBytes } from "node:crypto";
import type { DemoPoolEnvironment } from "@prisma/client";
import { prisma } from "@/services/prisma/client";
import { demoPoolPrefix } from "@/domains/demo/demo-scenario";
import { provisionDemoEnvironment } from "@/domains/demo/demo-provision.service";
import {
  DEMO_LEASE_MS,
  DEMO_MAX_SLOTS,
  DEMO_PREPARING_STALE_MS,
  isDemoLeaseToken,
} from "@/lib/demo/demo-constants";

export class DemoPoolFullError extends Error {
  constructor() {
    super("Toutes les démos sont prises pour le moment.");
  }
}

export function hashDemoLeaseToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function demoCompanyIdForSlot(slot: number): string {
  return `${demoPoolPrefix(slot)}company`;
}

type LeaseFields = Pick<DemoPoolEnvironment, "state" | "leaseKeyHash" | "leaseExpiresAt">;

/** Le jeton ouvre-t-il cet environnement maintenant ? (prêté, non expiré, même empreinte). */
export function isDemoLeaseActive(env: LeaseFields | null, token: string | null | undefined, now = new Date()): boolean {
  if (!env || !isDemoLeaseToken(token)) return false;
  return (
    env.state === "LEASED" &&
    env.leaseExpiresAt !== null &&
    env.leaseExpiresAt.getTime() > now.getTime() &&
    env.leaseKeyHash === hashDemoLeaseToken(token)
  );
}

/** Garde des comptes de démo : l'environnement de `companyId` est-il prêté au porteur de ce jeton ? */
export async function hasActiveDemoLease(companyId: string, token: string | null | undefined, now = new Date()) {
  if (!isDemoLeaseToken(token)) return false;
  const env = await prisma.demoPoolEnvironment.findUnique({
    where: { companyId },
    select: { state: true, leaseKeyHash: true, leaseExpiresAt: true },
  });
  return isDemoLeaseActive(env, token, now);
}

/** Environnement prêté au porteur du jeton, s'il l'est encore. */
export async function findDemoLease(token: string | null | undefined, now = new Date()) {
  if (!isDemoLeaseToken(token)) return null;
  const env = await prisma.demoPoolEnvironment.findUnique({ where: { leaseKeyHash: hashDemoLeaseToken(token) } });
  return isDemoLeaseActive(env, token, now) ? env : null;
}

/** Réserve un environnement libre (état PREPARING, prêt déjà posé) ; en crée un s'il en manque. */
async function claimEnvironment(leaseKeyHash: string, now: Date): Promise<{ id: string; slot: number }> {
  const expires = new Date(now.getTime() + DEMO_LEASE_MS);
  const staleBefore = new Date(now.getTime() - DEMO_PREPARING_STALE_MS);
  const claimed = await prisma.$queryRaw<Array<{ id: string; slot: number }>>`
    UPDATE "demo_pool_environments"
    SET "state" = 'PREPARING', "lease_key_hash" = ${leaseKeyHash}, "leased_at" = ${now},
        "lease_expires_at" = ${expires}, "last_error" = NULL, "updated_at" = ${now}
    WHERE "id" = (
      SELECT "id" FROM "demo_pool_environments"
      WHERE "state" = 'READY'
         OR ("state" = 'LEASED' AND "lease_expires_at" < ${now})
         OR ("state" = 'PREPARING' AND "updated_at" < ${staleBefore})
      ORDER BY "slot"
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    RETURNING "id", "slot"`;
  if (claimed[0]) return claimed[0];

  // Aucun environnement libre : on en ouvre un nouveau (le numéro unique départage deux visiteurs simultanés).
  for (let attempt = 0; attempt < 3; attempt++) {
    const last = await prisma.demoPoolEnvironment.aggregate({ _max: { slot: true } });
    const slot = (last._max.slot ?? 0) + 1;
    if (slot > DEMO_MAX_SLOTS) throw new DemoPoolFullError();
    try {
      return await prisma.demoPoolEnvironment.create({
        data: {
          slot,
          companyId: demoCompanyIdForSlot(slot),
          state: "PREPARING",
          leaseKeyHash,
          leasedAt: now,
          leaseExpiresAt: expires,
        },
        select: { id: true, slot: true },
      });
    } catch (error) {
      if ((error as { code?: string }).code !== "P2002") throw error;
    }
  }
  throw new DemoPoolFullError();
}

/**
 * Prête un environnement au visiteur : réservation, reconstruction à l'heure du moment, puis prêt.
 * Renvoie le jeton à poser en cookie (jamais conservé en clair).
 */
export async function leaseDemoEnvironment(now = new Date()) {
  const token = randomBytes(32).toString("hex");
  const leaseKeyHash = hashDemoLeaseToken(token);
  const env = await claimEnvironment(leaseKeyHash, now);
  try {
    const { companyId, ms } = await provisionDemoEnvironment(env.slot, now);
    const leased = await prisma.demoPoolEnvironment.update({
      where: { id: env.id },
      data: { state: "LEASED", preparedAt: new Date() },
      select: { slot: true, leaseExpiresAt: true },
    });
    return { token, companyId, slot: leased.slot, expiresAt: leased.leaseExpiresAt!, ms };
  } catch (error) {
    // Libéré pour un autre essai ; l'erreur est gardée pour le suivi (jamais montrée au visiteur).
    await prisma.demoPoolEnvironment
      .update({
        where: { id: env.id },
        data: { state: "READY", leaseKeyHash: null, leasedAt: null, leaseExpiresAt: null, lastError: String(error).slice(0, 500) },
      })
      .catch(() => undefined);
    throw error;
  }
}

/** « Quitter la démo » : l'environnement redevient libre ; il sera reconstruit au prochain prêt. */
export async function releaseDemoLease(token: string | null | undefined) {
  if (!isDemoLeaseToken(token)) return;
  await prisma.demoPoolEnvironment.updateMany({
    where: { leaseKeyHash: hashDemoLeaseToken(token) },
    data: { state: "READY", leaseKeyHash: null, leasedAt: null, leaseExpiresAt: null },
  });
}
