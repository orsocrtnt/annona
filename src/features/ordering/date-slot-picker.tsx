"use client";

import type { OrderingRules, PortalSlot } from "@/domains/order/merchant-order.types";
import { addDaysToDateKey, shortDeliveryDateLabel } from "@/lib/format/delivery-date";
import { fr } from "@/lib/i18n/fr";
import { cn } from "@/lib/utils";

const t = fr.order;

const chip =
  "inline-flex min-h-11 shrink-0 items-center justify-center rounded-full border px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const chipOn = "border-primary bg-primary text-primary-foreground";
const chipOff = "border-border bg-card text-foreground hover:bg-muted";

interface DateSlotPickerProps {
  rules: OrderingRules;
  slots: PortalSlot[];
  date: string | null;
  slotId: string | null;
  onDate: (date: string) => void;
  onSlot: (slotId: string) => void;
  /** Nombre de jours proposés en pastilles (le champ « Autre date » couvre la suite). */
  days?: number;
  idPrefix?: string;
}

/**
 * CLI-05 / RG-02 / RG-08 : date de livraison (à partir de la première date encore ouverte, 7 j / 7)
 * et créneau choisi dans la liste, jamais une heure libre.
 */
export function DateSlotPicker({ rules, slots, date, slotId, onDate, onSlot, days = 7, idPrefix = "order" }: DateSlotPickerProps) {
  const options = Array.from({ length: days }, (_, index) => addDaysToDateKey(rules.firstOpenDate, index));
  const tomorrow = addDaysToDateKey(rules.today, 1);
  const outside = date !== null && !options.includes(date);

  return (
    <div className="min-w-0 space-y-3">
      <fieldset className="min-w-0">
        <legend className="mb-2 text-sm font-semibold">{t.deliveryDate}</legend>
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]" role="radiogroup" aria-label={t.deliveryDate}>
          {options.map((option) => (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={date === option}
              onClick={() => onDate(option)}
              className={cn(chip, date === option ? chipOn : chipOff)}
            >
              {option === tomorrow ? `${t.tomorrow} · ${shortDeliveryDateLabel(option).replace(/^\S+\s/, "")}` : shortDeliveryDateLabel(option)}
            </button>
          ))}
          <label className={cn(chip, outside ? chipOn : chipOff, "relative gap-2")}>
            <span>{outside && date ? shortDeliveryDateLabel(date) : t.otherDate}</span>
            <input
              id={`${idPrefix}-other-date`}
              type="date"
              min={rules.firstOpenDate}
              value={date ?? ""}
              onChange={(event) => event.target.value && onDate(event.target.value)}
              className="absolute inset-0 cursor-pointer opacity-0"
              aria-label={t.otherDate}
            />
          </label>
        </div>
      </fieldset>
      <fieldset className="min-w-0">
        <legend className="mb-2 text-sm font-semibold">{t.slot}</legend>
        {slots.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t.noSlot}</p>
        ) : (
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t.slot}>
            {slots.map((slot) => (
              <button
                key={slot.id}
                type="button"
                role="radio"
                aria-checked={slotId === slot.id}
                onClick={() => onSlot(slot.id)}
                className={cn(chip, slotId === slot.id ? chipOn : chipOff)}
              >
                {slot.label}
              </button>
            ))}
          </div>
        )}
      </fieldset>
    </div>
  );
}
