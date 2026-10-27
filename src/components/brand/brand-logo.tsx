import Image from "next/image";
import { APP_NAME } from "@/lib/constants";
import { cn } from "@/lib/utils";

const SIZES = { sm: { width: 104, height: 31 }, md: { width: 132, height: 39 } } as const;

/**
 * Logo TutelLiv. Le nom est porté par un texte masqué (lecteurs d'écran, liens
 * nommés « TutelLiv ») ; l'image est décorative. `onDark` : version pour fond encre.
 */
export function BrandLogo({
  onDark = false,
  size = "sm",
  className,
  priority = false,
}: {
  onDark?: boolean;
  size?: keyof typeof SIZES;
  className?: string;
  priority?: boolean;
}) {
  const { width, height } = SIZES[size];
  return (
    <span className={cn("inline-flex items-center", className)}>
      <Image
        src={onDark ? "/brand/logo-horizontal-fond-sombre.png" : "/brand/logo-horizontal-fond-clair.png"}
        alt=""
        aria-hidden
        width={width}
        height={height}
        priority={priority}
      />
      <span className="sr-only">{APP_NAME}</span>
    </span>
  );
}
