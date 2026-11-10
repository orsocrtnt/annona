"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Pencil, UserCheck, UserX } from "lucide-react";
import { toast } from "sonner";
import type { SystemRole } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMerchantChoices } from "@/features/catalog/hooks";
import { MiniAdminModulesField } from "@/features/users/mini-admin-modules-field";
import { usePermissions } from "@/hooks/use-permissions";
import type { MiniAdminModuleId } from "@/lib/permissions/mini-admin";
import { fr } from "@/lib/i18n/fr";
import type { UpdateAccountRequest as UpdateAccountInput } from "@/lib/validations/company-admin";

const t = fr.accounts;
const ROLE_SLUGS: Record<Exclude<SystemRole, "SUPER_ADMIN">, UpdateAccountInput["roleSlug"]> = {
  MERCHANT: "merchant",
  DRIVER: "driver",
  BAKER: "baker",
  ADMIN: "admin",
};

export interface EditableAccount {
  id: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  status: string;
  role: { systemRole: SystemRole };
  merchant?: { id: string; name: string } | null;
  /** Lot 1, demande 4 : fonctionnalités d'un mini admin ; `null` = accès complet. */
  miniAdminModules?: MiniAdminModuleId[] | null;
}

type AccountKind = NonNullable<UpdateAccountInput["roleSlug"]> | "mini-admin";

async function patchAccount(id: string, input: UpdateAccountInput) {
  const res = await fetch(`/api/users/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? "Enregistrement impossible.");
  return json.data;
}

function useAccountMutation(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateAccountInput) => patchAccount(id, input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["users"] });
      void qc.invalidateQueries({ queryKey: ["merchants"] });
    },
  });
}

/** ADM-01 : désactiver (connexion et API refusées) ou réactiver un compte. */
export function AccountStatusButton({ account, name }: { account: EditableAccount; name: string }) {
  const mutation = useAccountMutation(account.id);
  const inactive = account.status === "INACTIVE";
  const label = inactive ? t.reactivateOf(name) : t.deactivateOf(name);
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label={label}
      title={label}
      loading={mutation.isPending}
      onClick={() =>
        mutation.mutate({ active: inactive }, {
          onSuccess: () => toast.success(inactive ? t.reactivated : t.deactivated),
          onError: (error) => toast.error(error.message),
        })
      }
    >
      {inactive ? <UserCheck /> : <UserX />}
    </Button>
  );
}

/** ADM-01 : modifier nom, téléphone, rôle et client rattaché d'un compte. */
export function EditUserDialog({ account, name }: { account: EditableAccount; name: string }) {
  const [open, setOpen] = useState(false);
  const mutation = useAccountMutation(account.id);
  const merchants = useMerchantChoices(open);
  const initialRole = account.role.systemRole === "SUPER_ADMIN" ? "admin" : ROLE_SLUGS[account.role.systemRole];
  const [firstName, setFirstName] = useState(account.firstName);
  const [lastName, setLastName] = useState(account.lastName);
  const [phone, setPhone] = useState(account.phone ?? "");
  const { isFullAdmin } = usePermissions();
  const [kind, setKind] = useState<AccountKind>(initialRole === "admin" && account.miniAdminModules ? "mini-admin" : initialRole ?? "merchant");
  const [modules, setModules] = useState<MiniAdminModuleId[]>(account.miniAdminModules ?? []);
  const [modulesError, setModulesError] = useState<string | null>(null);
  const [merchantId, setMerchantId] = useState(account.merchant?.id ?? "");
  const roleSlug = kind === "mini-admin" ? "admin" : kind;
  const kinds: AccountKind[] = isFullAdmin ? ["merchant", "driver", "baker", "admin", "mini-admin"] : ["merchant", "driver", "baker"];

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (kind === "mini-admin" && modules.length === 0) return setModulesError(t.modulesRequired);
    setModulesError(null);
    mutation.mutate(
      {
        firstName,
        lastName,
        phone: phone.trim() || null,
        roleSlug,
        merchantId: roleSlug === "merchant" ? merchantId || null : null,
        // Lot 1, demande 4 : fonctionnalités envoyées seulement par un administrateur complet.
        ...(isFullAdmin && roleSlug === "admin" ? { miniAdminModules: kind === "mini-admin" ? modules : null } : {}),
      },
      {
        onSuccess: () => {
          toast.success(t.saved);
          setOpen(false);
        },
        onError: (error) => toast.error(error.message),
      }
    );
  };

  return (
    <>
      <Button type="button" variant="ghost" size="icon-sm" aria-label={t.editTitle(name)} title={t.editTitle(name)} onClick={() => setOpen(true)}>
        <Pencil />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t.editTitle(name)}</DialogTitle>
            <DialogDescription>{t.statuses[account.status as keyof typeof t.statuses] ?? account.status}</DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField label={t.firstName} required>
                <Input value={firstName} onChange={(event) => setFirstName(event.target.value)} />
              </FormField>
              <FormField label={t.lastName} required>
                <Input value={lastName} onChange={(event) => setLastName(event.target.value)} />
              </FormField>
            </div>
            <FormField label={t.phone}>
              <Input type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} />
            </FormField>
            <FormField label={t.role}>
              <Select value={kind} onValueChange={(value) => setKind(value as AccountKind)}>
                <SelectTrigger aria-label={t.role} data-testid="edit-user-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {kinds.map((slug) => (
                    <SelectItem key={slug} value={slug}>{slug === "mini-admin" ? t.miniAdmin : slug === "admin" ? t.fullAdmin : t.roleOptions[slug]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            {kind === "mini-admin" ? <MiniAdminModulesField value={modules} onChange={setModules} error={modulesError} /> : null}
            {roleSlug === "merchant" ? (
              <FormField label={t.merchant} required>
                <Select value={merchantId} onValueChange={setMerchantId}>
                  <SelectTrigger aria-label={t.merchant}>
                    <SelectValue placeholder={t.chooseMerchant} />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {(merchants.data ?? []).map((row) => (
                      <SelectItem key={row.id} value={row.id}>{row.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
            ) : null}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>{fr.common.cancel}</Button>
              <Button type="submit" variant="brand" loading={mutation.isPending}>{fr.common.save}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
