"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useDeleteOrder } from "./hooks";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

interface DeleteOrderButtonProps {
  orderId: string;
  orderReference: string;
  redirectTo?: string;
  variant?: "icon" | "button";
}

export function DeleteOrderButton({
  orderId,
  orderReference,
  redirectTo,
  variant = "icon",
}: DeleteOrderButtonProps) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const deleteOrder = useDeleteOrder();

  const handleDelete = async () => {
    try {
      await deleteOrder.mutateAsync(orderId);
      setOpen(false);
      toast.success(`Commande ${orderReference} supprimée`);
      if (redirectTo) router.push(redirectTo);
    } catch (error) {
      toast.error("Suppression impossible", {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  };

  return (
    <>
      {variant === "icon" ? (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 text-destructive hover:text-destructive"
          onClick={() => setOpen(true)}
          aria-label="Supprimer la commande"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      ) : (
        <Button variant="destructive" size="sm" onClick={() => setOpen(true)}>
          <Trash2 className="mr-2 h-4 w-4" />
          Supprimer la commande
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Supprimer {orderReference} ?</DialogTitle>
            <DialogDescription>
              Cette action est irréversible. La commande, ses articles et les livraisons
              associées seront définitivement supprimés.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button
              variant="destructive"
              loading={deleteOrder.isPending}
              onClick={handleDelete}
            >
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
