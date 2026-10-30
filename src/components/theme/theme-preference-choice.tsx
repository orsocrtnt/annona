"use client";

import { Check, Monitor, Moon, Sun } from "lucide-react";

import {
  DropdownMenuItemIndicator,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
import { isThemePreference, type ThemePreference } from "@/lib/theme";
import { cn } from "@/lib/utils";

import { useThemePreference } from "./use-theme-preference";

/**
 * Choix explicite à trois options. La barre garde la bascule en un clic (ThemeToggle) ; ce choix complet,
 * placé dans le menu du compte ou la page Profil, permet de revenir à « Système » (suivre l'appareil).
 */
const OPTIONS: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: "system", label: "Système", icon: Monitor },
  { value: "light", label: "Clair", icon: Sun },
  { value: "dark", label: "Sombre", icon: Moon },
];

/** Groupe d'options à placer dans un DropdownMenuContent (menu du compte). */
export function ThemeRadioGroup() {
  const { preference, setPreference } = useThemePreference();
  return (
    <>
      <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">Affichage</DropdownMenuLabel>
      <DropdownMenuRadioGroup
        value={preference}
        onValueChange={(value) => {
          if (isThemePreference(value)) setPreference(value);
        }}
      >
        {OPTIONS.map(({ value, label, icon: Icon }) => (
          <DropdownMenuRadioItem
            key={value}
            value={value}
            data-testid={`theme-choice-${value}`}
            className="min-h-11 cursor-pointer rounded-xl px-3 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
          >
            <Icon className="h-4 w-4" aria-hidden />
            <span>{label}</span>
            <DropdownMenuItemIndicator className="ml-auto">
              <Check className="h-4 w-4 text-brand" aria-hidden />
            </DropdownMenuItemIndicator>
          </DropdownMenuRadioItem>
        ))}
      </DropdownMenuRadioGroup>
    </>
  );
}

/** Même choix sous forme de champ de page (Profil) : trois boutons radio natifs, flèches du clavier comprises. */
export function ThemePreferenceField({ className }: { className?: string }) {
  const { preference, setPreference } = useThemePreference();
  return (
    <fieldset className={cn("theme-control min-w-0 rounded-2xl border border-border bg-card p-4", className)} data-testid="theme-preference-field">
      {/* Légende flottante : elle reste dans la carte au lieu de chevaucher la bordure du fieldset. */}
      <legend className="float-left w-full text-sm font-semibold">Affichage</legend>
      <p className="clear-left pt-1 text-sm text-muted-foreground">« Système » suit le réglage clair ou sombre de votre appareil.</p>
      <div className="mt-3 grid grid-cols-3 gap-1 rounded-xl bg-muted p-1">
        {OPTIONS.map(({ value, label, icon: Icon }) => (
          <label
            key={value}
            className={cn(
              "flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg px-2 text-sm font-medium text-muted-foreground transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
              preference === value && "bg-card text-foreground shadow-sm"
            )}
          >
            <input
              type="radio"
              name="theme-preference"
              value={value}
              checked={preference === value}
              onChange={() => setPreference(value)}
              className="sr-only"
            />
            <Icon className="h-4 w-4" aria-hidden />
            {label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
