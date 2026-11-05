"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Ban, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface AccessToggleButtonProps {
  kind: "user" | "company";
  id: string;
  name: string;
  status: string;
  className?: string;
}

/**
 * Couper / rétablir l'accès (super admin). Compte : ACTIVE ↔ SUSPENDED. Entreprise : ACTIVE ou essai ↔
 * SUSPENDED, ce qui coupe tous ses comptes. Rien n'est supprimé. Aucun bouton pour les autres statuts.
 */
export function AccessToggleButton({ kind, id, name, status, className }: AccessToggleButtonProps) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const suspended = status === "SUSPENDED";
  const canSuspend = kind === "user" ? status === "ACTIVE" : status === "ACTIVE" || status === "TRIAL";
  const action = suspended ? "restore" : "suspend";

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/admin/${kind === "user" ? "users" : "companies"}/${encodeURIComponent(id)}/access`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? "Action impossible.");
    },
    onSuccess: () => {
      toast.success(suspended ? `Accès rétabli : ${name}.` : `Accès coupé : ${name}.`);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Action impossible."),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["admin"] }),
  });

  if (!suspended && !canSuspend) return null;

  const label = suspended ? "Rétablir" : kind === "user" ? "Couper l'accès" : "Suspendre l'entreprise";
  const description = suspended
    ? kind === "user"
      ? `${name} pourra de nouveau se connecter.`
      : `${name} et tous ses comptes pourront de nouveau se connecter.`
    : kind === "user"
      ? `${name} ne pourra plus se connecter ni rien faire dans TutelLiv (effet en quelques secondes). Ses données sont gardées ; « Rétablir » rend l'accès.`
      : `Tous les comptes de ${name} (équipe, livreurs, clients) perdent l'accès en quelques secondes. Les données sont gardées ; « Rétablir » rend l'accès.`;

  return (
    <>
      <Button
        type="button"
        variant={suspended ? "outline" : "destructive"}
        size="sm"
        className={className ?? "min-h-11"}
        disabled={mutation.isPending}
        onClick={() => setOpen(true)}
      >
        {suspended ? <RotateCcw className="h-4 w-4" aria-hidden /> : <Ban className="h-4 w-4" aria-hidden />}
        {label}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{suspended ? `Rétablir l'accès de ${name} ?` : `${label} : ${name} ?`}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button
              type="button"
              variant={suspended ? "brand" : "destructive"}
              onClick={() => { setOpen(false); mutation.mutate(); }}
            >
              {label}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
