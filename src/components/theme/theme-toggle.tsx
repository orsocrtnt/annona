"use client";

import { Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";

import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { resolveTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

import { useThemePreference } from "./use-theme-preference";

const DARK_QUERY = "(prefers-color-scheme: dark)";

function subscribeSystemTheme(onChange: () => void) {
  const media = window.matchMedia(DARK_QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

/** Bascule Clair ↔ Sombre en un clic, à partir du thème réellement affiché (« système » compris). */
function useThemeSwitch() {
  const { preference, setPreference } = useThemePreference();
  const prefersDark = useSyncExternalStore(subscribeSystemTheme, () => window.matchMedia(DARK_QUERY).matches, () => false);
  const effective = resolveTheme(preference, prefersDark);
  return { isDark: effective === "dark", toggle: () => setPreference(effective === "dark" ? "light" : "dark") };
}

export function ThemeToggle({ className }: { className?: string }) {
  const { isDark, toggle } = useThemeSwitch();
  const Icon = isDark ? Sun : Moon;

  return (
    <button
      type="button"
      data-testid="theme-toggle"
      aria-label={isDark ? "Passer en mode clair" : "Passer en mode sombre"}
      aria-pressed={isDark}
      onClick={toggle}
      className={cn(
        "theme-control inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className
      )}
    >
      <Icon className="h-4 w-4" aria-hidden />
    </button>
  );
}

/** Même bascule, sous forme d'entrée du menu mobile de navigation. */
export function ThemeMenuItem() {
  const { isDark, toggle } = useThemeSwitch();
  const Icon = isDark ? Sun : Moon;

  return (
    <DropdownMenuItem
      data-testid="theme-menu-item"
      onSelect={toggle}
      className="theme-control min-h-11 cursor-pointer rounded-xl px-3 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
    >
      <Icon className="h-4 w-4" aria-hidden />
      <span>{isDark ? "Mode clair" : "Mode sombre"}</span>
    </DropdownMenuItem>
  );
}
