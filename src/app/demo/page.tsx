import type { Metadata } from "next";
import { AuthShell } from "@/features/auth/auth-shell";
import { DemoLauncher } from "@/features/demo/demo-launcher";
import { APP_NAME } from "@/lib/constants";

export const metadata: Metadata = {
  title: `Démo — ${APP_NAME}`,
  // L'ouverture réserve un espace de démo : pas d'indexation (un robot qui exécute le JS en réserverait un).
  robots: { index: false, follow: false },
};

export default function DemoPage() {
  return (
    <AuthShell>
      <main id="main-content" tabIndex={-1} className="flex w-full justify-center">
        <DemoLauncher />
      </main>
    </AuthShell>
  );
}
