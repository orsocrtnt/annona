"use client";

import { ProfileForm } from "@/components/shared/profile-form";
import { ChangePasswordForm } from "@/components/shared/change-password-form";

export default function ClientProfilePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Mon profil</h1>
        <p className="mt-1 text-muted-foreground">Gérez vos informations personnelles</p>
      </div>
      <ProfileForm />
      <ChangePasswordForm />
    </div>
  );
}
