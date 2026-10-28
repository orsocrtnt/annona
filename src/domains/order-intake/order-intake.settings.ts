import { prisma } from "@/services/prisma/client";

export const ORDER_INTAKE_SETTINGS_KEY = "orderIntake";
/** Variable serveur obligatoire ; sans elle la fonction reste indisponible. */
export const ORDER_INTAKE_API_KEY_ENV = "ANTHROPIC_API_KEY";

export interface OrderIntakeSettings {
  enabled: boolean;
}

type SettingsDb = Pick<typeof prisma, "company">;

/** Désactivé par défaut : seule la valeur booléenne `true` active la fonction. */
export function readOrderIntakeSettings(settings: unknown): OrderIntakeSettings {
  const root = settings && typeof settings === "object" ? (settings as Record<string, unknown>) : {};
  const own = root[ORDER_INTAKE_SETTINGS_KEY];
  const enabled = own && typeof own === "object" ? (own as Record<string, unknown>).enabled === true : false;
  return { enabled };
}

export function isOrderIntakeConfigured(env: Record<string, string | undefined> = process.env): boolean {
  return Boolean(env[ORDER_INTAKE_API_KEY_ENV]?.trim());
}

export async function getOrderIntakeSettings(companyId: string, db: SettingsDb = prisma): Promise<OrderIntakeSettings> {
  const company = await db.company.findUnique({ where: { id: companyId }, select: { settings: true } });
  return readOrderIntakeSettings(company?.settings);
}

/**
 * Écrit seulement la clé de la fonction, en une instruction : aucune lecture-réécriture ne peut
 * écraser un autre réglage modifié en même temps. Des réglages absents ou non objets repartent de {}.
 */
export async function setOrderIntakeEnabled(
  companyId: string,
  enabled: boolean,
  db: Pick<typeof prisma, "$executeRaw"> = prisma
) {
  const updated = await db.$executeRaw`
    UPDATE "companies"
    SET "settings" = jsonb_set(
          CASE WHEN jsonb_typeof("settings") = 'object' THEN "settings" ELSE '{}'::jsonb END,
          '{orderIntake}',
          ${JSON.stringify({ enabled })}::jsonb,
          true
        ),
        "updated_at" = CURRENT_TIMESTAMP
    WHERE "id" = ${companyId}`;
  if (updated === 0) throw new Error("COMPANY_NOT_FOUND");
  return { enabled };
}
