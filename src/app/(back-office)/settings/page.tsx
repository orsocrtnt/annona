import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CompanyLogoCard } from "@/features/back-office/company-logo-card";
import { CompanySettingsCard } from "@/features/settings/company-settings-card";
import { SlotsCard } from "@/features/settings/slots-card";
import { fr } from "@/lib/i18n/fr";

const t = fr.companySettings;

/**
 * Paramètres de l'entreprise (ADM-1 : ADM-09, PLA-03, PLA-04) : nom et logo affichés dans les
 * applications, heure limite, fuseau, délai du rappel, créneaux, catégories (catalogue), unités
 * proposées, mentions légales des factures (Réglages › Facturation). Les fréquences du suivi GPS
 * des livreurs sont un réglage technique : jamais affichées à l'utilisateur, valeurs par défaut du serveur.
 */
export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t.title}</h1>
        <p className="mt-1 text-muted-foreground max-md:hidden">{t.subtitle}</p>
      </div>

      <CompanySettingsCard />
      <CompanyLogoCard />
      <SlotsCard />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t.categories}</CardTitle>
          <CardDescription>{t.categoriesHint}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            <Link href="/dashboard/catalog">{t.openCatalog}</Link>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t.billing}</CardTitle>
          <CardDescription>{t.billingHint}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            <Link href="/settings/billing">{t.openBilling}</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
