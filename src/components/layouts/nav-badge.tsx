import { cn } from "@/lib/utils";

interface NavBadgeProps {
  value: string | number;
  label?: string;
  className?: string;
  /** RETOURS-3 : « alert » = pastille rouge (demande de support à traiter). */
  tone?: "brand" | "alert";
}

/** Pastille de nouveautés dans le menu (direction Menthe) ; le lecteur d'écran lit `label`. */
export function NavBadge({ value, label, className, tone = "brand" }: NavBadgeProps) {
  return (
    <>
      <span
        aria-hidden={label ? true : undefined}
        className={cn(
          "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold leading-none tabular-nums",
          tone === "alert" ? "bg-destructive text-destructive-foreground" : "bg-brand-subtle text-brand",
          className
        )}
      >
        {value}
      </span>
      {label && <span className="sr-only">, {label}</span>}
    </>
  );
}
