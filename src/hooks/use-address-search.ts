"use client";

import { useEffect, useState } from "react";
import type { AddressSuggestion } from "@/lib/addresses/types";

export function useAddressSearch(query: string, enabled = true) {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const trimmed = query.trim();
    if (!enabled || trimmed.length < 3) {
      setSuggestions([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/addresses/search?q=${encodeURIComponent(trimmed)}`);
        const json = (await response.json()) as {
          data?: AddressSuggestion[];
          error?: string;
        };
        if (cancelled) return;
        if (!response.ok) {
          setSuggestions([]);
          return;
        }
        setSuggestions(json.data ?? []);
      } catch {
        if (!cancelled) setSuggestions([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 280);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, enabled]);

  return { suggestions, loading };
}
