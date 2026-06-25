import { Suspense } from "react";
import { AuthForm } from "@/features/auth/auth-form";

export default function ClientLoginPage() {
  return (
    <Suspense>
      <AuthForm mode="login" loginContext="client" />
    </Suspense>
  );
}
