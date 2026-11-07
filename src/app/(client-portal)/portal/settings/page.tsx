"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PageLoader } from "@/components/ui/loader";
import { ProfileForm } from "@/components/shared/profile-form";
import { ChangePasswordForm } from "@/components/shared/change-password-form";
import {
  usePortalSettings,
  useUpdatePortalSettings,
} from "@/features/client-portal/hooks";
import { clientSettingsSchema, type ClientSettingsInput } from "@/lib/validations/settings";
import { toast } from "sonner";
import { Bell } from "lucide-react";
import { fr } from "@/lib/i18n/fr";

const t = fr.notifications.settings;

const DEFAULT_SETTINGS: ClientSettingsInput = {
  emailNotifications: true,
  deliveryAlerts: true,
  invoiceAlerts: true,
  orderReminders: true,
};

export default function ClientSettingsPage() {
  const {
    data: settings,
    isLoading: loadingSettings,
    isError: settingsError,
    error: settingsErrorMsg,
    refetch: refetchSettings,
  } = usePortalSettings();

  const updateSettings = useUpdatePortalSettings();

  const settingsForm = useForm<ClientSettingsInput>({
    resolver: zodResolver(clientSettingsSchema),
    values: {
      emailNotifications: settings?.emailNotifications ?? DEFAULT_SETTINGS.emailNotifications,
      deliveryAlerts: settings?.deliveryAlerts ?? DEFAULT_SETTINGS.deliveryAlerts,
      invoiceAlerts: settings?.invoiceAlerts ?? DEFAULT_SETTINGS.invoiceAlerts,
      orderReminders: settings?.orderReminders ?? DEFAULT_SETTINGS.orderReminders,
    },
  });

  const onSaveSettings = async (data: ClientSettingsInput) => {
    try {
      await updateSettings.mutateAsync(data);
      toast.success("Alertes enregistrées");
    } catch {
      toast.error("Mise à jour impossible");
    }
  };

  const initialLoading = loadingSettings && !settings;

  if (initialLoading) return <PageLoader label="Chargement des paramètres..." />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Paramètres</h1>
        <p className="mt-1 text-muted-foreground max-md:hidden">Gérez votre profil et vos alertes</p>
      </div>

      <ProfileForm title="Informations personnelles" description="Modifiez votre nom et téléphone" />

      <ChangePasswordForm />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bell className="h-4 w-4" />
            {t.title}
          </CardTitle>
          <CardDescription>{t.hint}</CardDescription>
        </CardHeader>
        <CardContent>
          {settingsError ? (
            <Alert variant="destructive">
              <AlertDescription className="flex items-center justify-between gap-4">
                <span>
                  {settingsErrorMsg instanceof Error
                    ? settingsErrorMsg.message
                    : "Impossible de charger les alertes"}
                </span>
                <Button variant="outline" size="touch" onClick={() => refetchSettings()}>
                  Réessayer
                </Button>
              </AlertDescription>
            </Alert>
          ) : (
            <form onSubmit={settingsForm.handleSubmit(onSaveSettings)} className="space-y-4">
              {(
                [
                  ["orderReminders", t.reminder],
                  ["invoiceAlerts", t.invoices],
                  ["emailNotifications", t.emailCopy],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="flex items-center justify-between gap-4 max-md:min-h-11 max-md:cursor-pointer">
                  <span className="text-sm">{label}</span>
                  <input
                    type="checkbox"
                    checked={Boolean(settingsForm.watch(key))}
                    onChange={(e) => settingsForm.setValue(key, e.target.checked)}
                    className="h-4 w-4 rounded border-input max-md:size-5"
                  />
                </label>
              ))}
              <p className="text-xs text-muted-foreground">{t.always}</p>
              <p className="text-xs text-muted-foreground">
                {settings?.emailMode === "test"
                  ? "Mode recette actif : les copies sont redirigées vers la boîte de test, jamais vers les clients."
                  : settings?.emailConfigured
                    ? "Les e-mails seront envoyés à l’adresse de ce compte."
                    : "Les copies par e-mail ne sont pas encore actives : les alertes restent visibles dans la cloche."}
              </p>
              <Button type="submit" variant="brand" loading={updateSettings.isPending}>
                Enregistrer les alertes
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
