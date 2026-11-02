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
import { canManageMiniAdmins } from "@/lib/permissions/mini-admin";
import { usePermissions } from "@/hooks/use-permissions";
import { MiniAdminModulesField } from "./mini-admin-modules-field";
import { UserPlus } from "lucide-react";
import {
  canInviteSaasSeat,
  lockedSeatReason,
  seatRemainingLabel,
  type SessionSaasSeatMeter,
} from "@/domains/saas/saas-access";
import { useHasOfferSeat, useOfferAccess } from "@/features/saas/use-offer-access";
import { useAuthStore } from "@/stores/auth.store";
import { toast } from "sonner";
const MINI_ADMIN_DEFAULTS = {
  miniAdminTitle: "",
  miniAdminModules: [],
};

export function CreateUserDialog() {
  const { role } = usePermissions();
  const canDelegate = canManageMiniAdmins(role);
  const offerAccess = useOfferAccess();
  const seats = offerAccess?.seats;
  const hasDispatcherSeat = useHasOfferSeat("dispatchers");
  const driverMeter = seats?.drivers;
  const dispatcherMeter = seats?.dispatchers;
  const canInviteDriver = seats ? canInviteSaasSeat(driverMeter) : true;
  const canInviteDispatcher = seats ? canInviteSaasSeat(dispatcherMeter) : hasDispatcherSeat;
  const dispatcherReason = lockedSeatReason("dispatchers", offerAccess?.planCode);

  const roleSeatHint = (meter: SessionSaasSeatMeter | undefined) =>
    meter ? seatRemainingLabel(meter) : null;
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
      return json;
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["company", "drivers"] });
      queryClient.invalidateQueries({ queryKey: ["company", "clients"] });
      const session = await fetch("/api/auth/session").then((res) => res.json()).catch(() => null);
      if (session?.saas !== undefined) useAuthStore.getState().setSaas(session.saas);
      toast.success("Invitation envoyée", {
        description: "Le destinataire recevra un lien pour choisir son mot de passe.",
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
          Inviter un utilisateur
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Inviter un utilisateur</DialogTitle>
          <DialogDescription>
            {isMiniAdmin
              ? "Choisissez son poste et ses accès. Il recevra une invitation par e-mail."
              : "Un lien personnel sera envoyé par e-mail pour choisir son mot de passe."}
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
                      form.setValue("miniAdminModules", []);
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="client">Client</SelectItem>
                    <SelectItem value="driver" disabled={!canInviteDriver}>
                      {canInviteDriver
                        ? driverMeter
                          ? `Livreur — ${seatRemainingLabel(driverMeter)}`
                          : "Livreur"
                        : `Livreur — ${driverMeter ? seatRemainingLabel(driverMeter) : "aucun poste restant"}`}
                    </SelectItem>
                    {canDelegate && (
                      <SelectItem value="dispatcher" disabled={!canInviteDispatcher}>
                        {dispatcherMeter
                          ? `Dispatcher — ${seatRemainingLabel(dispatcherMeter)}`
                          : canInviteDispatcher
                            ? "Dispatcher"
                            : `Dispatcher — ${dispatcherReason}`}
                      </SelectItem>
                    )}
                    {canDelegate && (
                      <SelectItem value="mini-admin" disabled={!canInviteDispatcher}>
                        {dispatcherMeter
                          ? `Mini-admin personnalisé — ${seatRemainingLabel(dispatcherMeter)}`
                          : canInviteDispatcher
                            ? "Mini-admin personnalisé"
                            : `Mini-admin — ${dispatcherReason}`}
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              )}
            />
          </FormField>
          {roleSlug === "driver" && roleSeatHint(driverMeter) ? (
            <p className="text-sm text-muted-foreground">{roleSeatHint(driverMeter)}</p>
          ) : null}
          {(roleSlug === "dispatcher" || roleSlug === "mini-admin") && roleSeatHint(dispatcherMeter) ? (
            <p className="text-sm text-muted-foreground">{roleSeatHint(dispatcherMeter)}</p>
          ) : null}

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
                  render={({ field }) => (
                    <MiniAdminModulesField
                      selected={field.value ?? []}
                      onChange={field.onChange}
                    />
                  )}
                />
              </FormField>
            </>
          )}

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
