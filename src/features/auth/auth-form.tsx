"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import type { UseFormReturn } from "react-hook-form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { FormField } from "@/components/ui/form-field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  loginSchema,
  registerSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from "@/lib/validations/auth";
import type {
  LoginInput,
  RegisterInput,
  ForgotPasswordInput,
  ResetPasswordInput,
} from "@/lib/validations/auth";
import { createClient } from "@/services/supabase/client";
import { useRouter } from "next/navigation";
import { Package2 } from "lucide-react";
import { APP_NAME } from "@/lib/constants";
import { DEMO_DEFAULT_PASSWORD, DEMO_LOGIN_EMAIL } from "@/lib/demo/constants";
import { useAuthStore } from "@/stores/auth.store";
type AuthMode = "login" | "register" | "forgot-password" | "reset-password";
type LoginContext = "company" | "client" | "driver";

function LoginEmailPrefill({ form }: { form: UseFormReturn<LoginInput> }) {
  const searchParams = useSearchParams();

  useEffect(() => {
    const email = searchParams.get("email");
    if (email) form.setValue("email", email);
  }, [searchParams, form]);

  return null;
}

interface AuthFormProps {
  mode: AuthMode;
  loginContext?: LoginContext;
}

export function AuthForm({ mode, loginContext = "company" }: AuthFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();
  const { setUser, setPermissions, setDemo } = useAuthStore();

  const isClient = loginContext === "client";
  const isDriver = loginContext === "driver";
  const isInvitedUser = isClient || isDriver;

  const loginForm = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const registerForm = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      firstName: "", lastName: "", email: "",
      password: "", confirmPassword: "", companyName: "",
    },
  });

  const forgotForm = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  const resetForm = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  const onLogin = async (data: LoginInput) => {
    setError(null);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: data.email.trim().toLowerCase(),
        password: data.password,
        accountType: loginContext === "company" ? "company" : undefined,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "Email ou mot de passe incorrect.");
      return;
    }
    setUser(json.user);
    setPermissions(json.permissions);
    setDemo(json.demo ?? null);
    router.push(json.redirectTo);
  };

  const onRegister = async (data: RegisterInput) => {
    setError(null);
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...data,
        email: data.email.trim().toLowerCase(),
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "Impossible de créer le compte.");
      return;
    }

    setUser(json.user);
    setPermissions(json.permissions);
    router.push(json.redirectTo);
  };

  const onForgotPassword = async (data: ForgotPasswordInput) => {
    setError(null);
    const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) {
      setError(error.message);
      return;
    }
    setSuccess("Un email de réinitialisation a été envoyé.");
  };

  const onResetPassword = async (data: ResetPasswordInput) => {
    setError(null);
    const { error } = await supabase.auth.updateUser({ password: data.password });
    if (error) {
      setError(
        error.message ||
          "Lien expiré ou invalide. Refaites une demande de réinitialisation."
      );
      return;
    }
    setSuccess("Mot de passe mis à jour. Redirection vers la connexion…");
    setTimeout(() => router.push("/login"), 1500);
  };

  const loginLinks: Record<LoginContext, { forgot: string; register?: string }> = {
    company: { forgot: "/forgot-password", register: "/register" },
    client: { forgot: "/forgot-password" },
    driver: { forgot: "/forgot-password" },
  };

  const titles: Record<AuthMode, { title: string; subtitle: string }> = {
    login: {
      title: isClient ? "Espace client" : isDriver ? "Espace chauffeur" : "Connexion",
      subtitle: isClient
        ? "Suivez vos commandes et livraisons en temps réel"
        : isDriver
          ? "Accédez à vos missions du jour et à la navigation"
          : "Accédez à votre espace de pilotage",
    },
    register: {
      title: "Créer un compte entreprise",
      subtitle: "Inscription réservée aux administrateurs d'entreprise",
    },
    "forgot-password": {
      title: "Mot de passe oublié",
      subtitle: "Nous vous enverrons un lien de réinitialisation",
    },
    "reset-password": {
      title: "Nouveau mot de passe",
      subtitle: "Choisissez un nouveau mot de passe pour votre compte",
    },
  };

  return (
    <div className="flex min-h-screen">
      <div className="hidden w-1/2 flex-col justify-between bg-foreground p-12 lg:flex">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand">
            <Package2 className="h-5 w-5 text-white" />
          </div>
          <span className="text-xl font-semibold text-white">{APP_NAME}</span>
        </div>
        <div>
          <h2 className="text-4xl font-semibold leading-tight text-white text-balance">
            {isInvitedUser
              ? "Accédez à votre espace personnel"
              : "Pilotez vos opérations de livraison en temps réel"}
          </h2>
          <p className="mt-4 max-w-md text-lg text-white/60">
            {isInvitedUser
              ? "Vos identifiants vous ont été communiqués par votre administrateur."
              : "La plateforme de référence pour les entreprises de livraison."}
          </p>
        </div>
        <p className="text-sm text-white/40">
          © {new Date().getFullYear()} {APP_NAME}. Tous droits réservés.
        </p>
      </div>

      <div className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-md animate-slide-up">
          <div className="mb-8 lg:hidden">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-white">
                <Package2 className="h-4 w-4" />
              </div>
              <span className="text-lg font-semibold">{APP_NAME}</span>
            </div>
          </div>

          <h1 className="text-2xl font-semibold tracking-tight">{titles[mode].title}</h1>
          <p className="mt-1 text-muted-foreground">{titles[mode].subtitle}</p>

          {mode === "login" && loginContext === "company" && (
            <Alert variant="info" className="mt-4">
              <AlertDescription>
                <span className="font-medium">Démonstration commerciale :</span>{" "}
                connectez-vous avec{" "}
                <span className="font-mono text-xs">{DEMO_LOGIN_EMAIL}</span> /{" "}
                <span className="font-mono text-xs">{DEMO_DEFAULT_PASSWORD}</span> pour explorer
                l&apos;admin, le portail client et l&apos;app chauffeur depuis un seul compte.
              </AlertDescription>
            </Alert>
          )}

          {isInvitedUser && mode === "login" && (
            <Alert variant="info" className="mt-4">
              <AlertDescription>
                La création de compte est réservée à votre administrateur. Utilisez les identifiants qui vous ont été transmis.
              </AlertDescription>
            </Alert>
          )}

          {error && (
            <Alert variant="destructive" className="mt-6">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {success && (
            <Alert variant="success" className="mt-6">
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          )}

          {mode === "login" && (
            <form onSubmit={loginForm.handleSubmit(onLogin)} className="mt-8 space-y-5">
              <Suspense fallback={null}>
                <LoginEmailPrefill form={loginForm} />
              </Suspense>
              <FormField label="Email" error={loginForm.formState.errors.email?.message} required>
                <Input
                  type="email"
                  autoComplete="email"
                  placeholder="vous@email.fr"
                  error={!!loginForm.formState.errors.email}
                  {...loginForm.register("email")}
                />
              </FormField>
              <FormField label="Mot de passe" error={loginForm.formState.errors.password?.message} required>
                <PasswordInput
                  autoComplete="current-password"
                  placeholder="••••••••"
                  error={!!loginForm.formState.errors.password}
                  {...loginForm.register("password")}
                />
              </FormField>
              <div className="flex justify-end">
                <Link href={loginLinks[loginContext].forgot} className="text-sm text-brand hover:underline">
                  Mot de passe oublié ?
                </Link>
              </div>
              <Button type="submit" variant="brand" size="lg" className="w-full" loading={loginForm.formState.isSubmitting}>
                Se connecter
              </Button>
              {loginLinks[loginContext].register && (
                <p className="text-center text-sm text-muted-foreground">
                  Pas encore de compte entreprise ?{" "}
                  <Link href={loginLinks[loginContext].register!} className="font-medium text-brand hover:underline">
                    Créer un compte
                  </Link>
                </p>
              )}
            </form>
          )}

          {mode === "register" && (
            <form onSubmit={registerForm.handleSubmit(onRegister)} className="mt-8 space-y-5">
              <Alert variant="info">
                <AlertDescription>
                  Cette inscription est réservée aux administrateurs d&apos;entreprise. Les comptes clients et chauffeurs sont créés par l&apos;administrateur.
                </AlertDescription>
              </Alert>
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Prénom" error={registerForm.formState.errors.firstName?.message} required>
                  <Input placeholder="Jean" {...registerForm.register("firstName")} />
                </FormField>
                <FormField label="Nom" error={registerForm.formState.errors.lastName?.message} required>
                  <Input placeholder="Dupont" {...registerForm.register("lastName")} />
                </FormField>
              </div>
              <FormField label="Email" error={registerForm.formState.errors.email?.message} required>
                <Input type="email" autoComplete="email" placeholder="vous@entreprise.fr" {...registerForm.register("email")} />
              </FormField>
              <FormField label="Entreprise" hint="Optionnel">
                <Input autoComplete="organization" placeholder="Nom de votre entreprise" {...registerForm.register("companyName")} />
              </FormField>
              <FormField label="Mot de passe" error={registerForm.formState.errors.password?.message} required>
                <PasswordInput autoComplete="new-password" placeholder="••••••••" {...registerForm.register("password")} />
              </FormField>
              <FormField label="Confirmer" error={registerForm.formState.errors.confirmPassword?.message} required>
                <PasswordInput autoComplete="new-password" placeholder="••••••••" {...registerForm.register("confirmPassword")} />
              </FormField>
              <Button type="submit" variant="brand" size="lg" className="w-full" loading={registerForm.formState.isSubmitting}>
                Créer mon compte entreprise
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                Déjà un compte ?{" "}
                <Link href="/login" className="font-medium text-brand hover:underline">
                  Se connecter
                </Link>
              </p>
            </form>
          )}

          {mode === "forgot-password" && (
            <form onSubmit={forgotForm.handleSubmit(onForgotPassword)} className="mt-8 space-y-5">
              <FormField label="Email" error={forgotForm.formState.errors.email?.message} required>
                <Input type="email" placeholder="vous@entreprise.fr" {...forgotForm.register("email")} />
              </FormField>
              <Button type="submit" variant="brand" size="lg" className="w-full" loading={forgotForm.formState.isSubmitting}>
                Envoyer le lien
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                <Link href="/login" className="font-medium text-brand hover:underline">
                  Retour à la connexion
                </Link>
              </p>
            </form>
          )}

          {mode === "reset-password" && (
            <form onSubmit={resetForm.handleSubmit(onResetPassword)} className="mt-8 space-y-5">
              <FormField label="Nouveau mot de passe" error={resetForm.formState.errors.password?.message} required>
                <PasswordInput
                  autoComplete="new-password"
                  placeholder="••••••••"
                  error={!!resetForm.formState.errors.password}
                  {...resetForm.register("password")}
                />
              </FormField>
              <FormField label="Confirmer le mot de passe" error={resetForm.formState.errors.confirmPassword?.message} required>
                <PasswordInput
                  autoComplete="new-password"
                  placeholder="••••••••"
                  error={!!resetForm.formState.errors.confirmPassword}
                  {...resetForm.register("confirmPassword")}
                />
              </FormField>
              <Button type="submit" variant="brand" size="lg" className="w-full" loading={resetForm.formState.isSubmitting}>
                Mettre à jour le mot de passe
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                <Link href="/login" className="font-medium text-brand hover:underline">
                  Retour à la connexion
                </Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
