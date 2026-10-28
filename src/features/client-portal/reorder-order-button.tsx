import Link from "next/link";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { DeliveryCategory, OrderStatus } from "@prisma/client";

export function canReorderPortalOrder(order?: {
  status?: OrderStatus;
  deliveryCategory?: DeliveryCategory | null;
} | null) {
  if (!order) return false;
  return order.deliveryCategory !== "SPECIAL_MISSION" && order.status !== "CANCELLED";
}

interface ReorderOrderButtonProps {
  orderId?: string | null;
  deliveryId?: string | null;
  className?: string;
  fullWidth?: boolean;
  /** Affichage compact pour les tableaux (une seule ligne, pas de débordement). */
  compact?: boolean;
}

export function ReorderOrderButton({
  orderId,
  deliveryId,
  className,
  fullWidth = false,
  compact = false,
}: ReorderOrderButtonProps) {
  const href = orderId
    ? `/portal/orders/new?fromOrder=${orderId}`
    : deliveryId
      ? `/portal/orders/new?fromDelivery=${deliveryId}`
      : null;

  if (!href) return null;

  return (
    <Button
      variant="outline"
      size="touch"
      className={cn(
        fullWidth && "w-full",
        compact && "h-11 shrink-0 whitespace-nowrap px-2.5 text-xs",
        className
      )}
      asChild
    >
      <Link href={href} onClick={(event) => event.stopPropagation()}>
        <RotateCcw className={cn("shrink-0", compact ? "mr-1 h-3.5 w-3.5" : "mr-1.5 h-3.5 w-3.5")} />
        Commander à nouveau
      </Link>
    </Button>
  );
}
