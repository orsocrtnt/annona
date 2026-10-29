/** Boutons du site public (landing B) : jetons Light/Dark, cibles de 52 px. */
export const primaryButton =
  "inline-flex min-h-[52px] items-center justify-center gap-2 rounded-[14px] bg-primary px-6 text-[15px] font-semibold text-primary-foreground transition-[background-color,transform] duration-200 hover:bg-primary-hover active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none";
export const ghostButton =
  "inline-flex min-h-[52px] items-center justify-center gap-2 rounded-[14px] border border-border bg-card px-6 text-[15px] font-semibold text-foreground transition-colors duration-200 hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";
export const inkButton =
  "inline-flex min-h-[52px] items-center justify-center gap-2 rounded-[14px] bg-foreground px-6 text-[15px] font-semibold text-background transition-[background-color,transform] duration-200 hover:bg-foreground/90 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none";

/** Boutons de la landing (LANDING-3), mesures de la maquette validée : 44 px, coins de 12 px, couleurs `--l-*`. */
const landingButton =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-[12px] px-5 text-[15px] font-semibold transition-[background-color,transform] duration-150 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--l-bg)] disabled:opacity-60 motion-reduce:transition-none";
export const landingMintButton = `${landingButton} bg-[var(--l-mint)] text-[var(--l-on-mint)] hover:bg-[var(--l-mint-h)]`;
export const landingGhostButton = `${landingButton} border border-[var(--l-line)] bg-[var(--l-card)] text-[var(--l-ink)]`;
