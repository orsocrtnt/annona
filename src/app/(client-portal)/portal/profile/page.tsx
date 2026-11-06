"use client";

import { ProfileForm } from "@/components/shared/profile-form";
import { MerchantProfileCard } from "@/features/ordering/merchant-profile-card";
import { ChangePasswordForm } from "@/components/shared/change-password-form";
import { ThemePreferenceField } from "@/components/theme/theme-preference-choice";

export default function ClientProfilePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Mon profil</h1>
        <p className="mt-1 text-muted-foreground max-md:hidden">Gérez vos informations personnelles</p>
      </div>
      <MerchantProfileCard />
      <ProfileForm />
      <ChangePasswordForm />
      <ThemePreferenceField />
    </div>
  );
}
