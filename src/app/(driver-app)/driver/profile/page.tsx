"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ProfileForm } from "@/components/shared/profile-form";
import { ChangePasswordForm } from "@/components/shared/change-password-form";
import { useAuth } from "@/hooks/use-auth";
import { getInitials } from "@/lib/utils";
import { withoutRolePrefix } from "@/lib/format/person-labels";
import { LogOut } from "lucide-react";

export default function DriverProfilePage() {
  const { user, logout } = useAuth();

  return (
    <div className="space-y-6 p-4">
      <div className="flex flex-col items-center py-4">
        <Avatar className="h-20 w-20" aria-hidden="true">
          <AvatarFallback className="bg-brand-subtle text-brand text-xl">
            {user ? getInitials(user.firstName, user.lastName) : "D"}
          </AvatarFallback>
        </Avatar>
        <h1 className="mt-4 text-xl font-semibold">
          {/* Le rôle est déjà dit dessous : le nom seul. */}
          {user ? withoutRolePrefix(`${user.firstName} ${user.lastName}`.trim()) : "Mon profil"}
        </h1>
        <p className="text-sm text-muted-foreground">Chauffeur livreur</p>
      </div>

      <ProfileForm
        title="Mes informations"
        description="Modifiez vos coordonnées personnelles"
      />

      <ChangePasswordForm />

      <Button variant="outline" className="w-full" onClick={logout}>
        <LogOut className="mr-2 h-4 w-4" aria-hidden="true" />
        Déconnexion
      </Button>
    </div>
  );
}
