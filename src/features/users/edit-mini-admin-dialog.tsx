"use client";

import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { FormField } from "@/components/ui/form-field";
import { updateMiniAdminSchema, type UpdateMiniAdminInput } from "@/lib/validations/user";
import { parseMiniAdminSettings } from "@/lib/permissions/mini-admin";
import { MiniAdminModulesField } from "./mini-admin-modules-field";
import { Pencil } from "lucide-react";
import { toast } from "sonner";

interface EditMiniAdminDialogProps {
  userId: string;
  userName: string;
  settings?: unknown;
}

export function EditMiniAdminDialog({ userId, userName, settings }: EditMiniAdminDialogProps) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const parsed = parseMiniAdminSettings(settings);

  const form = useForm<UpdateMiniAdminInput>({
    resolver: zodResolver(updateMiniAdminSchema),
    values: {
      miniAdminTitle: parsed.title,
      miniAdminModules: parsed.modules,
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: UpdateMiniAdminInput) => {
      const res = await fetch(`/api/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Mise à jour impossible");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setOpen(false);
      toast.success("Accès mis à jour", { description: userName });
    },
    onError: (error: Error) => {
      toast.error("Erreur", { description: error.message });
    },
  });

  return (
    <>
      <Button
        variant="ghost"
        size="icon-sm"
        className="h-7 w-7 shrink-0"
        onClick={() => setOpen(true)}
        title={`Modifier les accès de ${userName}`}
      >
        <Pencil className="h-3.5 w-3.5" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Accès de {userName}</DialogTitle>
            <DialogDescription>
              Intitulé du poste et écrans autorisés. Les changements s’appliquent à la
              prochaine navigation.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={form.handleSubmit((data) => mutation.mutate(data))} className="space-y-4">
            <FormField
              label="Intitulé"
              error={form.formState.errors.miniAdminTitle?.message}
              required
            >
              <Input placeholder="ex. Responsable agence" {...form.register("miniAdminTitle")} />
            </FormField>
            <FormField
              label="Accès"
              error={form.formState.errors.miniAdminModules?.message}
              required
            >
              <Controller
                name="miniAdminModules"
                control={form.control}
                render={({ field }) => (
                  <MiniAdminModulesField
                    selected={field.value ?? []}
                    onChange={field.onChange}
                  />
                )}
              />
            </FormField>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Annuler
              </Button>
              <Button type="submit" variant="brand" loading={mutation.isPending}>
                Enregistrer
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
