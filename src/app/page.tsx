import { redirect } from "next/navigation";
import { getServerAuth } from "@/lib/api/server-auth";
import { getDashboardPathForRole } from "@/domains/auth/auth.service";

export default async function HomePage() {
  const auth = await getServerAuth();
  if (!auth) redirect("/login");
  redirect(getDashboardPathForRole(auth.user.role.systemRole));
}
