"use client";

import { Fragment, useState } from "react";
import { ShelfHeading } from "@/features/shops/shelf-heading";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, PackageCheck } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import type { ReceptionSheet } from "@/domains/shop/shop-stock.service";
import { parisToday, shopCall } from "@/features/shops/shop-client";

/**
 * Lot 2, demande 6 — réception du matin sur la tablette : la liste de l'envoi avec les quantités prévues ; pour
 * chaque produit, la quantité reçue et la quantité abîmée pendant la livraison. Le bon état entre en stock.
 */
export function SellerReception() {
  const qc = useQueryClient();
  const date = parisToday();
  const sheet = useQuery({ queryKey: ["shop", "reception", date], queryFn: () => shopCall<ReceptionSheet>(`/api/shop/reception?date=${date}`) });
  const [received, setReceived] = useState<Record<string, string>>({});
  const [damaged, setDamaged] = useState<Record<string, string>>({});
  const save = useMutation({
    mutationFn: (data: ReceptionSheet) =>
      shopCall<{ gaps: Array<{ name: string; sent: number; received: number }> }>("/api/shop/reception", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          lines: data.lines.map((line) => ({
            productId: line.productId,
            received: Number(received[line.productId] ?? line.sent),
            damaged: Number(damaged[line.productId] || 0),
          })),
        }),
      }),
    onSuccess: (result) => {
      void qc.invalidateQueries({ queryKey: ["shop"] });
      toast.success("Réception enregistrée", {
        description: result.gaps.length
          ? `Écart signalé à la production : ${result.gaps.map((gap) => `${gap.name} ${gap.received}/${gap.sent}`).join(", ")}.`
          : "Les produits en bon état sont en stock.",
      });
    },
    onError: (failure: Error) => toast.error(failure.message),
  });
  if (sheet.isLoading && !sheet.data) return <PageSkeleton />;
  const data = sheet.data;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-semibold tracking-tight">
          <PackageCheck className="h-7 w-7 text-brand" aria-hidden /> Réception du matin
        </h1>
        <p className="mt-1 text-base text-muted-foreground">Comptez ce qui est arrivé, et ce qui est abîmé par la livraison.</p>
      </div>
      {sheet.error ? <p role="alert" className="text-base text-error">{sheet.error.message}</p> : null}
      {data && data.lines.length === 0 ? (
        <p className="rounded-xl border border-dashed p-8 text-center text-lg text-muted-foreground">Aucun envoi prévu aujourd&apos;hui.</p>
      ) : null}
      {data && data.lines.length > 0 ? (
        <Card>
          <CardContent className="space-y-4 pt-6">
            {data.receivedAt ? (
              <p className="flex items-center gap-2 text-base text-success">
                <CheckCircle2 className="h-5 w-5" aria-hidden /> Réception déjà enregistrée.
              </p>
            ) : null}
            <ul className="divide-y">
              {data.lines.map((line, index) => (
                <Fragment key={line.productId}>
                <ShelfHeading lines={data.lines} index={index} />
                <li className="flex flex-wrap items-center gap-3 py-3" data-testid={`reception-${line.name}`}>
                  <div className="min-w-0 flex-1">
                    <p className="text-lg font-medium">{line.name}</p>
                    <p className="text-sm text-muted-foreground">Envoyé : {line.sent} {line.unit}</p>
                  </div>
                  {line.received !== null ? (
                    <div className="flex gap-2">
                      <Badge variant={line.received === line.sent ? "success" : "warning"}>Reçu {line.received}</Badge>
                      {line.damaged ? <Badge variant="error">Abîmé {line.damaged}</Badge> : null}
                    </div>
                  ) : (
                    <>
                      <label className="flex items-center gap-2 text-sm">
                        Reçu
                        <Input
                          inputMode="numeric"
                          className="h-12 w-20 text-right text-lg tabular-nums"
                          value={received[line.productId] ?? String(line.sent)}
                          onChange={(event) => setReceived((current) => ({ ...current, [line.productId]: event.target.value.replace(/\D/g, "") }))}
                          aria-label={`${line.name} reçus`}
                        />
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        Abîmé
                        <Input
                          inputMode="numeric"
                          className="h-12 w-20 text-right text-lg tabular-nums"
                          placeholder="0"
                          value={damaged[line.productId] ?? ""}
                          onChange={(event) => setDamaged((current) => ({ ...current, [line.productId]: event.target.value.replace(/\D/g, "") }))}
                          aria-label={`${line.name} abîmés pendant la livraison`}
                        />
                      </label>
                    </>
                  )}
                </li>
                </Fragment>
              ))}
            </ul>
            {data.receivedAt ? null : (
              <Button type="button" size="lg" variant="brand" className="w-full sm:w-auto" loading={save.isPending} onClick={() => save.mutate(data)}>
                Valider la réception
              </Button>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
