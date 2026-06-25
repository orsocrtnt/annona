import type { TariffZone } from "@/lib/validations/tariff-settings";

export function findTariffZoneForPostalCode(
  postalCode: string | null | undefined,
  zones: TariffZone[]
): TariffZone | null {
  if (!postalCode) return null;
  const normalized = postalCode.trim();
  return (
    zones.find((zone) =>
      zone.postalCodePrefixes.some((prefix) => normalized.startsWith(prefix.trim()))
    ) ?? null
  );
}
