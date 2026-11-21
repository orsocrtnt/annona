interface ShelfLine {
  family: "BREAD" | "PASTRY";
  categoryName: string;
}

/**
 * RETOURS-2 (Théo, 21 novembre) : sur la tablette Vente, la réception du matin et la clôture du soir sont classées
 * par rayon. Titre de famille (« Pâtisserie », « Boulangerie ») quand elle change, puis titre de catégorie
 * (« Pains », « Spéciaux », « Gâteaux secs »…). Les lignes arrivent déjà triées par le serveur (`byShelf`).
 */
export function ShelfHeading({ lines, index }: { lines: readonly ShelfLine[]; index: number }) {
  const line = lines[index]!;
  const previous = index > 0 ? lines[index - 1] : undefined;
  const newFamily = !previous || previous.family !== line.family;
  const newCategory = newFamily || previous!.categoryName !== line.categoryName;
  if (!newCategory) return null;
  return (
    <li className="list-none pt-4 first:pt-0">
      {newFamily ? (
        <p className="text-xl font-semibold tracking-tight" data-testid={`shelf-family-${line.family}`}>
          {line.family === "PASTRY" ? "Pâtisserie" : "Boulangerie"}
        </p>
      ) : null}
      {line.categoryName ? (
        <p className="mt-1 border-b pb-1 text-sm font-semibold uppercase tracking-wide text-muted-foreground" data-testid={`shelf-category-${line.categoryName}`}>
          {line.categoryName}
        </p>
      ) : null}
    </li>
  );
}
