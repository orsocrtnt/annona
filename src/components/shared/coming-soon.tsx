import { Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface ComingSoonProps {
  title: string;
  description: string;
  /** Tâche de TODO.md qui livrera l'écran (ex. « CMD-1 »). */
  task: string;
}

/**
 * Écran provisoire (SCHEMA-1) : l'espace existe et le rôle y arrive, le contenu métier viendra
 * avec la tâche indiquée.
 */
export function ComingSoon({ title, description, task }: ComingSoonProps) {
  return (
    <div className="mx-auto w-full max-w-2xl p-4 sm:p-6">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <Card className="mt-6">
        <CardContent className="flex items-start gap-4 p-6">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted" aria-hidden="true">
            <Clock className="h-5 w-5 text-muted-foreground" />
          </span>
          <div>
            <p className="font-medium">À venir</p>
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
            <p className="mt-2 text-xs text-muted-foreground">Livré avec la tâche {task}.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
