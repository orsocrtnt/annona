-- POD-2 : preuve de livraison complète (signature, réceptionnaire, position au moment de la livraison).
-- Additive : colonnes nullables sur "deliveries" (table déjà sous RLS, droits anon/authenticated
-- retirés par les migrations précédentes). Aucun nouveau bucket : la signature est stockée dans le
-- bucket privé "delivery-pods", sous companyId/deliveryId-sig-….png.

-- AlterTable
ALTER TABLE "deliveries" ADD COLUMN     "pod_signature_path" TEXT,
ADD COLUMN     "pod_recipient_name" TEXT,
ADD COLUMN     "pod_signature_refused_reason" TEXT,
ADD COLUMN     "pod_latitude" DOUBLE PRECISION,
ADD COLUMN     "pod_longitude" DOUBLE PRECISION,
ADD COLUMN     "pod_position_at" TIMESTAMP(3);
