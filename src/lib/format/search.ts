/**
 * Recherche tolérante (lot 1, demande 7) : ni les majuscules ni les accents ne comptent
 * (« eclair » trouve « Éclair au chocolat », « BAG » trouve « Baguette »).
 */
export function foldForSearch(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("fr").trim();
}

/** Le nom contient-il la saisie ? Une saisie vide garde tout. */
export function nameMatches(name: string, query: string): boolean {
  const needle = foldForSearch(query);
  return needle === "" || foldForSearch(name).includes(needle);
}
