import type { TableColumn } from "@/types";

export interface MobileCardLayout<T> {
  /** Colonne portée par le titre de la carte (la première colonne qui a un en-tête). */
  title: TableColumn<T> | null;
  /** Colonnes affichées en paires libellé / valeur sous le titre. */
  fields: TableColumn<T>[];
  /** Colonnes sans en-tête (actions, boutons) : en pied de carte, hors de la zone cliquable du titre. */
  actions: TableColumn<T>[];
}

/**
 * Répartit les colonnes d'un tableau en carte pour les écrans étroits (< md).
 * Aucune colonne n'est perdue : `hideOnMobile` ne vaut que pour le tableau, la carte a la place de tout montrer.
 */
export function splitCardColumns<T>(columns: TableColumn<T>[]): MobileCardLayout<T> {
  const labelled = columns.filter((column) => column.header.trim() !== "");
  const actions = columns.filter((column) => column.header.trim() === "");
  const [title = null, ...fields] = labelled;
  return { title, fields, actions };
}

/** Variante rendue : cartes sous 768 px, tableau au-delà. */
export const MOBILE_CARDS_QUERY = "(max-width: 767px)";
export function dataGridVariant(isMobile: boolean): "cards" | "table" {
  return isMobile ? "cards" : "table";
}
