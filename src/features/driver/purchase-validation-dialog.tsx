"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/features/client-portal/utils";
import type { DriverMissionItem } from "./types";

interface PurchaseValidationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: DriverMissionItem[];
  title: string;
  description: string;
  confirmLabel: string;
  loading?: boolean;
  onConfirm: (items: { id: string; unitPrice: number }[]) => void;
}

export function PurchaseValidationDialog({
  open,
  onOpenChange,
  items,
  title,
  description,
  confirmLabel,
  loading,
  onConfirm,
}: PurchaseValidationDialogProps) {
  const [prices, setPrices] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      const initial: Record<string, string> = {};
      for (const item of items) {
        const price = Number(item.unitPrice);
        initial[item.id] = price > 0 ? String(price) : "";
      }
      setPrices(initial);
    }
  }, [open, items]);

  const lineTotal = (item: DriverMissionItem) => {
    const unit = parseFloat(prices[item.id] ?? "0");
    return (isNaN(unit) ? 0 : unit) * item.quantity;
  };

  const grandTotal = items.reduce((sum, item) => sum + lineTotal(item), 0);

  const handleConfirm = () => {
    const purchaseItems = items.map((item) => {
      const unit = parseFloat(prices[item.id] ?? "0");
      return { id: item.id, unitPrice: isNaN(unit) ? 0 : Math.max(0, unit) };
    });
    onConfirm(purchaseItems);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="rounded-lg border border-border p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{item.name}</p>
                  <p className="text-sm text-muted-foreground">Quantité : {item.quantity}</p>
                </div>
                <p className="text-sm font-medium">{formatCurrency(lineTotal(item))}</p>
              </div>
              <div className="mt-2">
                <label className="text-xs text-muted-foreground">Prix unitaire (€)</label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="0.00"
                  value={prices[item.id] ?? ""}
                  onChange={(e) =>
                    setPrices((prev) => ({ ...prev, [item.id]: e.target.value }))
                  }
                />
              </div>
            </div>
          ))}

          <div className="flex justify-between rounded-lg bg-muted/50 px-3 py-2 font-semibold">
            <span>Total achats</span>
            <span>{formatCurrency(grandTotal)}</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Ces montants serviront de base pour la facturation côté administrateur.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Annuler
          </Button>
          <Button variant="brand" onClick={handleConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function missionNeedsPurchaseValidation(mission: {
  deliveryCategory: string;
  order: { items: { id: string; name: string }[] };
}): boolean {
  return (
    mission.deliveryCategory === "STANDARD" &&
    mission.order.items.length > 0 &&
    mission.order.items.some((item) => item.name.trim().length > 0)
  );
}
