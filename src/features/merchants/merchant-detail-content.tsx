"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { Switch } from "@/components/ui/switch";
import { MerchantForm } from "@/features/merchants/merchant-form";
import { MerchantPricesPanel } from "@/features/merchants/merchant-prices-panel";
import { useCreateMerchant, useMerchant, useUpdateMerchant } from "@/features/merchants/hooks";
import { TableUserStatus } from "@/features/users/users-table-ui";
import { CreateUserDialog } from "@/features/users/create-user-dialog";
import { AccountStatusButton } from "@/features/users/edit-user-dialog";
import { fr } from "@/lib/i18n/fr";
import { isInitialQueryLoading } from "@/lib/query/is-initial-loading";

const t = fr.merchants;

function BackLink() {
  return (
    <Link href="/dashboard/merchants" className="inline-flex min-h-9 items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
      <ArrowLeft className="size-4" aria-hidden /> {t.back}
    </Link>
  );
}

/** ADM-1 : création d'un client. */
export function MerchantCreateContent() {
  const router = useRouter();
  const create = useCreateMerchant();
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <BackLink />
      <h1 className="text-2xl font-semibold tracking-tight">{t.createTitle}</h1>
      <MerchantForm
        merchant={null}
        submitLabel={t.create}
        pending={create.isPending}
        onSubmit={(input) =>
          create.mutate(input, {
            onSuccess: (merchant) => {
              toast.success(t.created);
              router.push(`/dashboard/merchants/${merchant.id}`);
            },
            onError: (error) => toast.error(error.message),
          })
        }
      />
    </div>
  );
}

/** ADM-1 : fiche d'un client (coordonnées, position, facturation, prix spécifiques, comptes). */
export function MerchantDetailContent({ id }: { id: string }) {
  const merchant = useMerchant(id);
  const update = useUpdateMerchant(id);

  if (isInitialQueryLoading(merchant.isLoading, merchant.data)) return <PageSkeleton />;
  if (merchant.error || !merchant.data) {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <BackLink />
        <Alert variant="destructive"><AlertDescription>{merchant.error?.message ?? fr.common.loadError}</AlertDescription></Alert>
      </div>
    );
  }
  const data = merchant.data;
  const displayName = data.tradeName || data.name;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <BackLink />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{displayName}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t.editTitle}</p>
        </div>
        <Badge variant={data.active ? "success" : "secondary"} data-testid="merchant-status">{data.active ? t.active : t.inactive}</Badge>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
          <div>
            <p className="text-sm font-medium">{data.active ? t.active : t.inactive}</p>
            <p className="text-xs text-muted-foreground">{t.inactiveHint}</p>
          </div>
          <Switch
            checked={data.active}
            aria-label={data.active ? t.deactivate : t.reactivate}
            disabled={update.isPending}
            onCheckedChange={(checked) =>
              update.mutate({ active: checked }, {
                onSuccess: () => toast.success(checked ? t.reactivated : t.deactivated),
                onError: (error) => toast.error(error.message),
              })
            }
          />
        </CardContent>
      </Card>

      <MerchantForm
        key={data.id}
        merchant={data}
        submitLabel={t.save}
        pending={update.isPending}
        onSubmit={(input) => update.mutate(input, { onSuccess: () => toast.success(t.saved), onError: (error) => toast.error(error.message) })}
      />

      <MerchantPricesPanel merchantId={data.id} />

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
          <div>
            <CardTitle className="text-base">{t.users}</CardTitle>
            <CardDescription>{t.usersHint}</CardDescription>
          </div>
          <CreateUserDialog merchant={{ id: data.id, name: displayName }} triggerLabel={t.addUser} />
        </CardHeader>
        <CardContent>
          {data.users.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t.noUsers}</p>
          ) : (
            <ul className="divide-y rounded-lg border" data-testid="merchant-users">
              {data.users.map((user) => {
                const name = `${user.firstName} ${user.lastName}`.trim();
                return (
                  <li key={user.id} className="flex items-center gap-3 px-3 py-2 text-sm" data-testid="merchant-user" data-email={user.email}>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{name}</p>
                      <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                    </div>
                    <TableUserStatus status={user.status} />
                    <AccountStatusButton account={{ ...user, role: { systemRole: "MERCHANT" } }} name={name} />
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
