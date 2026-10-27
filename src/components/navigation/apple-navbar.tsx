import type { ComponentProps, ReactNode } from "react";
import Link from "next/link";
import { Package2 } from "lucide-react";

import { APP_NAME } from "@/lib/constants";
import { cn } from "@/lib/utils";

type AppleNavbarProps = {
  children: ReactNode;
  className?: string;
  innerClassName?: string;
  maxWidthClassName?: string;
  sticky?: boolean;
};

export function AppleNavbar({
  children,
  className,
  innerClassName,
  maxWidthClassName = "max-w-6xl",
  sticky = true,
}: AppleNavbarProps) {
  return (
    <header
      className={cn(
        "z-40 px-3 pb-2 pt-3 sm:px-5 sm:pb-3 sm:pt-4",
        sticky ? "sticky top-[var(--demo-banner-height,0px)]" : "relative",
        className
      )}
    >
      <div
        className={cn(
          "relative mx-auto flex min-h-14 items-center gap-2 overflow-visible rounded-[18px] border border-white/[0.09] bg-[#101118]/[0.94] px-2.5 py-2 text-white shadow-[0_18px_50px_rgba(9,12,20,0.2)] backdrop-blur-2xl transition-[border-color,box-shadow] duration-500 ease-out hover:border-white/[0.15] hover:shadow-[0_22px_60px_rgba(9,12,20,0.28)] supports-[backdrop-filter]:bg-[#101118]/[0.92] motion-reduce:transition-none sm:px-3",
          maxWidthClassName,
          innerClassName
        )}
      >
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 overflow-hidden rounded-[17px] bg-[radial-gradient(circle_at_16%_0%,rgba(255,92,61,0.055),transparent_28%),radial-gradient(circle_at_78%_100%,rgba(107,124,255,0.045),transparent_25%)]"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"
        />
        {children}
      </div>
    </header>
  );
}

export function AppleNavbarBrand({
  href,
  label = APP_NAME,
  className,
}: {
  href: string;
  label?: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group flex min-h-10 shrink-0 items-center gap-2.5 rounded-xl px-1.5 pr-2 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80",
        className
      )}
    >
      <span
        className="flex h-8 w-8 items-center justify-center rounded-[11px] border border-white/10 bg-gradient-to-br from-[#587994] to-[#2d445a] shadow-[inset_0_1px_0_rgba(255,255,255,0.2)] transition-transform duration-200 group-hover:-rotate-3 group-hover:scale-105 motion-reduce:transition-none"
        aria-hidden
      >
        <Package2 className="h-4 w-4" strokeWidth={1.9} />
      </span>
      <span className="text-[15px] font-semibold tracking-[-0.02em]">{label}</span>
    </Link>
  );
}

export function AppleNavbarLinks({
  children,
  ariaLabel,
  className,
}: {
  children: ReactNode;
  ariaLabel: string;
  className?: string;
}) {
  return (
    <nav
      aria-label={ariaLabel}
      className={cn(
        "relative items-center gap-0.5 px-1",
        className
      )}
    >
      {children}
    </nav>
  );
}

type AppleNavbarLinkProps = Omit<ComponentProps<typeof Link>, "className"> & {
  active?: boolean;
  className?: string;
  disabled?: boolean;
  disabledReason?: string;
};

export function AppleNavbarLink({
  active = false,
  children,
  className,
  disabled = false,
  disabledReason,
  href,
  ...props
}: AppleNavbarLinkProps) {
  const classes = cn(
    "group relative inline-flex min-h-10 items-center justify-center whitespace-nowrap rounded-[10px] px-3 text-[13px] font-medium transition-[color,transform] duration-300 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 motion-reduce:transition-none",
    active
      ? "text-white"
      : "text-white/55 hover:text-white",
    disabled && "cursor-not-allowed text-white/30 hover:text-white/30",
    className
  );

  const content = (
    <>
      <span className="relative z-10">{children}</span>
      {!disabled ? (
        <>
          <span
            aria-hidden
            className={cn(
              "pointer-events-none absolute inset-x-2 bottom-[3px] h-px origin-center scale-x-0 rounded-full bg-gradient-to-r from-transparent via-[#ff6847] to-transparent opacity-0 shadow-[0_0_7px_rgba(255,91,57,0.9)] transition-[transform,opacity] duration-300 ease-out group-hover:scale-x-100 group-hover:opacity-100 group-focus-visible:scale-x-100 group-focus-visible:opacity-100 motion-reduce:transition-none",
              active && "scale-x-100 opacity-80"
            )}
          />
          <span
            aria-hidden
            className={cn(
              "pointer-events-none absolute -bottom-1 left-1/2 h-3 w-4/5 -translate-x-1/2 scale-x-50 rounded-full bg-[#ff5638]/25 opacity-0 blur-md transition-[transform,opacity] duration-300 ease-out group-hover:scale-x-100 group-hover:opacity-100 group-focus-visible:scale-x-100 group-focus-visible:opacity-100 motion-reduce:transition-none",
              active && "scale-x-100 opacity-60"
            )}
          />
        </>
      ) : null}
    </>
  );

  if (disabled) {
    return (
      <span aria-disabled="true" className={classes} title={disabledReason}>
        {content}
      </span>
    );
  }

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={classes}
      {...props}
    >
      {content}
    </Link>
  );
}

export const appleNavbarIconButtonClass =
  "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white/60 transition-[background-color,color,transform] duration-300 ease-out hover:-translate-y-px hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 active:translate-y-0 motion-reduce:transition-none";

export const appleNavbarActionClass =
  "group inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-white/[0.13] bg-white/[0.075] px-3.5 text-sm font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_4px_16px_rgba(0,0,0,0.12)] transition-[background-color,border-color,box-shadow,transform] duration-300 ease-out hover:-translate-y-px hover:border-white/20 hover:bg-white/[0.13] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_8px_22px_rgba(0,0,0,0.18)] active:translate-y-0 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 motion-reduce:transition-none";
