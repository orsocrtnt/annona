import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CompanyLogoCard } from "@/features/back-office/company-logo-card";
import { LocationSettingsForm } from "@/features/back-office/location-settings-form";

/**
 * Paramètres de l'entreprise. L'heure limite, le fuseau, le délai du rappel, les créneaux et les
 * catégories sont désormais en base (`companies`, `slots`, `categories`) ; leur écran viendra avec ADM-1.
 */
export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Paramètres</h1>
        <p className="mt-1 text-muted-foreground max-md:hidden">Identité de l’entreprise et suivi des livreurs</p>
      </div>

      <CompanyLogoCard />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Heure limite, créneaux et rappel</CardTitle>
          <CardDescription>
            Heure limite de commande (17h par défaut), fuseau horaire, délai du rappel et créneaux de livraison.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">À venir avec la tâche ADM-1.</CardContent>
      </Card>

      <LocationSettingsForm />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Facturation</CardTitle>
          <CardDescription>Mentions légales, Factur-X et pied de page des factures.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            <Link href="/settings/billing">Ouvrir les réglages de facturation</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
