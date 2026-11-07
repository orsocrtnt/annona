"use client";

import { Input } from "@/components/ui/input";
import { addDaysToDateKey, shortDeliveryDateLabel } from "@/lib/format/delivery-date";
import { cn } from "@/lib/utils";

/** Jour civil à Paris (AAAA-MM-JJ), décalé de `days` jours. */
export function parisDateKey(days = 0, now = new Date()): string {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(now);
  return addDaysToDateKey(today, days);
}

interface DeliveryDayPickerProps {
  value: string;
  onChange: (date: string) => void;
  label: string;
  shortcuts: Array<{ days: number; label: string }>;
  /** Cibles tactiles plus grandes (tablette du boulanger). */
  large?: boolean;
}

/** Choix du jour de livraison : raccourcis (aujourd'hui, demain…) et date libre. */
export function DeliveryDayPicker({ value, onChange, label, shortcuts, large = false }: DeliveryDayPickerProps) {
  return (
    <fieldset className="flex flex-wrap items-center gap-2">
      <legend className="sr-only">{label}</legend>
      {shortcuts.map((shortcut) => {
        const date = parisDateKey(shortcut.days);
        const selected = date === value;
        return (
          <button
            key={shortcut.days}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(date)}
            className={cn(
              "rounded-full border px-4 font-medium transition-colors",
              large ? "min-h-12 text-base" : "min-h-10 text-sm",
              selected ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-muted"
            )}
          >
            {shortcut.label}
            <span className={cn("ml-2 font-normal", selected ? "opacity-90" : "text-muted-foreground")}>{shortDeliveryDateLabel(date)}</span>
          </button>
        );
      })}
      <Input
        type="date"
        aria-label={label}
        value={value}
        onChange={(event) => event.target.value && onChange(event.target.value)}
        className={cn("w-auto", large && "h-12 text-base")}
      />
    </fieldset>
  );
}
