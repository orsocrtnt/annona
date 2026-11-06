import Link from "next/link";
import { ArrowRight, CheckCircle2, HeadphonesIcon } from "lucide-react";
import { HomeCard } from "@/features/admin/home/home-card";
import type { AdminHomeTodo } from "@/domains/admin/admin-home.service";

type TodoRow = {
  key: string;
  count: number;
  text: string;
  action: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
};

const plural = (count: number, one: string, many: string) => `${count} ${count > 1 ? many : one}`;

export function buildTodoRows(todo: AdminHomeTodo): TodoRow[] {
  const rows: TodoRow[] = [
    {
      key: "support",
      count: todo.openSupportTickets,
      text: `${plural(todo.openSupportTickets, "ticket support ouvert", "tickets support ouverts")} ou en cours`,
      action: "Voir les tickets",
      href: "/admin/support",
      icon: HeadphonesIcon,
    },
  ];
  return rows.filter((row) => row.count > 0);
}

export function AdminTodoList({ todo }: { todo: AdminHomeTodo }) {
  const rows = buildTodoRows(todo);
  return (
    <HomeCard aria-labelledby="admin-todo-title">
      <h2 id="admin-todo-title" className="text-lg font-bold tracking-tight text-foreground">À traiter</h2>
      {rows.length === 0 ? (
        <div className="mt-4 flex items-center gap-3 rounded-2xl bg-brand-subtle px-4 py-3 text-sm text-foreground">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-brand" aria-hidden />
          <p>
            <span className="font-semibold">Rien à traiter.</span>{" "}
            <span className="text-muted-foreground">Aucun ticket en attente.</span>
          </p>
        </div>
      ) : (
        <ul className="mt-4 divide-y divide-border">
          {rows.map((row) => {
            const Icon = row.icon;
            return (
              <li key={row.key} className="flex flex-col gap-3 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#e3f7ec] text-brand dark:bg-brand-subtle" aria-hidden>
                    <Icon className="h-5 w-5" />
                  </span>
                  <p className="min-w-0 text-sm leading-6 text-foreground">{row.text}</p>
                </div>
                <Link
                  href={row.href}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-border bg-card px-4 text-sm font-semibold text-foreground transition-colors hover:bg-[#f0f4f1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:hover:bg-secondary max-sm:w-full"
                >
                  {row.action}
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </HomeCard>
  );
}
