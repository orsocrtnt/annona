import { Suspense } from "react";
import { AuthForm } from "@/features/auth/auth-form";

export default function DriverLoginPage() {
  return (
    <Suspense>
      <AuthForm mode="login" loginContext="driver" />
    </Suspense>
  );
}
