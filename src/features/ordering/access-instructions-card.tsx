"use client";

import { useEffect, useState } from "react";
import { KeyRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useMerchantProfile, useUpdateMerchantAccess } from "@/features/ordering/hooks";
import { fr } from "@/lib/i18n/fr";

const t = fr.portalAccess;
const MAX = 500;

/**
 * Lot 1, demande 8 : « Consignes d'accès » du client (code du portail, entrée de livraison, endroit où
 * déposer, horaires d'ouverture…), 500 caractères au plus, lues par le livreur sur l'arrêt.
 */
export function AccessInstructionsCard() {
  const profile = useMerchantProfile();
  const save = useUpdateMerchantAccess();
  const saved = profile.data?.accessInstructions ?? "";
  const [value, setValue] = useState(saved);
  useEffect(() => setValue(saved), [saved]);
  const dirty = value.trim() !== saved.trim();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <KeyRound className="h-4 w-4" />
          {t.title}
        </CardTitle>
        <CardDescription>{t.hint}</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            save.mutate(value.trim() || null, {
              onSuccess: () => toast.success(t.saved),
              onError: (error) => toast.error(error.message),
            });
          }}
        >
          <label htmlFor="access-instructions" className="sr-only">{t.title}</label>
          <textarea
            id="access-instructions"
            data-testid="access-instructions"
            className="min-h-28 w-full rounded-lg border border-input bg-background px-3 py-2 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:text-sm"
            placeholder={t.placeholder}
            value={value}
            maxLength={MAX}
            disabled={profile.isLoading}
            onChange={(event) => setValue(event.target.value)}
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs text-muted-foreground tabular-nums" aria-live="polite">{t.count(value.length, MAX)}</span>
            <Button type="submit" variant="brand" size="touch" loading={save.isPending} disabled={!dirty || profile.isLoading}>
              {t.save}
            </Button>
          </div>
          {profile.error ? <p className="text-sm text-destructive">{profile.error.message}</p> : null}
        </form>
      </CardContent>
    </Card>
  );
}
