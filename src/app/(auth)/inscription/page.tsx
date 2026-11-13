import { SignupForm } from "@/features/auth/signup-form";
import { createClient } from "@/services/supabase/server";
import { googleNameHints } from "@/domains/auth/supabase-signup";

/**
 * AUTH-GOOGLE : inscription d'une boulangerie. `?etape=entreprise` suit « Continuer avec Google » : la
 * session Google est ouverte mais aucun profil n'existe encore ; on demande seulement le nom de la
 * boulangerie. Sans session Google, le formulaire de départ s'affiche.
 */
export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  if (params.etape === "entreprise") {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.email && user.email_confirmed_at) {
      const hints = googleNameHints(user);
      return <SignupForm step="company" email={user.email} firstName={hints.firstName} lastName={hints.lastName} />;
    }
  }
  return <SignupForm step="start" />;
}
