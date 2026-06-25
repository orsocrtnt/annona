-- Étape 1 : convertir en texte et mapper les anciennes valeurs
ALTER TABLE orders ALTER COLUMN status DROP DEFAULT;
ALTER TABLE deliveries ALTER COLUMN status DROP DEFAULT;

DO $$ BEGIN
  ALTER TABLE orders ALTER COLUMN status TYPE text USING status::text;
EXCEPTION WHEN others THEN
  NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE deliveries ALTER COLUMN status TYPE text USING status::text;
EXCEPTION WHEN others THEN
  NULL;
END $$;

UPDATE orders SET status = 'ASSIGNED' WHERE status IN ('PROCESSING');
UPDATE orders SET status = 'IN_DELIVERY' WHERE status IN ('SHIPPED');
UPDATE orders SET status = 'PENDING' WHERE status IN ('CANCELLED');
UPDATE deliveries SET status = 'ASSIGNED' WHERE status IN ('FAILED', 'DELAYED', 'PROCESSING');
UPDATE deliveries SET status = 'IN_DELIVERY' WHERE status IN ('IN_TRANSIT', 'SHIPPED');

DROP TYPE IF EXISTS "OrderStatus" CASCADE;
DROP TYPE IF EXISTS "DeliveryStatus" CASCADE;

-- Étape 2 : recréer les enums
CREATE TYPE "OrderStatus" AS ENUM (
  'PENDING', 'ASSIGNED', 'PURCHASING', 'IN_DELIVERY', 'DELIVERED', 'INVOICED', 'PAID'
);

CREATE TYPE "DeliveryStatus" AS ENUM (
  'PENDING', 'ASSIGNED', 'PURCHASING', 'IN_DELIVERY', 'DELIVERED', 'INVOICED', 'PAID'
);

ALTER TABLE orders
  ALTER COLUMN status TYPE "OrderStatus" USING status::"OrderStatus",
  ALTER COLUMN status SET DEFAULT 'PENDING';

ALTER TABLE deliveries
  ALTER COLUMN status TYPE "DeliveryStatus" USING status::"DeliveryStatus",
  ALTER COLUMN status SET DEFAULT 'PENDING';
