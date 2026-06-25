"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ProfileForm } from "@/components/shared/profile-form";
import { ChangePasswordForm } from "@/components/shared/change-password-form";
import { useAuth } from "@/hooks/use-auth";
import { getInitials } from "@/lib/utils";
import { formatDriverFromParts } from "@/lib/format/person-labels";
import { LogOut, Truck, Star } from "lucide-react";

export default function DriverProfilePage() {
  const { user, logout } = useAuth();

  return (
    <div className="space-y-6 p-4">
      <div className="flex flex-col items-center py-4">
        <Avatar className="h-20 w-20">
          <AvatarFallback className="bg-brand-subtle text-brand text-xl">
            {user ? getInitials(user.firstName, user.lastName) : "D"}
          </AvatarFallback>
        </Avatar>
        <h1 className="mt-4 text-xl font-semibold">
          {user
            ? formatDriverFromParts(
                { firstName: user.firstName, lastName: user.lastName },
                null
              )
            : "Livreur"}
        </h1>
        <p className="text-sm text-muted-foreground">Chauffeur livreur</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="flex flex-col items-center p-4">
            <Truck className="h-5 w-5 text-brand" />
            <p className="mt-2 text-lg font-semibold">—</p>
            <p className="text-xs text-muted-foreground">Livraisons</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col items-center p-4">
            <Star className="h-5 w-5 text-warning" />
            <p className="mt-2 text-lg font-semibold">—</p>
            <p className="text-xs text-muted-foreground">Note</p>
          </CardContent>
        </Card>
      </div>

      <ProfileForm
        title="Mes informations"
        description="Modifiez vos coordonnées personnelles"
      />

      <ChangePasswordForm />

      <Button variant="outline" className="w-full" onClick={logout}>
        <LogOut className="mr-2 h-4 w-4" />
        Déconnexion
      </Button>
    </div>
  );
}
