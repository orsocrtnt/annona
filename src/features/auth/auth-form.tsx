"use client";

import { useState, useEffect, useRef, Suspense } from "react";
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
import { selectLoginRedirect } from "@/lib/auth/login-redirect";
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
import { clearPendingCredentials } from "@/lib/storage/pending-credentials";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { APP_NAME } from "@/lib/constants";
import { BrandLogo } from "@/components/brand/brand-logo";
import { PublicSupportLink } from "@/features/support/public-support-link";
import { DEMO_DEFAULT_PASSWORD, DEMO_LOGIN_EMAIL } from "@/lib/demo/constants";
import { useAuthStore } from "@/stores/auth.store";
import { navigateToAuthPage } from "@/lib/navigation/auth-page-navigation";
type AuthMode = "login" | "register" | "forgot-password" | "reset-password";
type LoginContext = "company" | "client" | "driver";
type PasswordLink =
  | { tokenHash: string; type: "invite" | "recovery" | "signup" }
  | { accessToken: string; refreshToken: string; type: "invite" | "recovery" | "signup" };

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
  const queryClient = useQueryClient();
  const [passwordLink, setPasswordLink] = useState<PasswordLink | null>(null);
  const linkRead = useRef(false);
  const [completingLink, setCompletingLink] = useState(false);
  const { setUser, setPermissions, setDemo, setSaas } = useAuthStore();

  useEffect(() => {
    if (mode !== "reset-password") return;
    const readLink = () => {
      if (!window.location.hash && linkRead.current) return;
      linkRead.current = true;
      const params = new URLSearchParams(window.location.hash.slice(1));
      const tokenHash = params.get("token_hash");
      const accessToken = params.get("access_token");
      const refreshToken = params.get("refresh_token");
      const type = params.get("type");
      // Le fragment n'est pas envoyé au serveur ; le retirer de l'historique après lecture.
      window.history.replaceState(null, "", window.location.pathname);
      setSuccess(null);
      if (tokenHash && (type === "invite" || type === "recovery" || type === "signup")) {
        setPasswordLink({ tokenHash, type });
        setError(null);
      } else if (accessToken && refreshToken && (type === "invite" || type === "recovery" || type === "signup")) {
        setPasswordLink({ accessToken, refreshToken, type });
        setError(null);
      } else {
        setPasswordLink(null);
        setError("Lien manquant ou invalide. Demandez un nouveau lien.");
      }
    };
    if (!linkRead.current || window.location.hash) readLink();
    window.addEventListener("hashchange", readLink);
    return () => window.removeEventListener("hashchange", readLink);
  }, [mode]);

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
    const normalizedEmail = data.email.trim().toLowerCase();
    let demoRequestKey: string | undefined;
    if (normalizedEmail === DEMO_LOGIN_EMAIL) {
      const storageKey = "tutelliv-demo-request-key";
      demoRequestKey = window.sessionStorage.getItem(storageKey) ?? window.crypto.randomUUID();
      window.sessionStorage.setItem(storageKey, demoRequestKey);
    }
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: normalizedEmail,
        password: data.password,
        accountType: loginContext === "company" ? "company" : undefined,
        demoRequestKey,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "Email ou mot de passe incorrect.");
      return;
    }
    await queryClient.clear();
    setSaas(json.saas ?? null);
    setPermissions(json.permissions);
    setDemo(json.demo ?? null);
    setUser(json.user);
    queryClient.setQueryData(["session"], {
      user: json.user,
      permissions: json.permissions,
      demo: json.demo ?? null,
      saas: json.saas ?? null,
    });
    const requestedRedirect = new URLSearchParams(window.location.search).get("redirect");
    router.push(selectLoginRedirect(requestedRedirect, json.redirectTo));
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

    registerForm.reset();
    setSuccess("Consultez votre messagerie pour confirmer votre adresse, puis connectez-vous.");
  };

  const onForgotPassword = async (data: ForgotPasswordInput) => {
    setError(null);
    try {
      const res = await fetch("/api/auth/password-recovery", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Envoi indisponible."); return; }
      setSuccess("Si cette adresse peut recevoir un lien, un e-mail sera envoyé.");
    } catch { setError("Connexion interrompue. Réessayez plus tard."); }
  };

  const onResetPassword = async (data?: ResetPasswordInput) => {
    setError(null);
    if (!passwordLink || completingLink) { setError("Demandez un nouveau lien ou attendez la fin de la demande."); return; }
    setCompletingLink(true);
    try {
      const res = await fetch("/api/auth/password-link", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, ...passwordLink }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Lien indisponible."); return; }
      setPasswordLink(null);
      resetForm.reset();
      clearPendingCredentials();
      if (json.redirectTo) {
        router.push(json.redirectTo);
        return;
      }
      setSuccess(passwordLink.type === "signup" ? "Adresse confirmée. Vous pouvez vous connecter." : "Mot de passe enregistré. Vous pouvez vous connecter.");
    } catch { setError("Connexion interrompue. Si le lien a été utilisé, demandez-en un nouveau."); }
    finally { setCompletingLink(false); }
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
        <Link href="/" className="flex w-fit items-center rounded-lg transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80">
          <BrandLogo onDark size="md" priority />
        </Link>
        <div>
          <h2 className="text-4xl font-semibold leading-tight text-white text-balance">
            {isInvitedUser
              ? "Accédez à votre espace personnel"
              : "Pilotez vos opérations de livraison en temps réel"}
          </h2>
          <p className="mt-4 max-w-md text-lg text-white/60">
            {isInvitedUser
              ? "Votre administrateur vous envoie une invitation pour choisir votre mot de passe."
              : "Commandes, dispatch, suivi et facturation au même endroit, pour vous, vos clients et vos livreurs."}
          </p>
        </div>
        <p className="text-sm text-white/40">
          © {new Date().getFullYear()} {APP_NAME}. Tous droits réservés.
        </p>
      </div>

      <div className="relative flex flex-1 items-center justify-center p-6">
        <PublicSupportLink className="absolute left-6 top-7 z-10 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground hover:underline" />
        <Link
          href="/"
          className="absolute right-6 top-6 z-10 flex items-center gap-2.5 transition-opacity hover:opacity-80"
          aria-label={`Retour à l'accueil ${APP_NAME}`}
        >
          <BrandLogo />
        </Link>

        <div className="w-full max-w-md animate-slide-up pt-12 lg:pt-0">
          <h1 className="text-2xl font-semibold tracking-tight">{passwordLink?.type === "signup" ? "Confirmer votre adresse e-mail" : titles[mode].title}</h1>
          <p className="mt-1 text-muted-foreground">{passwordLink?.type === "signup" ? "Confirmez votre adresse pour activer votre espace entreprise." : titles[mode].subtitle}</p>

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
                La création de compte est réservée à votre administrateur. Utilisez votre e-mail et le mot de passe choisi lors de votre invitation.
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

          {(mode === "reset-password" || (mode === "register" && success)) && (
            <p className="mt-4 text-sm"><Link href={success ? "/login" : passwordLink?.type === "signup" ? "/register" : "/forgot-password"} className="text-brand underline underline-offset-2 hover:decoration-2">{success ? "Se connecter" : passwordLink?.type === "signup" ? "Reprendre l’inscription" : "Demander un nouveau lien"}</Link></p>
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
                  <Link
                    href={loginLinks[loginContext].register!}
                    onClick={(event) => navigateToAuthPage(event, loginLinks[loginContext].register!)}
                    className="font-medium text-brand hover:underline"
                  >
                    Créer un compte
                  </Link>
                </p>
              )}
            </form>
          )}

          {mode === "register" && !success && (
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

          {mode === "reset-password" && !success && passwordLink?.type === "signup" && (
            <Button className="mt-8 w-full" loading={completingLink} onClick={() => { void onResetPassword(); }}>Confirmer mon adresse</Button>
          )}

          {mode === "reset-password" && !success && passwordLink?.type !== "signup" && (
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
              <Button type="submit" variant="brand" size="lg" className="w-full" loading={resetForm.formState.isSubmitting} disabled={!passwordLink}>
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
