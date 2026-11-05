import { cn } from "@/lib/utils";

/** Carte de l'accueil super-administrateur, direction Menthe du site public (Clair et Sombre). */
export const HOME_CARD_CLASS =
  "rounded-[1.75rem] border border-border bg-card p-5 shadow-[0_18px_60px_rgba(14,19,16,0.07)] dark:shadow-[0_18px_60px_rgba(0,0,0,0.35)] sm:p-6";

interface HomeCardProps extends React.HTMLAttributes<HTMLElement> {
  as?: "section" | "div" | "article";
}

export function HomeCard({ as: Tag = "section", className, children, ...props }: HomeCardProps) {
  return (
    <Tag className={cn(HOME_CARD_CLASS, className)} {...props}>
      {children}
    </Tag>
  );
}
