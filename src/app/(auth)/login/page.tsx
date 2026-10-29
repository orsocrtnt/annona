import { Suspense } from "react";
import { AuthForm } from "@/features/auth/auth-form";
import { AuthShell } from "@/features/auth/auth-shell";
import { LoginSpaceChooser } from "@/features/auth/login-space-chooser";
import { resolveLoginView } from "@/features/auth/login-space";

/**
 * Connexion C « Trois espaces » : sans paramètre, choix de l'espace ; `?espace=` valide (ou un lien existant
 * avec `?email=` / `?redirect=`) ouvre le formulaire. Toute autre valeur revient au choix, sans erreur.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const view = resolveLoginView(await searchParams);
  if (view.kind === "choose") {
    return (
      <AuthShell>
        <LoginSpaceChooser />
      </AuthShell>
    );
  }
  return (
    <Suspense>
      <AuthForm key={view.context} mode="login" loginContext={view.context} prefillDemo={view.prefillDemo} />
    </Suspense>
  );
}
