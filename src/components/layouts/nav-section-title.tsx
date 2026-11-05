import { cn } from "@/lib/utils";

interface NavSectionTitleProps {
  id: string;
  title: string;
  collapsed?: boolean;
  premium?: boolean;
}

/** Titre de groupe du menu ; barre repliée : un simple filet, le titre reste lu par le lecteur d'écran. */
export function NavSectionTitle({ id, title, collapsed = false, premium = false }: NavSectionTitleProps) {
  if (collapsed) {
    return (
      <div className="px-2 pb-1 pt-3">
        <div aria-hidden className={cn("h-px", premium ? "bg-[#eef2ef] dark:bg-border" : "bg-border")} />
        <span id={id} className="sr-only">{title}</span>
      </div>
    );
  }
  return (
    <p
      id={id}
      className={cn(
        "px-3 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-[0.14em]",
        premium ? "text-[#68726b] dark:text-muted-foreground" : "text-muted-foreground"
      )}
    >
      {title}
    </p>
  );
}
