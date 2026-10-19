export function SkipLink() {
  return (
    <a
      href="#main-content"
      className="sr-only fixed left-3 top-3 z-[3000] rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background shadow-lg focus:not-sr-only focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
    >
      Aller au contenu principal
    </a>
  );
}
