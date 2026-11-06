import { redirect } from "next/navigation";

/** Pas de site public : l'accueil ouvre la connexion, qui oriente ensuite chaque rôle vers son espace. */
export default function HomePage() {
  redirect("/login");
}
