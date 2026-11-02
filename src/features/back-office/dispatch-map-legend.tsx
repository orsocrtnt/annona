const LEGEND_ITEMS = [
  { color: "bg-blue-500", label: "Destination livraison" },
  { color: "bg-orange-500", label: "Point de collecte (coursier)" },
  { color: "bg-violet-600", label: "Position livreur" },
] as const;

export function DispatchMapLegend() {
  return (
    <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
      {LEGEND_ITEMS.map((item) => (
        <span key={item.label} className="inline-flex items-center gap-1.5">
          <span className={`h-2.5 w-2.5 rounded-full ${item.color}`} />
          {item.label}
        </span>
      ))}
    </div>
  );
}
