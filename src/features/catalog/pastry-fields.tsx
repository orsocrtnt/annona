"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import type { ProductRow } from "@/domains/catalog/catalog.types";
import { centsToInput } from "@/lib/format/money";
import { parseEurosToCents } from "@/lib/validations/catalog";

/** Lot 2, demande 3 : saisie d'une pâtisserie (format, tailles, recette) et durée de vente de tout produit. */
export interface PastryFieldsState {
  pastryFormat: "SMALL" | "LARGE";
  sizes: Array<{ servings: string; price: string }>;
  recipe: string;
  shelfLifeDays: string;
}

export function initialPastryFields(product: ProductRow | null): PastryFieldsState {
  return {
    pastryFormat: product?.pastryFormat ?? "SMALL",
    sizes: product?.sizes.length
      ? product.sizes.map((size) => ({ servings: String(size.servings), price: centsToInput(size.restaurantPriceCents) }))
      : [{ servings: "6", price: "" }, { servings: "8", price: "" }, { servings: "10", price: "" }],
    recipe: product?.recipe ?? "",
    shelfLifeDays: String(product?.shelfLifeDays ?? 1),
  };
}

export interface ParsedPastryFields {
  pastryFormat: "SMALL" | "LARGE";
  servings: number[];
  /** Prix restaurant par taille (administrateur) ; vide = à saisir plus tard. */
  sizes: Array<{ servings: number; restaurantPriceCents: number | null }>;
  recipe: string | null;
  shelfLifeDays: number;
}

/** Lit la saisie ; renvoie un message d'erreur en français si elle est invalide. */
export function parsePastryFields(state: PastryFieldsState, withPrices: boolean): ParsedPastryFields | string {
  const shelfLifeDays = Number(state.shelfLifeDays);
  if (!Number.isInteger(shelfLifeDays) || shelfLifeDays < 1 || shelfLifeDays > 60) return "Durée de vente : de 1 à 60 jours (jour de réception compris).";
  const sizes: ParsedPastryFields["sizes"] = [];
  if (state.pastryFormat === "LARGE") {
    for (const size of state.sizes) {
      if (!size.servings.trim() && !size.price.trim()) continue;
      const servings = Number(size.servings);
      if (!Number.isInteger(servings) || servings < 1 || servings > 100) return "Chaque taille : un nombre de parts entre 1 et 100.";
      let restaurantPriceCents: number | null = null;
      if (withPrices && size.price.trim()) {
        restaurantPriceCents = parseEurosToCents(size.price);
        if (restaurantPriceCents === null) return `Prix restaurant invalide pour ${servings} personnes : par exemple 32,00.`;
      }
      sizes.push({ servings, restaurantPriceCents });
    }
    if (sizes.length === 0) return "Un gros gâteau a au moins une taille (par exemple 6, 8 ou 10 personnes).";
    if (new Set(sizes.map((size) => size.servings)).size !== sizes.length) return "Deux tailles ont le même nombre de parts.";
  }
  return {
    pastryFormat: state.pastryFormat,
    servings: sizes.map((size) => size.servings),
    sizes,
    recipe: state.recipe.trim() || null,
    shelfLifeDays,
  };
}

/**
 * Champs pâtisserie. `withPrices` (administrateur) : prix restaurant HT par taille ; le pâtissier ne saisit
 * jamais de prix (demande 3, règle).
 */
export function PastryFields({
  value,
  onChange,
  withPrices,
  showFormat = true,
}: {
  value: PastryFieldsState;
  onChange: (next: PastryFieldsState) => void;
  withPrices: boolean;
  showFormat?: boolean;
}) {
  const set = (change: Partial<PastryFieldsState>) => onChange({ ...value, ...change });
  const setSize = (index: number, change: Partial<{ servings: string; price: string }>) =>
    set({ sizes: value.sizes.map((size, position) => (position === index ? { ...size, ...change } : size)) });
  return (
    <div className="space-y-4" data-testid="pastry-fields">
      {showFormat ? (
        <FormField label="Format" required>
          <div role="radiogroup" aria-label="Format" className="flex flex-wrap gap-2">
            {(["SMALL", "LARGE"] as const).map((format) => (
              <Button
                key={format}
                type="button"
                role="radio"
                aria-checked={value.pastryFormat === format}
                variant={value.pastryFormat === format ? "brand" : "outline"}
                onClick={() => set({ pastryFormat: format })}
              >
                {format === "SMALL" ? "Petite pièce" : "Gros gâteau"}
              </Button>
            ))}
          </div>
        </FormField>
      ) : null}
      {showFormat && value.pastryFormat === "LARGE" ? (
        <FormField label="Tailles proposées" hint={withPrices ? "Nombre de parts, et prix restaurant HT de chaque taille (vide : à saisir plus tard)." : "Nombre de parts de chaque taille. Les prix sont fixés par l'administrateur et les boutiques."} required>
          <div className="space-y-2">
            {value.sizes.map((size, index) => (
              <div key={index} className="flex flex-wrap items-center gap-2" data-testid={`size-${index}`}>
                <Input
                  inputMode="numeric"
                  className="h-10 w-20 text-right tabular-nums"
                  value={size.servings}
                  onChange={(event) => setSize(index, { servings: event.target.value.replace(/\D/g, "") })}
                  aria-label={`Taille ${index + 1} : nombre de parts`}
                />
                <span className="text-sm text-muted-foreground">personnes</span>
                {withPrices ? (
                  <>
                    <Input
                      inputMode="decimal"
                      className="h-10 w-28 text-right tabular-nums"
                      placeholder="Prix à saisir"
                      value={size.price}
                      onChange={(event) => setSize(index, { price: event.target.value })}
                      aria-label={`Prix restaurant HT pour ${size.servings || "?"} personnes`}
                    />
                    <span className="text-sm text-muted-foreground">€ HT</span>
                  </>
                ) : null}
                <Button type="button" size="icon-sm" variant="ghost" aria-label={`Retirer la taille ${size.servings || index + 1}`} onClick={() => set({ sizes: value.sizes.filter((_, position) => position !== index) })}>
                  <Trash2 />
                </Button>
              </div>
            ))}
            <Button type="button" size="sm" variant="outline" onClick={() => set({ sizes: [...value.sizes, { servings: "", price: "" }] })}>
              <Plus className="h-4 w-4" /> Ajouter une taille
            </Button>
          </div>
        </FormField>
      ) : null}
      {showFormat ? (
        <FormField label="Recette" hint="Visible seulement par les pâtissiers et l'administration, jamais par les comptes vente, livreurs ni clients.">
          <textarea
            className="min-h-28 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={value.recipe}
            maxLength={10_000}
            onChange={(event) => set({ recipe: event.target.value })}
            data-testid="product-recipe"
          />
        </FormField>
      ) : null}
      <FormField label="Durée de vente en boutique" hint="Nombre de jours de vente, jour de réception compris (2 = reçu lundi, vendu lundi et mardi)." required>
        <div className="flex items-center gap-2">
          <Input
            inputMode="numeric"
            className="h-10 w-20 text-right tabular-nums"
            value={value.shelfLifeDays}
            onChange={(event) => set({ shelfLifeDays: event.target.value.replace(/\D/g, "") })}
            data-testid="product-shelf-life"
          />
          <span className="text-sm text-muted-foreground">jour(s)</span>
        </div>
      </FormField>
    </div>
  );
}
