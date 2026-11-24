import type { Metadata } from "next";
import { AuthShell } from "@/features/auth/auth-shell";
import { DemoLauncher } from "@/features/demo/demo-launcher";
import { APP_NAME } from "@/lib/constants";

export const metadata: Metadata = {
  title: `Démo — ${APP_NAME}`,
  description: "Essayez Annona sans compte : une entreprise fictive, sa journée de livraisons, quatre espaces.",
};

/** DEMO-1 : démo ouverte à tous, sans identifiants, une boulangerie fictive par visiteur. */
export default function DemoPage() {
  return (
    <AuthShell>
      <DemoLauncher />
    </AuthShell>
  );
}
