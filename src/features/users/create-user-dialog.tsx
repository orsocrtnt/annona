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
import { useMerchantChoices } from "@/features/catalog/hooks";
import { fr } from "@/lib/i18n/fr";
import { createUserSchema, type CreateUserInput } from "@/lib/validations/user";
import { UserPlus } from "lucide-react";
import { toast } from "sonner";

const t = fr.accounts;
const ROLE_OPTIONS: { value: CreateUserInput["roleSlug"]; label: string }[] = [
  { value: "merchant", label: t.roleOptions.merchant },
  { value: "driver", label: t.roleOptions.driver },
  { value: "baker", label: t.roleOptions.baker },
  { value: "admin", label: t.roleOptions.admin },
];

interface CreateUserDialogProps {
  /** Fiche client : compte client rattaché à ce client, rôle figé. */
  merchant?: { id: string; name: string };
  triggerLabel?: string;
}

/** ADM-01 : créer un compte de l'entreprise ; un compte client est rattaché à un client (ADM-1). */
export function CreateUserDialog({ merchant, triggerLabel = "Inviter un utilisateur" }: CreateUserDialogProps = {}) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const merchants = useMerchantChoices(open && !merchant);

  const form = useForm<CreateUserInput>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      roleSlug: "merchant",
      merchantId: merchant?.id ?? null,
    },
  });
  const role = form.watch("roleSlug");

  const mutation = useMutation({
    mutationFn: async (data: CreateUserInput) => {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, merchantId: data.roleSlug === "merchant" ? data.merchantId : null }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      return json as { invitationSent: boolean; message: string };
    },
    onSuccess: async (result) => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["merchants"] });
      queryClient.invalidateQueries({ queryKey: ["company", "drivers"] });
      if (result.invitationSent) {
        toast.success("Invitation envoyée", { description: "Le destinataire recevra un lien pour choisir son mot de passe." });
      } else {
        toast.success(t.createdPending, { description: result.message });
      }
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
        <Button variant={merchant ? "outline" : "brand"}>
          <UserPlus className="mr-2 h-4 w-4" />
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{merchant ? `${triggerLabel} : ${merchant.name}` : "Inviter un utilisateur"}</DialogTitle>
          <DialogDescription>
            Un lien personnel sera envoyé par e-mail pour choisir son mot de passe.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField label={t.firstName} error={form.formState.errors.firstName?.message} required>
              <Input placeholder="Jean" {...form.register("firstName")} />
            </FormField>
            <FormField label={t.lastName} error={form.formState.errors.lastName?.message} required>
              <Input placeholder="Dupont" {...form.register("lastName")} />
            </FormField>
          </div>
          <FormField label="Adresse e-mail" error={form.formState.errors.email?.message} required>
            <Input type="email" placeholder="jean.dupont@email.fr" {...form.register("email")} />
          </FormField>
          {merchant ? null : (
            <FormField label={t.role} error={form.formState.errors.roleSlug?.message} required>
              <Controller
                name="roleSlug"
                control={form.control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger aria-label={t.role}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </FormField>
          )}
          {!merchant && role === "merchant" ? (
            <FormField label={t.merchant} error={form.formState.errors.merchantId?.message} required>
              <Controller
                name="merchantId"
                control={form.control}
                render={({ field }) => (
                  <Select value={field.value ?? ""} onValueChange={field.onChange}>
                    <SelectTrigger aria-label={t.merchant}>
                      <SelectValue placeholder={t.chooseMerchant} />
                    </SelectTrigger>
                    <SelectContent className="max-h-72">
                      {(merchants.data ?? []).filter((row) => row.active).map((row) => (
                        <SelectItem key={row.id} value={row.id}>{row.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </FormField>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button type="submit" variant="brand" loading={mutation.isPending}>
              Envoyer l’invitation
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
