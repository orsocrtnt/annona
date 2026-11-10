"use client";

import { Button } from "@/components/ui/button";
import { ALLERGENS, allergenSummary, type AllergenCode } from "@/domains/catalog/allergens";
import { fr } from "@/lib/i18n/fr";
import { cn } from "@/lib/utils";

const t = fr.catalog;

interface AllergensFieldProps {
  /** null = non renseignés ; [] = aucun allergène (déclaré). */
  value: AllergenCode[] | null;
  onChange: (value: AllergenCode[] | null) => void;
}

/**
 * Lot 1, demande 3 : l'administrateur coche les allergènes présents parmi les 14 réglementaires, ou
 * déclare « Aucun allergène ». Tout décocher revient à « non renseignés » (jamais « aucun » par défaut).
 */
export function AllergensField({ value, onChange }: AllergensFieldProps) {
  const toggle = (code: AllergenCode) => {
    const current = value ?? [];
    const next = current.includes(code) ? current.filter((item) => item !== code) : [...current, code];
    onChange(next.length === 0 ? null : next);
  };

  return (
    <fieldset className="min-w-0 space-y-2" data-testid="allergens-field">
      <legend className="text-sm font-medium">{t.allergens}</legend>
      <p className="text-xs text-muted-foreground" aria-live="polite" data-testid="allergens-state">{allergenSummary(value)}</p>
      <div className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
        {ALLERGENS.map((allergen) => (
          <label key={allergen.code} className="flex min-h-10 cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4 rounded border-input"
              checked={value?.includes(allergen.code) ?? false}
              onChange={() => toggle(allergen.code)}
            />
            {allergen.label}
          </label>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-pressed={value !== null && value.length === 0}
          className={cn(value !== null && value.length === 0 && "border-primary")}
          onClick={() => onChange([])}
          data-testid="allergens-none"
        >
          {t.noAllergen}
        </Button>
        {value !== null ? (
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>{t.allergensReset}</Button>
        ) : null}
      </div>
    </fieldset>
  );
}
