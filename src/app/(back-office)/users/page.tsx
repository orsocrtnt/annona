"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataGrid } from "@/components/ui/data-grid";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { isInitialQueryLoading } from "@/lib/query/is-initial-loading";
import { CreateUserDialog } from "@/features/users/create-user-dialog";
import { DeleteUserButton } from "@/features/users/delete-user-button";
import { AccountStatusButton, EditUserDialog } from "@/features/users/edit-user-dialog";
import {
  TableUserEmail,
  TableUserName,
  TableUserRole,
  TableUserStatus,
  USER_TABLE_COL,
} from "@/features/users/users-table-ui";
import { formatPersonNameByRole } from "@/lib/format/person-labels";
import { usePermissions } from "@/hooks/use-permissions";
import { cn } from "@/lib/utils";
import type { TableColumn } from "@/types";
import type { SystemRole } from "@prisma/client";

interface UserRow {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  status: string;
  phone?: string | null;
  role: { name: string; systemRole: SystemRole };
  company?: { name: string } | null;
  /** ADM-1 : client représenté par un compte client. */
  merchant?: { id: string; name: string } | null;
}

type RoleFilter = "all" | Exclude<SystemRole, "SUPER_ADMIN">;

const ROLE_FILTER_OPTIONS: { value: RoleFilter; label: string }[] = [
  { value: "all", label: "Tous" },
  { value: "MERCHANT", label: "Clients" },
  { value: "DRIVER", label: "Livreurs" },
  { value: "BAKER", label: "Boulangers" },
  { value: "ADMIN", label: "Administrateurs" },
];

const ROLE_SORT_ORDER: Record<SystemRole, number> = {
  MERCHANT: 0,
  DRIVER: 1,
  BAKER: 2,
  ADMIN: 3,
  SUPER_ADMIN: 4,
};

async function fetchUsers() {
  const res = await fetch("/api/users");
  const json = await res.json();
  if (!res.ok) throw new Error(json.error);
  return json.data as UserRow[];
}

export default function UsersPage() {
  const { role } = usePermissions();
  const platformReadOnly = role === "SUPER_ADMIN";
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const { data: users, isLoading, error } = useQuery({
    queryKey: ["users"],
    queryFn: fetchUsers,
    staleTime: 0,
    refetchOnMount: "always",
  });

  const columns = useMemo((): TableColumn<UserRow & { name: string }>[] => [
    {
      key: "name",
      header: "Nom",
      sortable: true,
      className: USER_TABLE_COL.name,
      cell: (row) => (
        <div className="min-w-0">
          <TableUserName name={row.name} />
          {row.merchant ? <p className="truncate text-xs text-muted-foreground" data-testid="user-merchant">{row.merchant.name}</p> : null}
        </div>
      ),
    },
    {
      key: "email",
      header: "Email",
      sortable: true,
      hideOnMobile: true,
      className: USER_TABLE_COL.email,
      cell: (row) => <TableUserEmail email={row.email} />,
    },
    {
      key: "role",
      header: "Rôle",
      className: USER_TABLE_COL.role,
      cell: (row) => (
<TableUserRole role={row.role.systemRole} />
      ),
    },
    {
      key: "status",
      header: "Statut",
      className: USER_TABLE_COL.status,
      cell: (row) => <TableUserStatus status={row.status} />,
    },
    {
      key: "actions",
      header: "",
      className: USER_TABLE_COL.actions,
      cell: (row) => (
        <div className="flex items-center justify-end gap-0.5">
          {platformReadOnly || row.role.systemRole === "SUPER_ADMIN" ? null : (
            <>
              <EditUserDialog account={row} name={row.name} />
              <AccountStatusButton account={row} name={row.name} />
            </>
          )}
          {platformReadOnly ? null : (
            <DeleteUserButton
              userId={row.id}
              userName={formatPersonNameByRole(row.firstName, row.lastName, row.role.systemRole)}
              role={row.role.systemRole}
            />
          )}
        </div>
      ),
    },
  ], [platformReadOnly]);

  const rows = useMemo(() => {
    const mapped = (users ?? []).map((u) => ({
      ...u,
      // Le rôle a sa colonne : le nom s'affiche sans préfixe « Client » / « Livreur ».
      name: `${u.firstName} ${u.lastName}`.trim(),
    }));

    const filtered =
      roleFilter === "all"
        ? mapped
        : mapped.filter((u) => u.role.systemRole === roleFilter);

    return filtered.sort((a, b) => {
      const roleDiff =
        ROLE_SORT_ORDER[a.role.systemRole] - ROLE_SORT_ORDER[b.role.systemRole];
      if (roleDiff !== 0) return roleDiff;
      return a.name.localeCompare(b.name, "fr");
    });
  }, [users, roleFilter]);

  const counts = useMemo(() => {
    const all = users ?? [];
    return {
      all: all.length,
      MERCHANT: all.filter((u) => u.role.systemRole === "MERCHANT").length,
      DRIVER: all.filter((u) => u.role.systemRole === "DRIVER").length,
      BAKER: all.filter((u) => u.role.systemRole === "BAKER").length,
      ADMIN: all.filter((u) => u.role.systemRole === "ADMIN").length,
    };
  }, [users]);

  if (isInitialQueryLoading(isLoading, users)) return <PageSkeleton />;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Gestion des comptes</h1>
          <p className="mt-1 text-muted-foreground max-md:hidden">
            Clients, livreurs, boulangers et administrateurs de votre entreprise
          </p>
        </div>
        {platformReadOnly ? null : <CreateUserDialog />}
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>
            {error instanceof Error ? error.message : "Impossible de charger les utilisateurs."}
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader className="space-y-4">
          <CardTitle className="text-base">Comptes</CardTitle>
          <div className="flex flex-wrap gap-2">
            {ROLE_FILTER_OPTIONS.map((option) => (
              <Button
                key={option.value}
                type="button"
                size="sm"
                variant={roleFilter === option.value ? "brand" : "outline"}
                className={cn("h-8")}
                onClick={() => setRoleFilter(option.value)}
              >
                {option.label}
                <span className="ml-1.5 text-xs opacity-80">
                  ({counts[option.value]})
                </span>
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          <DataGrid
            data={rows as unknown as Record<string, unknown>[]}
            columns={columns as unknown as TableColumn<Record<string, unknown>>[]}
            searchKey="name"
            searchPlaceholder="Rechercher un compte..."
            paginate={false}
            emptyTitle={
              roleFilter === "all"
                ? "Aucun utilisateur"
                : `Aucun compte « ${ROLE_FILTER_OPTIONS.find((o) => o.value === roleFilter)?.label ?? ""} »`
            }
            emptyDescription={platformReadOnly ? "Aucun compte ne correspond à cette recherche." : "Créez un compte avec le bouton « Inviter un utilisateur »."}
          />
        </CardContent>
      </Card>
    </div>
  );
}
