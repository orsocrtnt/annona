/**
 * DEMO-1 — prêt des environnements de démo : une démo par visiteur, comme sur TutelLiv.
 *
 * Un visiteur reçoit un environnement libre (prêt, expiré ou abandonné), reconstruit à l'heure du moment, et un
 * jeton de prêt aléatoire (cookie). Seule l'empreinte SHA-256 du jeton est gardée : le prêt d'un environnement
 * repris par un autre visiteur cesse aussitôt d'ouvrir ses comptes. Au plus DEMO_MAX_SLOTS environnements.
 *
 * Une démo est rendue (puis reconstruite avant le prêt suivant) quand le visiteur se déconnecte, à la fin de la
 * journée (`demoLeaseExpiry`) ou quand le super admin déconnecte tout le monde (`releaseAllDemoLeases`).
 */
import { createHash, randomBytes } from "node:crypto";
import type { DemoPoolEnvironment } from "@prisma/client";
import { prisma } from "@/services/prisma/client";
import { DEMO_PERSONAS, demoPersonaUserId, demoPoolPrefix } from "@/domains/demo/demo-scenario";
import { provisionDemoEnvironment } from "@/domains/demo/demo-provision.service";
import {
  DEMO_MAX_SLOTS,
  DEMO_PREPARING_STALE_MS,
  demoFreshAfter,
  demoLeaseExpiry,
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
async function claimEnvironment(leaseKeyHash: string | null, now: Date): Promise<{ id: string; slot: number }> {
  const expires = leaseKeyHash ? demoLeaseExpiry(now) : null;
  const staleBefore = new Date(now.getTime() - DEMO_PREPARING_STALE_MS);
  const freshAfter = demoFreshAfter(now);
  const claimed = await prisma.$queryRaw<Array<{ id: string; slot: number }>>`
    UPDATE "demo_pool_environments"
    SET "state" = 'PREPARING', "lease_key_hash" = ${leaseKeyHash}, "leased_at" = ${leaseKeyHash ? now : null},
        "lease_expires_at" = ${expires}, "last_error" = NULL, "updated_at" = ${now}
    WHERE "id" = (
      SELECT "id" FROM "demo_pool_environments"
      WHERE "slot" <= ${DEMO_MAX_SLOTS} AND (
            ("state" = 'READY' AND ("prepared_at" IS NULL OR "prepared_at" <= ${freshAfter}))
         OR ("state" = 'LEASED' AND "lease_expires_at" < ${now})
         OR ("state" = 'PREPARING' AND "updated_at" < ${staleBefore}))
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
          leasedAt: leaseKeyHash ? now : null,
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

/** Vrai si l'environnement a le compte de chaque espace à essayer (`DEMO_PERSONAS`). */
async function hasEveryPersona(slot: number): Promise<boolean> {
  const ids = DEMO_PERSONAS.map((persona) => demoPersonaUserId(slot, persona));
  return (await prisma.user.count({ where: { id: { in: ids } } })) === ids.length;
}

/** Environnement de réserve préparé il y a moins de DEMO_FRESH_MS : prêté tel quel, sans attendre. */
async function leaseFreshEnvironment(leaseKeyHash: string, now: Date) {
  const expires = demoLeaseExpiry(now);
  const freshAfter = demoFreshAfter(now);
  const leased = await prisma.$queryRaw<Array<{ slot: number; company_id: string; lease_expires_at: Date }>>`
    UPDATE "demo_pool_environments"
    SET "state" = 'LEASED', "lease_key_hash" = ${leaseKeyHash}, "leased_at" = ${now},
        "lease_expires_at" = ${expires}, "updated_at" = ${now}
    WHERE "id" = (
      SELECT "id" FROM "demo_pool_environments"
      WHERE "slot" <= ${DEMO_MAX_SLOTS} AND "state" = 'READY' AND "prepared_at" > ${freshAfter}
      ORDER BY "prepared_at" DESC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    RETURNING "slot", "company_id", "lease_expires_at"`;
  return leased[0] ?? null;
}

/**
 * Prépare un environnement de réserve (après un prêt, en tâche de fond) : le prochain visiteur n'attend pas.
 * Rien à faire si une réserve fraîche existe déjà ; sinon reprend un environnement libre ou en ouvre un nouveau.
 */
export async function prepareSpareDemoEnvironment(now = new Date()) {
  const fresh = await prisma.demoPoolEnvironment.count({
    where: { slot: { lte: DEMO_MAX_SLOTS }, state: "READY", preparedAt: { gt: demoFreshAfter(now) } },
  });
  if (fresh > 0) return null;
  let env: { id: string; slot: number };
  try {
    env = await claimEnvironment(null, now);
  } catch (error) {
    if (error instanceof DemoPoolFullError) return null;
    throw error;
  }
  try {
    await provisionDemoEnvironment(env.slot, now);
    await prisma.demoPoolEnvironment.update({
      where: { id: env.id },
      data: { state: "READY", preparedAt: new Date(), leaseKeyHash: null, leasedAt: null, leaseExpiresAt: null },
    });
    return env.slot;
  } catch (error) {
    await prisma.demoPoolEnvironment
      .update({ where: { id: env.id }, data: { state: "READY", preparedAt: null, lastError: String(error).slice(0, 500) } })
      .catch(() => undefined);
    throw error;
  }
}

/**
 * Prête un environnement au visiteur : la réserve fraîche s'il y en a une, sinon réservation, reconstruction à
 * l'heure du moment, puis prêt. Renvoie le jeton à poser en cookie (jamais conservé en clair).
 */
export async function leaseDemoEnvironment(now = new Date()) {
  const token = randomBytes(32).toString("hex");
  const leaseKeyHash = hashDemoLeaseToken(token);
  const fresh = await leaseFreshEnvironment(leaseKeyHash, now);
  if (fresh && (await hasEveryPersona(fresh.slot))) {
    return { token, companyId: fresh.company_id, slot: fresh.slot, expiresAt: fresh.lease_expires_at, ms: 0 };
  }
  // Réserve préparée par une version précédente de la démo (espaces ajoutés depuis, comme le pâtissier et la vente
  // le 24 novembre 2026) : déjà prêtée au visiteur, elle est reconstruite sur place.
  const env = fresh ? { slot: fresh.slot } : await claimEnvironment(leaseKeyHash, now);
  try {
    const { companyId, ms } = await provisionDemoEnvironment(env.slot, now);
    const leased = await prisma.demoPoolEnvironment.update({
      where: { slot: env.slot },
      data: { state: "LEASED", preparedAt: new Date() },
      select: { slot: true, leaseExpiresAt: true },
    });
    return { token, companyId, slot: leased.slot, expiresAt: leased.leaseExpiresAt!, ms };
  } catch (error) {
    // Libéré pour un autre essai ; l'erreur est gardée pour le suivi (jamais montrée au visiteur).
    await prisma.demoPoolEnvironment
      .update({
        where: { slot: env.slot },
        data: { state: "READY", preparedAt: null, leaseKeyHash: null, leasedAt: null, leaseExpiresAt: null, lastError: String(error).slice(0, 500) },
      })
      .catch(() => undefined);
    throw error;
  }
}

/** Environnement rendu : `preparedAt` effacé, car un environnement déjà utilisé n'est jamais une réserve fraîche. */
const RELEASED = { state: "READY", preparedAt: null, leaseKeyHash: null, leasedAt: null, leaseExpiresAt: null } as const;

/**
 * « Quitter la démo » ou déconnexion : l'environnement redevient libre ; il sera reconstruit avant d'être prêté
 * de nouveau.
 */
export async function releaseDemoLease(token: string | null | undefined) {
  if (!isDemoLeaseToken(token)) return;
  await prisma.demoPoolEnvironment.updateMany({ where: { leaseKeyHash: hashDemoLeaseToken(token) }, data: RELEASED });
}

/**
 * « Tout déconnecter » (super admin) : tous les prêts sont rendus d'un coup ; les comptes de démo ouverts cessent
 * aussitôt de s'ouvrir (garde du prêt). Une préparation en cours n'est pas touchée : elle se termine, ou est
 * reprise après DEMO_PREPARING_STALE_MS. Renvoie le nombre de visiteurs déconnectés.
 */
export async function releaseAllDemoLeases(now = new Date()) {
  const [disconnected] = await prisma.$transaction([
    prisma.demoPoolEnvironment.count({ where: { state: "LEASED", leaseExpiresAt: { gt: now } } }),
    prisma.demoPoolEnvironment.updateMany({ where: { state: "LEASED" }, data: RELEASED }),
  ]);
  return { disconnected };
}

export type DemoEnvironmentStatus = "IN_USE" | "PREPARING" | "FREE";

/** État d'un environnement pour le suivi : utilisé (prêt en cours), en préparation, ou libre. */
export function demoEnvironmentStatus(
  env: Pick<DemoPoolEnvironment, "state" | "leaseExpiresAt" | "updatedAt"> | null,
  now = new Date(),
): DemoEnvironmentStatus {
  if (!env) return "FREE";
  if (env.state === "LEASED" && env.leaseExpiresAt !== null && env.leaseExpiresAt.getTime() > now.getTime()) return "IN_USE";
  if (env.state === "PREPARING" && env.updatedAt.getTime() >= now.getTime() - DEMO_PREPARING_STALE_MS) return "PREPARING";
  return "FREE";
}

export type DemoEnvironmentRow = {
  slot: number;
  status: DemoEnvironmentStatus;
  leasedAt: Date | null;
  leaseExpiresAt: Date | null;
};

/** Suivi des démos (super admin) : les DEMO_MAX_SLOTS environnements, ouverts ou non, sans donnée de visiteur. */
export async function listDemoEnvironments(now = new Date()): Promise<DemoEnvironmentRow[]> {
  const rows = await prisma.demoPoolEnvironment.findMany({
    where: { slot: { lte: DEMO_MAX_SLOTS } },
    select: { slot: true, state: true, leasedAt: true, leaseExpiresAt: true, updatedAt: true },
  });
  return Array.from({ length: DEMO_MAX_SLOTS }, (_, index) => {
    const env = rows.find((row) => row.slot === index + 1) ?? null;
    const status = demoEnvironmentStatus(env, now);
    const inUse = status === "IN_USE";
    return { slot: index + 1, status, leasedAt: inUse ? env!.leasedAt : null, leaseExpiresAt: inUse ? env!.leaseExpiresAt : null };
  });
}
