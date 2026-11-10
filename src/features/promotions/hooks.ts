"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { promotionsApi } from "./api";

const KEY = ["catalog", "promotions"] as const;

export function usePromotions() {
  return useQuery({ queryKey: KEY, queryFn: promotionsApi.list });
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: KEY });
    // Le catalogue client affiche les promotions en cours.
    void qc.invalidateQueries({ queryKey: ["portal", "catalog"] });
  };
}

export function useCreatePromotion() {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: promotionsApi.create, onSuccess: invalidate });
}

export function useStopPromotion() {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: promotionsApi.stop, onSuccess: invalidate });
}
