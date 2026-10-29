import Link from "next/link";
import { SUPPORT_EMAIL } from "@/lib/constants";

const DEFAULT_CLASS =
  "inline-flex min-h-11 items-center text-sm font-medium text-muted-foreground transition-colors hover:text-foreground hover:underline";

/** Support : l'adresse configurée si elle existe, sinon le formulaire de contact (jamais une adresse inventée). */
export function PublicSupportLink({ className }: { className?: string }) {
  if (SUPPORT_EMAIL) {
    return (
      <a href={`mailto:${SUPPORT_EMAIL}`} className={className ?? DEFAULT_CLASS}>
        Support
      </a>
    );
  }
  return (
    <Link href="/contact" className={className ?? DEFAULT_CLASS}>
      Support
    </Link>
  );
}
