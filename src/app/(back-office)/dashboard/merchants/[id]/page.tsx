import { MerchantDetailContent } from "@/features/merchants/merchant-detail-content";

export default async function MerchantPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <MerchantDetailContent id={id} />;
}
