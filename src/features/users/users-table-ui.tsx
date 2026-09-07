import { Badge } from "@/components/ui/badge";
import { ROLE_LABELS } from "@/lib/permissions/rbac";
import { getRoleColor } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import type { SystemRole } from "@prisma/client";

export const USER_TABLE_COL = {
  name: "w-[7.5rem] max-w-[7.5rem]",
  email: "w-[9.5rem] max-w-[9.5rem]",
  role: "w-[7.5rem] max-w-[7.5rem]",
  status: "w-[4.5rem]",
  credentials: "w-[5.5rem]",
  actions: "w-16 px-1",
} as const;

export function TableUserName({ name }: { name: string }) {
  return (
    <span className="block truncate font-medium" title={name}>
      {name}
    </span>
  );
}

export function TableUserEmail({ email }: { email: string }) {
  return (
    <span className="block truncate text-muted-foreground" title={email}>
      {email}
    </span>
  );
}

export function TableUserRole({ role, title }: { role: SystemRole; title?: string | null }) {
  const label =
    role === "MINI_ADMIN" && title?.trim() ? title.trim() : (ROLE_LABELS[role] ?? role);
  return (
    <Badge
      variant="outline"
      className={cn("max-w-full truncate whitespace-nowrap px-1.5 py-0 text-[10px]", getRoleColor(role))}
      title={label}
    >
      {label}
    </Badge>
  );
}

export function TableUserStatus({ status }: { status: string }) {
  const isActive = status === "ACTIVE";
  return (
    <Badge
      variant={isActive ? "success" : "secondary"}
      className="whitespace-nowrap px-1.5 py-0 text-[10px]"
    >
      {isActive ? "Actif" : status}
    </Badge>
  );
}
