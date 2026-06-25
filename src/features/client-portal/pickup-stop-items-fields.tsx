"use client";

import {
  useFieldArray,
  type Control,
  type FieldValues,
  type FieldErrors,
  type UseFormRegister,
} from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { Plus, Trash2 } from "lucide-react";

interface PickupStopItemsFieldsProps {
  pickupIndex: number;
  control: Control<FieldValues>;
  register: UseFormRegister<FieldValues>;
  errors?: FieldErrors<FieldValues>;
  hidePrice?: boolean;
}

type FieldMessage = { message?: string };

/** Forme minimale des erreurs RHF pour une collecte (accès dynamique typé sans `any`). */
type StopErrorShape = {
  items?: FieldMessage &
    Record<
      number,
      { name?: FieldMessage; quantity?: FieldMessage; estimatedPrice?: FieldMessage } | undefined
    >;
};

export function PickupStopItemsFields({
  pickupIndex,
  control,
  register,
  errors,
  hidePrice = true,
}: PickupStopItemsFieldsProps) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: `pickupStops.${pickupIndex}.items` as "pickupStops.0.items",
  });

  const stopErrors = errors?.[pickupIndex] as unknown as StopErrorShape | undefined;

  return (
    <div className="space-y-3 rounded-lg border border-border/70 bg-background/60 p-4">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-medium">Articles à collecter ici</h4>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => append({ name: "", quantity: 1, estimatedPrice: undefined })}
        >
          <Plus className="mr-1 h-4 w-4" />
          Ajouter
        </Button>
      </div>

      {typeof stopErrors?.items?.message === "string" && (
        <p className="text-sm text-destructive">{stopErrors.items.message}</p>
      )}

      {fields.map((field, index) => (
        <div key={field.id} className="flex flex-wrap items-end gap-3 rounded-lg border border-border p-3 max-md:flex-col max-md:items-stretch">
          <FormField
            label="Article"
            error={stopErrors?.items?.[index]?.name?.message}
            className="min-w-[140px] flex-1 max-md:min-w-0 max-md:w-full"
          >
            <Input
              placeholder="Produit, colis..."
              {...register(`pickupStops.${pickupIndex}.items.${index}.name` as const)}
            />
          </FormField>
          <FormField
            label="Qté"
            error={stopErrors?.items?.[index]?.quantity?.message}
            className="w-20 shrink-0"
          >
            <Input
              type="number"
              min={1}
              {...register(`pickupStops.${pickupIndex}.items.${index}.quantity` as const)}
            />
          </FormField>
          {!hidePrice && (
            <FormField
              label="Prix estimé (optionnel)"
              error={stopErrors?.items?.[index]?.estimatedPrice?.message}
              className="w-44 shrink-0 max-md:w-full"
            >
              <Input
                type="number"
                min={0}
                step="0.01"
                placeholder="€"
                {...register(`pickupStops.${pickupIndex}.items.${index}.estimatedPrice` as const)}
              />
            </FormField>
          )}
          {fields.length > 1 && (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="mb-0.5 shrink-0"
              onClick={() => remove(index)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}
