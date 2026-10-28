"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useMarkNotificationsRead, usePortalNotifications } from "@/features/client-portal/hooks";
import { cn } from "@/lib/utils";

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString("fr-FR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function PortalNotificationsBell({ className }: { className?: string }) {
  const { data: notifications = [] } = usePortalNotifications();
  const markRead = useMarkNotificationsRead();
  const unread = notifications.filter((item) => !item.readAt);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-touch" aria-label="Notifications" className={cn("relative", className)}>
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
          <p className="px-2 py-6 text-center text-sm text-muted-foreground">
            Aucune notification pour le moment.
          </p>
        ) : (
          <div className="max-h-80 overflow-y-auto">
            {notifications.map((item) => (
              <DropdownMenuItem key={item.id} asChild className="cursor-pointer items-start">
                <Link
                  href={item.href ?? "/portal"}
                  onClick={() => {
                    if (!item.readAt) markRead.mutate([item.id]);
                  }}
                  className="flex flex-col gap-0.5"
                >
                  <span className={cn("text-sm", !item.readAt && "font-medium")}>{item.title}</span>
                  <span className="text-xs text-muted-foreground">{item.body}</span>
                  <span className="text-xs text-muted-foreground">{formatWhen(item.createdAt)}</span>
                </Link>
              </DropdownMenuItem>
            ))}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
