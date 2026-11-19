"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import type { ShopPriceBoard, ShopPriceEntry, ShopPriceInput } from "@/domains/shop/shop-prices.service";
import { centsToInput } from "@/lib/format/money";
import { parseEurosToCents } from "@/lib/validations/catalog";

export type { ShopPriceBoard, ShopPriceEntry, ShopPriceInput };

const keyOf = (entry: Pick<ShopPriceEntry, "productId" | "sizeId">) => `${entry.productId}|${entry.sizeId ?? ""}`;

interface Draft {
  sold: boolean;
  price: string;
}

/**
 * Lot 2, demande 4 — tableau des prix boutique (TTC) d'une boutique : pour chaque produit, et chaque taille d'un
 * gros gâteau, « vendu à ce prix » ou « non vendu ». Les nouveaux produits (« Nouveau produit, prix à saisir »)
 * viennent en premier. Utilisé par la responsable (tablette, avec son code) et par l'administrateur.
 */
export function PriceBoard({
  board,
  saving,
  onSave,
}: {
  board: ShopPriceBoard;
  saving: boolean;
  onSave: (prices: ShopPriceInput[]) => void;
}) {
  const initial = useMemo(
    () =>
      new Map(
        board.entries.map((entry) => [keyOf(entry), { sold: entry.status !== "NOT_SOLD", price: entry.priceCents === null ? "" : centsToInput(entry.priceCents) }])
      ),
    [board]
  );
  const [drafts, setDrafts] = useState<Map<string, Draft>>(initial);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "new">(board.newCount > 0 ? "new" : "all");
  const shown = board.entries.filter((entry) => filter === "all" || entry.status === "NEW");

  const set = (key: string, change: Partial<Draft>) =>
    setDrafts((current) => new Map(current).set(key, { ...(current.get(key) ?? { sold: true, price: "" }), ...change }));

  const save = () => {
    const changed: ShopPriceInput[] = [];
    for (const entry of board.entries) {
      const key = keyOf(entry);
      const draft = drafts.get(key);
      const before = initial.get(key);
      if (!draft || !before) continue;
      // Un nouveau produit laissé vide reste « à saisir » ; seules les lignes changées partent.
      if (entry.status === "NEW" && draft.sold && !draft.price.trim()) continue;
      if (entry.status !== "NEW" && draft.sold === before.sold && draft.price === before.price) continue;
      const priceCents = draft.sold ? parseEurosToCents(draft.price) : null;
      if (draft.sold && (priceCents === null || priceCents <= 0)) {
        setError(`Prix invalide pour ${entry.productName}${entry.servings ? ` (${entry.servings} pers.)` : ""} : par exemple 4,50.`);
        return;
      }
      changed.push({ productId: entry.productId, sizeId: entry.sizeId, sold: draft.sold, priceCents });
    }
    if (changed.length === 0) {
      setError("Aucun changement à enregistrer.");
      return;
    }
    setError(null);
    onSave(changed);
  };

  return (
    <div className="space-y-4" data-testid="price-board">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" variant={filter === "new" ? "brand" : "outline"} onClick={() => setFilter("new")}>
          Nouveaux produits ({board.newCount})
        </Button>
        <Button type="button" size="sm" variant={filter === "all" ? "brand" : "outline"} onClick={() => setFilter("all")}>
          Tous les produits ({board.entries.length})
        </Button>
      </div>
      {shown.length === 0 ? (
        <p className="rounded-xl border border-dashed p-6 text-center text-muted-foreground">Aucun nouveau produit : tous les prix sont saisis.</p>
      ) : (
        <ul className="divide-y rounded-xl border">
          {shown.map((entry) => {
            const key = keyOf(entry);
            const draft = drafts.get(key) ?? { sold: true, price: "" };
            const label = `${entry.productName}${entry.servings ? ` · ${entry.servings} personnes` : ""}`;
            return (
              <li key={key} className="flex flex-wrap items-center gap-3 px-3 py-3" data-testid={`price-${label}`}>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{label}</p>
                  <p className="text-xs text-muted-foreground">
                    {entry.categoryName} · {entry.family === "PASTRY" ? "Pâtisserie" : "Pain"} · {entry.unit}
                  </p>
                  {entry.status === "NEW" ? <Badge variant="warning" className="mt-1">Nouveau produit, prix à saisir</Badge> : null}
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <Switch checked={draft.sold} onCheckedChange={(sold) => set(key, { sold })} aria-label={`${label} vendu dans cette boutique`} />
                  {draft.sold ? "Vendu" : "Non vendu"}
                </label>
                <div className="flex items-center gap-1">
                  <Input
                    inputMode="decimal"
                    className="h-11 w-28 text-right text-base tabular-nums"
                    placeholder="0,00"
                    disabled={!draft.sold}
                    value={draft.price}
                    onChange={(event) => set(key, { price: event.target.value })}
                    aria-label={`Prix boutique de ${label} (€ TTC)`}
                  />
                  <span className="text-sm text-muted-foreground">€ TTC</span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {error ? <p role="alert" className="text-sm text-error">{error}</p> : null}
      <div className="flex justify-end">
        <Button type="button" variant="brand" size="lg" loading={saving} onClick={save}>
          Enregistrer les prix
        </Button>
      </div>
    </div>
  );
}
