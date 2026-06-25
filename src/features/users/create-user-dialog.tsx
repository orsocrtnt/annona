"use client";

import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createUserSchema, type CreateUserInput } from "@/lib/validations/user";
import { UserPlus } from "lucide-react";
import { toast } from "sonner";
import type { SystemRole } from "@prisma/client";
import type { PendingCredentials } from "./user-credentials-cell";

interface CreatedUserResponse {
  data: {
    id: string;
    email: string;
    role: { systemRole: SystemRole };
  };
  temporaryPassword: string;
}

interface CreateUserDialogProps {
  onUserCreated: (userId: string, credentials: PendingCredentials) => void;
}

export function CreateUserDialog({ onUserCreated }: CreateUserDialogProps) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const form = useForm<CreateUserInput>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      roleSlug: "client",
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: CreateUserInput) => {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      return json as CreatedUserResponse;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["company", "drivers"] });
      queryClient.invalidateQueries({ queryKey: ["company", "clients"] });
      onUserCreated(result.data.id, {
        email: result.data.email,
        password: result.temporaryPassword,
        role: result.data.role.systemRole,
      });
      toast.success("Utilisateur créé", {
        description: "Les identifiants sont affichés dans le tableau.",
      });
      setOpen(false);
      form.reset();
    },
    onError: (error: Error) => {
      toast.error("Erreur", { description: error.message });
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="brand">
          <UserPlus className="mr-2 h-4 w-4" />
          Créer un utilisateur
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nouvel utilisateur</DialogTitle>
          <DialogDescription>
            Un mot de passe temporaire sera généré automatiquement. Les identifiants apparaîtront dans le tableau après création.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Prénom" error={form.formState.errors.firstName?.message} required>
              <Input placeholder="Jean" {...form.register("firstName")} />
            </FormField>
            <FormField label="Nom" error={form.formState.errors.lastName?.message} required>
              <Input placeholder="Dupont" {...form.register("lastName")} />
            </FormField>
          </div>
          <FormField label="Adresse email" error={form.formState.errors.email?.message} required>
            <Input type="email" placeholder="jean.dupont@email.fr" {...form.register("email")} />
          </FormField>
          <FormField label="Rôle" error={form.formState.errors.roleSlug?.message} required>
            <Controller
              name="roleSlug"
              control={form.control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="client">Client</SelectItem>
                    <SelectItem value="driver">Chauffeur / Livreur</SelectItem>
                    <SelectItem value="dispatcher">Dispatcher</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </FormField>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button type="submit" variant="brand" loading={mutation.isPending}>
              Créer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
