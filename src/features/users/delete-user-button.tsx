"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { SystemRole } from "@prisma/client";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

const DELETABLE_ROLES: SystemRole[] = ["CLIENT", "DRIVER", "DISPATCHER", "MINI_ADMIN"];

interface DeleteUserButtonProps {
  userId: string;
  userName: string;
  role: SystemRole;
  locked?: boolean;
  onDeleted?: () => void;
}

export function DeleteUserButton({
  userId,
  userName,
  role,
  locked = false,
  onDeleted,
}: DeleteUserButtonProps) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const deleteUser = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/users/${userId}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Suppression impossible");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["company", "drivers"] });
      queryClient.invalidateQueries({ queryKey: ["company", "clients"] });
      queryClient.invalidateQueries({ queryKey: ["company"] });
      setOpen(false);
      onDeleted?.();
      toast.success(`${userName} a été supprimé`);
    },
    onError: (error) => {
      toast.error("Suppression impossible", {
        description: error instanceof Error ? error.message : undefined,
      });
    },
  });

  if (locked || !DELETABLE_ROLES.includes(role)) {
    return null;
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon-sm"
        className="h-7 w-7 shrink-0 text-destructive hover:text-destructive"
        onClick={() => setOpen(true)}
        title={`Supprimer ${userName}`}
        aria-label={`Supprimer ${userName}`}
      >
        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Supprimer {userName} ?</DialogTitle>
            <DialogDescription>
              Cette action est irréversible. Le compte sera retiré de l&apos;équipe et
              l&apos;accès au portail sera révoqué. Les commandes et livraisons existantes
              seront conservées.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button
              variant="destructive"
              loading={deleteUser.isPending}
              onClick={() => deleteUser.mutate()}
            >
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
