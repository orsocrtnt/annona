"use client";

import { useEffect, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { clampQuantity } from "@/features/ordering/cart-store";
import { fr } from "@/lib/i18n/fr";
import { cn } from "@/lib/utils";

interface QuantityStepperProps {
  productName: string;
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  className?: string;
}

/** CLI-04 : boutons − / + (cibles de 44 px) et saisie directe de la quantité. */
export function QuantityStepper({ productName, value, onChange, disabled, className }: QuantityStepperProps) {
  const [draft, setDraft] = useState(value ? String(value) : "");

  useEffect(() => {
    setDraft(value ? String(value) : "");
  }, [value]);

  const commit = (text: string) => {
    const next = clampQuantity(Number(text.replace(/\D/g, "") || 0));
    onChange(next);
    setDraft(next ? String(next) : "");
  };

  const button =
    "flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border bg-card text-foreground transition-colors hover:bg-muted active:scale-95 disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <button
        type="button"
        className={button}
        aria-label={fr.order.decrease(productName)}
        disabled={disabled || value <= 0}
        onClick={() => onChange(clampQuantity(value - 1))}
      >
        <Minus className="h-4 w-4" aria-hidden />
      </button>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="off"
        aria-label={fr.order.quantityOf(productName)}
        disabled={disabled}
        value={draft}
        placeholder="0"
        onFocus={(event) => event.currentTarget.select()}
        onChange={(event) => {
          const digits = event.target.value.replace(/\D/g, "").slice(0, 4);
          setDraft(digits);
          if (digits) onChange(clampQuantity(Number(digits)));
        }}
        onBlur={(event) => commit(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
        }}
        className={cn(
          "h-11 w-14 rounded-xl border border-border bg-background text-center text-base font-semibold tabular-nums",
          "placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50",
          value > 0 && "border-primary/60 bg-primary/5"
        )}
      />
      <button
        type="button"
        className={cn(button, "border-transparent bg-primary text-primary-foreground hover:bg-primary-hover")}
        aria-label={fr.order.increase(productName)}
        disabled={disabled}
        onClick={() => onChange(clampQuantity(value + 1))}
      >
        <Plus className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}
