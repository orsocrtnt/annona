import Link from "next/link";
import { BrandLogo } from "@/components/brand/brand-logo";
import { Button } from "@/components/ui/button";
import { signupOpen } from "@/domains/signup/signup-availability";
import { SignupWizard } from "@/features/auth/signup-wizard";

export const dynamic = "force-dynamic";

export default function RegisterPage() {
  if (signupOpen()) return <SignupWizard />;
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/20 px-4 py-8 sm:px-6">
      <section className="w-full max-w-lg rounded-2xl border bg-background p-6 text-center shadow-sm sm:p-8">
        <Link href="/" className="inline-flex items-center rounded-lg max-md:min-h-11"><BrandLogo className="dark:hidden" priority /><BrandLogo onDark className="hidden dark:inline-flex" /></Link>
        <h1 className="mt-6 text-2xl font-semibold tracking-tight">L’inscription en ligne ouvre bientôt</h1>
        <p className="mt-3 text-muted-foreground">Pour démarrer dès maintenant, écrivez-nous : nous ouvrons votre espace avec vous.</p>
        <div className="mt-6 flex flex-col items-center gap-3">
          <Button asChild variant="brand" size="lg"><Link href="/contact">Demander un pilote</Link></Button>
          <Link href="/login" className="inline-flex min-h-11 items-center text-sm font-medium text-brand hover:underline">Se connecter</Link>
        </div>
      </section>
    </main>
  );
}
