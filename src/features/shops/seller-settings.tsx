"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { KeyRound, Lock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { shopsApi } from "@/features/shops/api";
import { PriceBoard, type ShopPriceBoard } from "@/features/shops/price-board";

/**
 * Lot 2, demande 4 — Paramètres de la tablette. « Produits et prix », à l'écart des écrans de tous les jours,
 * ne s'ouvre qu'avec le code responsable (vérification 2). Le code reste en mémoire le temps de la rubrique
 * seulement : quitter la page la referme. La responsable peut aussi changer son code.
 */
export function SellerSettings() {
  const [code, setCode] = useState("");
  const [unlockedCode, setUnlockedCode] = useState<string | null>(null);
  const [board, setBoard] = useState<ShopPriceBoard | null>(null);

  const unlock = useMutation({
    mutationFn: () => shopsApi.unlockPrices(code),
    onSuccess: (next) => {
      setBoard(next);
      setUnlockedCode(code);
      setCode("");
    },
  });
  const save = useMutation({
    mutationFn: (prices: Parameters<typeof shopsApi.saveMyPrices>[1]) => shopsApi.saveMyPrices(unlockedCode ?? "", prices),
    onSuccess: (next) => {
      setBoard(next);
      toast.success("Prix enregistrés pour votre point de vente");
    },
    onError: (failure: Error) => toast.error(failure.message),
  });

  const close = () => {
    setUnlockedCode(null);
    setBoard(null);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">Paramètres</h1>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <Lock className="h-5 w-5" aria-hidden /> Produits et prix
          </CardTitle>
          <p className="text-base text-muted-foreground">
            Réservé à la responsable du point de vente : choisir les produits vendus et leurs prix en point de vente.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {board && unlockedCode ? (
            <>
              <PriceBoard key={JSON.stringify(board.entries.map((entry) => [entry.productId, entry.sizeId, entry.status, entry.priceCents]))} board={board} saving={save.isPending} onSave={(prices) => save.mutate(prices)} />
              <Button type="button" variant="outline" onClick={close}>Fermer « Produits et prix »</Button>
            </>
          ) : (
            <form
              className="flex flex-wrap items-end gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                unlock.mutate();
              }}
            >
              <FormField label="Code responsable" error={unlock.error?.message}>
                <Input
                  type="password"
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={8}
                  className="h-12 w-48 text-lg tracking-widest"
                  value={code}
                  onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
                  data-testid="manager-code"
                />
              </FormField>
              <Button type="submit" size="lg" variant="brand" loading={unlock.isPending} disabled={code.length < 4}>
                Ouvrir
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      <ChangeCodeCard />
    </div>
  );
}

function ChangeCodeCard() {
  const [currentCode, setCurrentCode] = useState("");
  const [newCode, setNewCode] = useState("");
  const change = useMutation({
    mutationFn: () => shopsApi.changeCode(currentCode, newCode),
    onSuccess: () => {
      toast.success("Code responsable changé");
      setCurrentCode("");
      setNewCode("");
    },
  });
  const digits = (value: string) => value.replace(/\D/g, "");
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <KeyRound className="h-5 w-5" aria-hidden /> Changer le code responsable
        </CardTitle>
        <p className="text-base text-muted-foreground">Code oublié : l&apos;administrateur peut le réinitialiser.</p>
      </CardHeader>
      <CardContent>
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            change.mutate();
          }}
        >
          <FormField label="Code actuel">
            <Input type="password" inputMode="numeric" autoComplete="off" maxLength={8} className="h-12 w-40" value={currentCode} onChange={(event) => setCurrentCode(digits(event.target.value))} />
          </FormField>
          <FormField label="Nouveau code (4 à 8 chiffres)">
            <Input type="password" inputMode="numeric" autoComplete="off" maxLength={8} className="h-12 w-40" value={newCode} onChange={(event) => setNewCode(digits(event.target.value))} />
          </FormField>
          <Button type="submit" size="lg" variant="outline" loading={change.isPending} disabled={currentCode.length < 4 || !/^\d{4,8}$/.test(newCode)}>
            Changer
          </Button>
        </form>
        {change.error ? <p role="alert" className="mt-2 text-sm text-error">{change.error.message}</p> : null}
      </CardContent>
    </Card>
  );
}
