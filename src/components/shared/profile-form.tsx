"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { updateProfileSchema, type UpdateProfileInput } from "@/lib/validations/user";
import { useAuthStore } from "@/stores/auth.store";
import { toast } from "sonner";
import type { UserWithRole } from "@/types";

interface ProfileFormProps {
  title?: string;
  description?: string;
}

export function ProfileForm({
  title = "Mon profil",
  description = "Modifiez vos informations personnelles",
}: ProfileFormProps) {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);

  const form = useForm<UpdateProfileInput>({
    resolver: zodResolver(updateProfileSchema),
    values: {
      firstName: user?.firstName ?? "",
      lastName: user?.lastName ?? "",
      phone: user?.phone ?? "",
      avatarUrl: user?.avatarUrl ?? "",
    },
  });

  const onSubmit = async (data: UpdateProfileInput) => {
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);

      setUser(json.data as UserWithRole);
      toast.success("Profil mis à jour");
    } catch (error) {
      toast.error("Erreur", {
        description: error instanceof Error ? error.message : "Mise à jour impossible",
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Prénom" error={form.formState.errors.firstName?.message} required>
              <Input {...form.register("firstName")} />
            </FormField>
            <FormField label="Nom" error={form.formState.errors.lastName?.message} required>
              <Input {...form.register("lastName")} />
            </FormField>
          </div>
          <FormField label="Email" hint="L'email ne peut pas être modifié ici">
            <Input value={user?.email ?? ""} disabled />
          </FormField>
          <FormField label="Téléphone" error={form.formState.errors.phone?.message}>
            <Input placeholder="+33 6 12 34 56 78" {...form.register("phone")} />
          </FormField>
          <Button type="submit" variant="brand" loading={form.formState.isSubmitting}>
            Enregistrer
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
