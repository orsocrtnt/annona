/** Téléphone du livreur : cadre, barre d'état et écran de l'app. Hauteur plafonnée pour garder un format de smartphone. */
export function PhoneFrame({ time, children }: { time: string; children: React.ReactNode }) {
  return (
    <div className="flex h-full max-h-[480px] w-[230px] shrink-0 flex-col overflow-hidden rounded-[30px] border-[6px] border-[#0e1310] bg-[#f5f8f6] shadow-[0_20px_50px_rgba(14,19,16,0.18)]">
      <div className="flex items-center justify-between bg-white px-4 pb-1 pt-1.5 text-[10px] font-semibold" aria-hidden>
        <span>{time}</span>
        <span className="h-1.5 w-10 rounded-full bg-[#0e1310]" />
        <span>5G</span>
      </div>
      <div className="relative min-h-0 flex-1">{children}</div>
    </div>
  );
}
