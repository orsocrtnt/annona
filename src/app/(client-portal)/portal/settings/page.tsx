"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PageLoader } from "@/components/ui/loader";
import { ProfileForm } from "@/components/shared/profile-form";
import { ChangePasswordForm } from "@/components/shared/change-password-form";
import {
  usePortalAddresses,
  useCreateAddress,
  useDeleteAddress,
  useUpdateAddress,
  usePortalSettings,
  useUpdatePortalSettings,
} from "@/features/client-portal/hooks";
import { customerAddressSchema, type CustomerAddressInput } from "@/lib/validations/address";
import { clientSettingsSchema, type ClientSettingsInput } from "@/lib/validations/settings";
import { toast } from "sonner";
import { MapPin, Bell, Trash2, AlertCircle } from "lucide-react";

const DEFAULT_SETTINGS: ClientSettingsInput = {
  emailNotifications: true,
  smsNotifications: false,
  deliveryAlerts: true,
  invoiceAlerts: true,
};

export default function ClientSettingsPage() {
  const {
    data: addresses,
    isLoading: loadingAddresses,
    isError: addressesError,
    error: addressesErrorMsg,
    refetch: refetchAddresses,
  } = usePortalAddresses();

  const {
    data: settings,
    isLoading: loadingSettings,
    isError: settingsError,
    error: settingsErrorMsg,
    refetch: refetchSettings,
  } = usePortalSettings();

  const createAddress = useCreateAddress();
  const updateAddress = useUpdateAddress();
  const deleteAddress = useDeleteAddress();
  const updateSettings = useUpdatePortalSettings();

  const addressForm = useForm<CustomerAddressInput>({
    resolver: zodResolver(customerAddressSchema),
    defaultValues: { label: "", address: "", city: "", postalCode: "" },
  });

  const settingsForm = useForm<ClientSettingsInput>({
    resolver: zodResolver(clientSettingsSchema),
    values: settings ?? DEFAULT_SETTINGS,
  });

  const onAddAddress = async (data: CustomerAddressInput) => {
    try {
      await createAddress.mutateAsync(data);
      addressForm.reset();
      toast.success("Adresse ajoutée");
    } catch {
      toast.error("Impossible d'ajouter l'adresse");
    }
  };

  const onSaveSettings = async (data: ClientSettingsInput) => {
    try {
      await updateSettings.mutateAsync(data);
      toast.success("Préférences enregistrées");
    } catch {
      toast.error("Mise à jour impossible");
    }
  };

  const initialLoading = loadingAddresses && loadingSettings && !addresses && !settings;

  if (initialLoading) return <PageLoader label="Chargement des paramètres..." />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Paramètres</h1>
        <p className="mt-1 text-muted-foreground">Gérez votre profil, vos adresses et vos préférences</p>
      </div>

      <ProfileForm title="Informations personnelles" description="Modifiez votre nom et téléphone" />

      <ChangePasswordForm />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MapPin className="h-4 w-4" />
            Mes adresses
          </CardTitle>
          <CardDescription>Adresses de livraison enregistrées</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {addressesError ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="flex items-center justify-between gap-4">
                <span>
                  {addressesErrorMsg instanceof Error
                    ? addressesErrorMsg.message
                    : "Impossible de charger les adresses"}
                </span>
                <Button variant="outline" size="sm" onClick={() => refetchAddresses()}>
                  Réessayer
                </Button>
              </AlertDescription>
            </Alert>
          ) : (
            <>
              {addresses?.map((addr) => (
                <div
                  key={addr.id}
                  className="flex flex-col gap-3 rounded-lg border border-border p-4 max-md:gap-3 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div>
                    <p className="font-medium">
                      {addr.label}{" "}
                      {addr.isDefault && (
                        <span className="text-xs text-brand">(par défaut)</span>
                      )}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {addr.address}, {addr.postalCode} {addr.city}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 sm:justify-end">
                    {!addr.isDefault && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          updateAddress.mutate({ id: addr.id, data: { isDefault: true } })
                        }
                      >
                        Par défaut
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => deleteAddress.mutate(addr.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}

              {addresses?.length === 0 && (
                <p className="text-sm text-muted-foreground">Aucune adresse enregistrée.</p>
              )}

              <form
                onSubmit={addressForm.handleSubmit(onAddAddress)}
                className="space-y-3 border-t border-border pt-4"
              >
                <p className="text-sm font-medium">Ajouter une adresse</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input placeholder="Libellé" {...addressForm.register("label")} />
                  <Input placeholder="Adresse" {...addressForm.register("address")} />
                  <Input placeholder="Ville" {...addressForm.register("city")} />
                  <Input placeholder="Code postal" {...addressForm.register("postalCode")} />
                </div>
                <Button type="submit" variant="outline" size="sm" loading={createAddress.isPending}>
                  Ajouter
                </Button>
              </form>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bell className="h-4 w-4" />
            Notifications
          </CardTitle>
        </CardHeader>
        <CardContent>
          {settingsError ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="flex items-center justify-between gap-4">
                <span>
                  {settingsErrorMsg instanceof Error
                    ? settingsErrorMsg.message
                    : "Impossible de charger les préférences"}
                </span>
                <Button variant="outline" size="sm" onClick={() => refetchSettings()}>
                  Réessayer
                </Button>
              </AlertDescription>
            </Alert>
          ) : (
            <form onSubmit={settingsForm.handleSubmit(onSaveSettings)} className="space-y-4">
              {(
                [
                  ["emailNotifications", "Notifications par email"],
                  ["smsNotifications", "Notifications SMS"],
                  ["deliveryAlerts", "Alertes de livraison"],
                  ["invoiceAlerts", "Alertes de facturation"],
                ] as const
              ).map(([key, label]) => (
                <div key={key} className="flex items-center justify-between gap-4 max-md:flex-col max-md:items-start">
                  <span className="text-sm">{label}</span>
                  <input
                    type="checkbox"
                    checked={settingsForm.watch(key)}
                    onChange={(e) => settingsForm.setValue(key, e.target.checked)}
                    className="h-4 w-4 rounded border-input"
                  />
                </div>
              ))}
              <Button type="submit" variant="brand" loading={updateSettings.isPending}>
                Enregistrer les préférences
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
