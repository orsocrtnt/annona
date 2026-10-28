"use client";

import { Check, Monitor, Moon, Sun } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItemIndicator,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { isThemePreference, type ThemePreference } from "@/lib/theme";
import { cn } from "@/lib/utils";

import { useThemePreference } from "./use-theme-preference";

const OPTIONS: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: "system", label: "Système", icon: Monitor },
  { value: "light", label: "Clair", icon: Sun },
  { value: "dark", label: "Sombre", icon: Moon },
];

/** Groupe d'options à placer dans un DropdownMenuContent (menu du thème, menu mobile de navigation). */
export function ThemeRadioGroup() {
  const { preference, setPreference } = useThemePreference();
  return (
    <>
      <DropdownMenuLabel className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
        Affichage
      </DropdownMenuLabel>
      <DropdownMenuRadioGroup
        value={preference}
        onValueChange={(value) => {
          if (isThemePreference(value)) setPreference(value);
        }}
      >
        {OPTIONS.map(({ value, label, icon: Icon }) => (
          <DropdownMenuRadioItem key={value} value={value} className="min-h-11 cursor-pointer rounded-xl px-3 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
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

export function ThemeToggle({ className }: { className?: string }) {
  const { preference } = useThemePreference();
  const Current = preference === "dark" ? Moon : preference === "light" ? Sun : Monitor;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          data-testid="theme-toggle"
          aria-label="Changer le thème d’affichage"
          className={cn(
            "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            className
          )}
        >
          <Current className="h-4 w-4" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-48 rounded-2xl p-2">
        <ThemeRadioGroup />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
