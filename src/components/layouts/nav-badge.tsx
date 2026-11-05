import { cn } from "@/lib/utils";

interface NavBadgeProps {
  value: string | number;
  label?: string;
  className?: string;
}

/** Pastille de nouveautés dans le menu (direction Menthe) ; le lecteur d'écran lit `label`. */
export function NavBadge({ value, label, className }: NavBadgeProps) {
  return (
    <>
      <span
        aria-hidden={label ? true : undefined}
        className={cn(
          "inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-subtle px-1.5 text-[11px] font-semibold leading-none tabular-nums text-brand",
          className
        )}
      >
        {value}
      </span>
      {label && <span className="sr-only">, {label}</span>}
    </>
  );
}
