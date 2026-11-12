import { fr } from "@/lib/i18n/fr";

const t = fr.companySettings;

type ZoneState = { id: string; active: boolean; merchantCount: number };

/**
 * RECETTE-V1 (décision de Théo, 11 novembre 2026) : avertir sans bloquer avant de désactiver une tournée
 * qui coupe des clients de la commande. Un client ne voit que les créneaux de sa tournée (CLI) :
 * désactiver la sienne, ou la dernière tournée active, lui retire tout créneau.
 * Renvoie les avertissements à afficher, vide si la désactivation ne gêne personne.
 */
export function zoneDeactivationWarnings(zone: ZoneState, zones: ZoneState[]): string[] {
  if (!zone.active) return [];
  const warnings: string[] = [];
  if (zone.merchantCount > 0) warnings.push(t.deactivateClientsWarning(zone.merchantCount));
  const othersActive = zones.some((other) => other.id !== zone.id && other.active);
  if (!othersActive) warnings.push(t.deactivateLastWarning);
  return warnings;
}
