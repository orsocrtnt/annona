"use client";

import { motion } from "motion/react";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Bulle explicative courte posée dans l'interface : quelques mots, jamais un paragraphe.
 * Fond encre et halo vert pour attirer l'œil dès qu'elle apparaît.
 */
export function TourBubble({
  children,
  className,
  delay = 0.35,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.p
      initial={{ opacity: 0, y: 10, scale: 0.88 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 340, damping: 20, delay }}
      style={{ animationDelay: `${delay + 0.35}s` }}
      className={cn(
        "product-tour-bubble pointer-events-none absolute z-20 hidden max-w-[250px] items-start gap-2 rounded-2xl bg-[#0e1310] py-2.5 pl-2.5 pr-3.5 text-[13px] font-semibold leading-snug text-white sm:flex",
        className
      )}
    >
      <span className="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#00d46a] text-[#0e1310]" aria-hidden>
        <Sparkles className="h-3 w-3" strokeWidth={2.5} />
      </span>
      <span className="min-w-0">{children}</span>
    </motion.p>
  );
}

/** Empile plusieurs bulles au même endroit, dans l'ordre où elles apparaissent. */
export function TourBubbles({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("pointer-events-none absolute z-20 hidden flex-col items-start gap-2 sm:flex", className)}>{children}</div>
  );
}
