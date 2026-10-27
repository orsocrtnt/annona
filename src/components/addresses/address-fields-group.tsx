"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { AddressPreviewMap } from "@/components/addresses/address-preview-map";
import { useAddressSearch } from "@/hooks/use-address-search";
import type { AddressFieldValues, AddressSuggestion } from "@/lib/addresses/types";
import { cn } from "@/lib/utils";
import { Loader2, MapPin } from "lucide-react";

interface AddressFieldsGroupProps {
  values: AddressFieldValues;
  onChange: (values: AddressFieldValues) => void;
  addressLabel?: string;
  addressPlaceholder?: string;
  addressError?: string;
  cityError?: string;
  postalCodeError?: string;
  required?: boolean;
  instructions?: React.ReactNode;
}

export function AddressFieldsGroup({
  values,
  onChange,
  addressLabel = "Adresse",
  addressPlaceholder = "Commencez à saisir une adresse…",
  addressError,
  cityError,
  postalCodeError,
  required,
  instructions,
}: AddressFieldsGroupProps) {
  const listId = useId();
  const addressInputId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const skipExternalResetRef = useRef(false);
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [previewCoords, setPreviewCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [confirmedSelection, setConfirmedSelection] = useState(false);

  const { suggestions, loading } = useAddressSearch(values.address, open);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  useEffect(() => {
    setHighlightedIndex(-1);
  }, [suggestions]);

  useEffect(() => {
    if (skipExternalResetRef.current) {
      skipExternalResetRef.current = false;
      return;
    }
    setConfirmedSelection(false);
  }, [values.address, values.city, values.postalCode]);

  useEffect(() => {
    if (confirmedSelection) return;

    const query = [values.address, values.postalCode, values.city].filter(Boolean).join(", ").trim();
    if (query.length < 5) {
      setPreviewCoords(null);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/addresses/search?q=${encodeURIComponent(query)}`);
        const json = (await response.json()) as { data?: AddressSuggestion[] };
        if (cancelled) return;
        const first = json.data?.[0];
        if (first) {
          setPreviewCoords({ lat: first.latitude, lng: first.longitude });
        }
      } catch {
        if (!cancelled) setPreviewCoords(null);
      }
    }, 450);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [values.address, values.city, values.postalCode, confirmedSelection]);

  const applySuggestion = (suggestion: AddressSuggestion) => {
    skipExternalResetRef.current = true;
    onChange({
      address: suggestion.address,
      city: suggestion.city,
      postalCode: suggestion.postalCode,
    });
    setPreviewCoords({ lat: suggestion.latitude, lng: suggestion.longitude });
    setConfirmedSelection(true);
    setOpen(false);
  };

  const updateField = (field: keyof AddressFieldValues, value: string) => {
    setConfirmedSelection(false);
    onChange({ ...values, [field]: value });
    if (field === "address") {
      setOpen(value.trim().length >= 3);
    }
  };

  const handleAddressKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || suggestions.length === 0) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlightedIndex((index) => (index + 1) % suggestions.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlightedIndex((index) => (index <= 0 ? suggestions.length - 1 : index - 1));
    } else if (event.key === "Enter" && highlightedIndex >= 0) {
      event.preventDefault();
      applySuggestion(suggestions[highlightedIndex]!);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div className="space-y-4">
      <div ref={containerRef} className="relative">
        <FormField htmlFor={addressInputId} label={addressLabel} error={addressError} required={required}>
          <div className="relative">
            <Input
              id={addressInputId}
              value={values.address}
              aria-invalid={addressError ? true : undefined}
              aria-required={required || undefined}
              aria-describedby={addressError ? `${addressInputId}-error` : undefined}
              placeholder={addressPlaceholder}
              autoComplete="off"
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={open && suggestions.length > 0}
              aria-controls={listId}
              aria-activedescendant={
                open && highlightedIndex >= 0 && highlightedIndex < suggestions.length
                  ? `${listId}-${highlightedIndex}`
                  : undefined
              }
              onChange={(event) => updateField("address", event.target.value)}
              onFocus={() => {
                if (values.address.trim().length >= 3) setOpen(true);
              }}
              onKeyDown={handleAddressKeyDown}
            />
            {loading && (
              <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" aria-hidden="true" />
            )}
          </div>
        </FormField>

        {open && suggestions.length > 0 && (
          <ul
            id={listId}
            role="listbox"
            aria-label="Suggestions d'adresse"
            className="absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-xl border border-border bg-background py-1 shadow-lg"
          >
            {suggestions.map((suggestion, index) => (
              // Combobox : le focus reste dans le champ (flèches + Entrée) ; une option se choisit aussi au clic.
              <li
                key={suggestion.id}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={highlightedIndex === index}
                className={cn(
                  "flex w-full cursor-pointer items-start gap-2 px-3 py-2 text-left text-sm hover:bg-muted/70",
                  highlightedIndex === index && "bg-muted/70"
                )}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => applySuggestion(suggestion)}
              >
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden="true" />
                <span className="block font-medium">{suggestion.label}</span>
              </li>
            ))}
          </ul>
        )}

        <p className="mt-1.5 text-xs text-muted-foreground">
          Saisissez au moins 3 caractères, choisissez une suggestion, puis vérifiez le pin sur la
          carte.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Ville" error={cityError} required={required}>
          <Input
            value={values.city}
            onChange={(event) => updateField("city", event.target.value)}
          />
        </FormField>
        <FormField label="Code postal" error={postalCodeError} required={required}>
          <Input
            value={values.postalCode}
            onChange={(event) => updateField("postalCode", event.target.value)}
          />
        </FormField>
      </div>

      {instructions}

      {previewCoords && (
        <AddressPreviewMap
          latitude={previewCoords.lat}
          longitude={previewCoords.lng}
          label={
            confirmedSelection
              ? "Adresse confirmée — vérifiez le pin"
              : "Aperçu approximatif — sélectionnez une suggestion pour confirmer"
          }
        />
      )}
    </div>
  );
}
