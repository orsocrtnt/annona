import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicOrderPage } from "@/domains/public-order/public-order.service";
import { PublicOrderForm } from "@/features/public-order/public-order-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Passer une commande", robots: { index: false, follow: false }, referrer: "no-referrer" };

export default async function PublicOrderPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const page = await getPublicOrderPage(token);
  if (!page) notFound();
  return (
    <main id="main-content" className="mx-auto max-w-2xl px-4 py-8 sm:py-12">
      <h1 className="text-2xl font-semibold tracking-tight">Commander chez {page.companyName}</h1>
      <p className="mt-1 text-muted-foreground">Pas de compte à créer. Vous recevrez un lien par e-mail pour suivre votre livraison.</p>
      <PublicOrderForm token={token} slots={page.slots} />
    </main>
  );
}
