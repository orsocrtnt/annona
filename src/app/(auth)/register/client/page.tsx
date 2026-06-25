import { redirect } from "next/navigation";

export default function ClientRegisterRedirect() {
  redirect("/login/client");
}
