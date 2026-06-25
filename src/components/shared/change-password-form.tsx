"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { changePasswordSchema, type ChangePasswordInput } from "@/lib/validations/auth";
import { useAuthStore } from "@/stores/auth.store";
import { toast } from "sonner";
import { KeyRound } from "lucide-react";

interface ChangePasswordFormProps {
  title?: string;
  description?: string;
}

export function ChangePasswordForm({
  title = "Mot de passe",
  description = "Modifiez votre mot de passe de connexion",
}: ChangePasswordFormProps) {
  const user = useAuthStore((s) => s.user);

  const form = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  const onSubmit = async (data: ChangePasswordInput) => {
    if (!user?.email) {
      toast.error("Session invalide");
      return;
    }

    try {
      const res = await fetch("/api/profile/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const json = await res.json();

      if (!res.ok) {
        if (res.status === 400 && json.error?.includes("actuel")) {
          form.setError("currentPassword", { message: json.error });
          return;
        }
        throw new Error(json.error ?? "Impossible de modifier le mot de passe");
      }

      form.reset();
      toast.success("Mot de passe mis à jour");
    } catch (error) {
      toast.error("Erreur", {
        description:
          error instanceof Error ? error.message : "Impossible de modifier le mot de passe",
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <KeyRound className="h-4 w-4" />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            label="Mot de passe actuel"
            error={form.formState.errors.currentPassword?.message}
            required
          >
            <Input
              type="password"
              autoComplete="current-password"
              {...form.register("currentPassword")}
            />
          </FormField>
          <FormField
            label="Nouveau mot de passe"
            error={form.formState.errors.newPassword?.message}
            hint="Minimum 8 caractères"
            required
          >
            <Input
              type="password"
              autoComplete="new-password"
              {...form.register("newPassword")}
            />
          </FormField>
          <FormField
            label="Confirmer le nouveau mot de passe"
            error={form.formState.errors.confirmPassword?.message}
            required
          >
            <Input
              type="password"
              autoComplete="new-password"
              {...form.register("confirmPassword")}
            />
          </FormField>
          <Button type="submit" variant="brand" loading={form.formState.isSubmitting}>
            Modifier le mot de passe
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
