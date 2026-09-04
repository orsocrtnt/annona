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
import { MINI_ADMIN_MODULE_IDS, MINI_ADMIN_MODULE_GROUPS, MINI_ADMIN_MODULES } from "@/lib/permissions/mini-admin";
import { cn } from "@/lib/utils";
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

const MINI_ADMIN_DEFAULTS = {
  miniAdminTitle: "",
  miniAdminModules: [...MINI_ADMIN_MODULE_IDS],
};

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
      ...MINI_ADMIN_DEFAULTS,
    },
  });

  const roleSlug = form.watch("roleSlug");
  const isMiniAdmin = roleSlug === "mini-admin";

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
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nouvel utilisateur</DialogTitle>
          <DialogDescription>
            {isMiniAdmin
              ? "Donnez-lui un nom de poste et les écrans auxquels il a droit. Un mot de passe temporaire sera généré."
              : "Un mot de passe temporaire sera généré automatiquement. Les identifiants apparaîtront dans le tableau après création."}
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
                <Select
                  value={field.value}
                  onValueChange={(value) => {
                    field.onChange(value);
                    if (value === "mini-admin") {
                      form.setValue("miniAdminModules", [...MINI_ADMIN_MODULE_IDS]);
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="client">Client</SelectItem>
                    <SelectItem value="driver">Chauffeur / Livreur</SelectItem>
                    <SelectItem value="mini-admin">Mini-admin</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </FormField>

          {isMiniAdmin && (
            <>
              <FormField
                label="Intitulé"
                error={form.formState.errors.miniAdminTitle?.message}
                required
              >
                <Input
                  placeholder="ex. Responsable agence"
                  {...form.register("miniAdminTitle")}
                />
              </FormField>
              <FormField
                label="Accès"
                error={form.formState.errors.miniAdminModules?.message}
                required
              >
                <Controller
                  name="miniAdminModules"
                  control={form.control}
                  render={({ field }) => {
                    const selected = field.value ?? [];
                    return (
                      <div className="space-y-4">
                        {MINI_ADMIN_MODULE_GROUPS.map((group) => (
                          <div key={group.id} className="space-y-2">
                            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                              {group.label}
                            </p>
                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                              {MINI_ADMIN_MODULES.filter((mod) => mod.group === group.id).map(
                                (mod) => {
                                  const checked = selected.includes(mod.id);
                                  return (
                                    <button
                                      key={mod.id}
                                      type="button"
                                      onClick={() => {
                                        field.onChange(
                                          checked
                                            ? selected.filter((id) => id !== mod.id)
                                            : [...selected, mod.id]
                                        );
                                      }}
                                      className={cn(
                                        "rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                                        checked
                                          ? "border-brand bg-brand/10 font-medium text-foreground"
                                          : "border-border text-muted-foreground hover:bg-muted/60"
                                      )}
                                    >
                                      {mod.label}
                                    </button>
                                  );
                                }
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  }}
                />
              </FormField>
            </>
          )}

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
