"use client";

import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { getCompactStatusLabel } from "@/lib/constants/order-status";
import type { DashboardDeliveryItem } from "@/lib/dashboard/dashboard-types";

interface DashboardDeliveryListDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  items: DashboardDeliveryItem[];
}

export function DashboardDeliveryListDialog({
  open,
  onOpenChange,
  title,
  description,
  items,
}: DashboardDeliveryListDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-hidden sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        <div className="max-h-[min(60vh,520px)] space-y-2 overflow-y-auto pr-1">
          {items.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Aucune mission</p>
          ) : (
            items.map((delivery) => (
              <div
                key={delivery.id}
                className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border/60 px-4 py-3"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{delivery.reference}</span>
                    <Badge variant={delivery.deliveryCategory === "COURIER" ? "brand" : "secondary"}>
                      {delivery.deliveryCategory === "COURIER" ? "Course" : "Commande"}
                    </Badge>
                    <Badge variant="outline">
                      {getCompactStatusLabel(delivery.status, delivery.deliveryCategory)}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {delivery.customerName ?? "Client"} · Cmd {delivery.orderReference}
                    {delivery.driverName ? ` · ${delivery.driverName}` : ""}
                  </p>
                  {delivery.address && (
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {delivery.address}
                      {delivery.city ? `, ${delivery.city}` : ""}
                    </p>
                  )}
                  {delivery.requestedDeliveryDate && (
                    <p className="text-xs text-muted-foreground">
                      Demandé le{" "}
                      {new Date(delivery.requestedDeliveryDate).toLocaleDateString("fr-FR", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  )}
                </div>
                <Link
                  href={`/dispatch?delivery=${delivery.id}`}
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                  onClick={() => onOpenChange(false)}
                >
                  Dispatch
                </Link>
              </div>
            ))
          )}
        </div>

        {items.length > 0 && (
          <div className="flex justify-end border-t border-border pt-4">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/dispatch" onClick={() => onOpenChange(false)}>
                Ouvrir le dispatch
              </Link>
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
