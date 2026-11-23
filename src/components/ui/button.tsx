import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&:disabled:not([aria-busy=true])]:border-transparent [&:disabled:not([aria-busy=true])]:bg-muted [&:disabled:not([aria-busy=true])]:text-muted-foreground [&:disabled:not([aria-busy=true])]:shadow-none [&:disabled:not([aria-busy=true])]:opacity-100 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary font-bold text-primary-foreground hover:bg-primary-hover active:scale-[0.98]",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border border-input bg-card hover:bg-muted hover:text-foreground",
        secondary:
          "bg-foreground text-background hover:bg-foreground/85",
        ghost: "hover:bg-muted hover:text-foreground",
        link: "text-brand underline-offset-4 hover:underline",
        brand:
          "bg-primary font-bold text-primary-foreground hover:bg-primary-hover active:scale-[0.98]",
      },
      size: {
        default: "h-10 px-4 py-2 max-md:min-h-11",
        sm: "h-8 px-3 text-xs max-md:min-h-11",
        lg: "h-12 px-8 text-base",
        xl: "h-14 px-10 text-base font-semibold",
        icon: "h-10 w-10 max-md:min-h-11 max-md:min-w-11",
        "icon-sm": "h-8 w-8 max-md:min-h-11 max-md:min-w-11",
        // Cibles tactiles >= 44 px (portail client, DESIGN-1) ; variantes ajoutées, les existantes ne changent pas.
        touch: "h-11 px-4 text-sm",
        "icon-touch": "h-11 w-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading, children, disabled, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";

    if (asChild) {
      return (
        <Comp
          className={cn(buttonVariants({ variant, size, className }))}
          ref={ref}
          {...props}
        >
          {children}
        </Comp>
      );
    }

    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || loading}
        // En chargement, le bouton garde sa couleur ; désactivé seul, il passe en gris neutre (lisible en sombre).
        aria-busy={loading || undefined}
        {...props}
      >
        {loading && <Loader2 className="animate-spin" />}
        {children}
      </Comp>
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
