"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Copy, ExternalLink, KeyRound, X } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/services/supabase/client";
import { useAuthStore } from "@/stores/auth.store";
import type { SystemRole } from "@prisma/client";

export interface PendingCredentials {
  email: string;
  password: string;
  role: SystemRole;
}

const LOGIN_URLS: Partial<Record<SystemRole, string>> = {
  CLIENT: "/login/client",
  DRIVER: "/login/driver",
  DISPATCHER: "/login",
  MINI_ADMIN: "/login",
};

interface UserCredentialsCellProps {
  credentials: PendingCredentials;
  onDismiss?: () => void;
}

export function UserCredentialsCell({ credentials, onDismiss }: UserCredentialsCellProps) {
  const loginPath = LOGIN_URLS[credentials.role] ?? "/login";
  const loginUrl = `${typeof window !== "undefined" ? window.location.origin : ""}${loginPath}`;

  const text = [
    `Identifiant : ${credentials.email}`,
    `Mot de passe : ${credentials.password}`,
    `Connexion : ${loginUrl}`,
  ].join("\n");

  const copyAll = () => {
    navigator.clipboard.writeText(text);
    toast.success("Identifiants copiés");
  };

  const testLogin = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    useAuthStore.getState().logout();
    const params = new URLSearchParams({ email: credentials.email });
    window.location.href = `${loginPath}?${params.toString()}`;
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-7 w-full min-w-0 gap-1 px-2 text-[10px]"
        >
          <KeyRound className="h-3 w-3 shrink-0" />
          <span className="truncate">MDP</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 p-3">
        <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          À transmettre au compte
        </p>
        <div className="space-y-2 text-xs">
          <div>
            <p className="text-muted-foreground">Identifiant</p>
            <p className="break-all font-mono">{credentials.email}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Mot de passe</p>
            <p className="break-all font-mono">{credentials.password}</p>
          </div>
        </div>
        <DropdownMenuSeparator className="my-2" />
        <DropdownMenuItem onClick={copyAll} className="text-xs">
          <Copy className="mr-2 h-3.5 w-3.5" />
          Copier tout
        </DropdownMenuItem>
        {(credentials.role === "CLIENT" || credentials.role === "DRIVER") && (
          <DropdownMenuItem onClick={testLogin} className="text-xs">
            <ExternalLink className="mr-2 h-3.5 w-3.5" />
            Tester la connexion
          </DropdownMenuItem>
        )}
        {onDismiss && (
          <>
            <DropdownMenuSeparator className="my-2" />
            <DropdownMenuItem onClick={onDismiss} className="text-xs text-muted-foreground">
              <X className="mr-2 h-3.5 w-3.5" />
              Masquer
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
