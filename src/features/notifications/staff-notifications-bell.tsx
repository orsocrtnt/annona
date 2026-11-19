"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface StaffNotification {
  id: string;
  title: string;
  body: string;
  href: string | null;
  readAt: string | null;
  createdAt: string;
}

async function call<T>(init?: RequestInit): Promise<T> {
  const res = await fetch("/api/notifications", init);
  const json = (await res.json().catch(() => ({}))) as { error?: string; data?: T };
  if (!res.ok) throw new Error(json.error ?? `Erreur serveur (${res.status})`);
  return json.data as T;
}

const KEY = ["staff", "notifications"] as const;

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

/**
 * Lot 2, demande 6 — cloche du back-office : alertes du compte connecté (écart à la réception d'un envoi en
 * boutique…). Relue toutes les minutes.
 */
export function StaffNotificationsBell({ className }: { className?: string }) {
  const qc = useQueryClient();
  const { data: notifications = [] } = useQuery({ queryKey: KEY, queryFn: () => call<StaffNotification[]>(), refetchInterval: 60_000 });
  const markRead = useMutation({
    mutationFn: (ids?: string[]) => call<StaffNotification[]>({ method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(ids ? { ids } : {}) }),
    onSuccess: (next) => qc.setQueryData(KEY, next),
  });
  const unread = notifications.filter((item) => !item.readAt);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-touch" aria-label="Notifications" className={cn("relative", className)} data-testid="staff-notifications">
          <Bell className="h-4 w-4" />
          {unread.length > 0 ? (
            <span className="absolute right-0.5 top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1 text-xs font-semibold text-white dark:text-primary-foreground">
              {unread.length > 9 ? "9+" : unread.length}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between gap-2">
          <span>Notifications</span>
          {unread.length > 0 ? (
            <button
              type="button"
              className="inline-flex min-h-11 items-center rounded-md px-2 text-xs font-normal text-brand hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => markRead.mutate(undefined)}
            >
              Tout marquer lu
            </button>
          ) : null}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {notifications.length === 0 ? (
          <p className="px-2 py-6 text-center text-sm text-muted-foreground">Aucune notification pour le moment.</p>
        ) : (
          <div className="max-h-80 overflow-y-auto">
            {notifications.map((item) => {
              const content = (
                <>
                  <span className={cn("text-sm", !item.readAt && "font-medium")}>{item.title}</span>
                  <span className="text-xs text-muted-foreground">{item.body}</span>
                  <span className="text-xs text-muted-foreground">{formatWhen(item.createdAt)}</span>
                </>
              );
              return (
                <DropdownMenuItem
                  key={item.id}
                  asChild={Boolean(item.href)}
                  className="flex cursor-pointer flex-col items-start gap-0.5"
                  onSelect={() => {
                    if (!item.readAt) markRead.mutate([item.id]);
                  }}
                >
                  {item.href ? <Link href={item.href} className="flex flex-col gap-0.5">{content}</Link> : content}
                </DropdownMenuItem>
              );
            })}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
