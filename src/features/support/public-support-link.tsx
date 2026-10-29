import { SUPPORT_EMAIL } from "@/lib/constants";

export function PublicSupportLink({ className }: { className?: string }) {
  return (
    <a
      href={`mailto:${SUPPORT_EMAIL}`}
      className={className ?? "text-sm font-medium text-muted-foreground transition-colors hover:text-foreground hover:underline max-md:inline-flex max-md:min-h-11 max-md:items-center"}
    >
      Support
    </a>
  );
}
