-- SCHEMA-1 (6 novembre 2026) : migration initiale unique du produit boulangerie.
-- Partie 1 générée par `prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script`.

-- CreateEnum
CREATE TYPE "SystemRole" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'BAKER', 'DRIVER', 'MERCHANT');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING_VERIFICATION');

-- CreateEnum
CREATE TYPE "CompanyStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'TRIAL');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('DRAFT', 'VALIDATED', 'LOCKED', 'PREPARED', 'DELIVERED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "OrderOrigin" AS ENUM ('MANUAL', 'RECURRING');

-- CreateEnum
CREATE TYPE "BillingPeriod" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('VIREMENT', 'PRELEVEMENT', 'ESPECES');

-- CreateEnum
CREATE TYPE "RoundStatus" AS ENUM ('DRAFT', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "StopStatus" AS ENUM ('PENDING', 'DELIVERED', 'INCIDENT');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'PENDING', 'PAID', 'OVERDUE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SupportTicketStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "SupportTicketPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "SupportContactType" AS ENUM ('ADMIN', 'DRIVER');

-- CreateEnum
CREATE TYPE "OperationJobType" AS ENUM ('CLIENT_NOTIFICATION', 'DRIVER_NOTIFICATION');

-- CreateEnum
CREATE TYPE "OperationJobStatus" AS ENUM ('PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED');

-- CreateTable
CREATE TABLE "companies" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logo_url" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "city" TEXT,
    "country" TEXT DEFAULT 'FR',
    "status" "CompanyStatus" NOT NULL DEFAULT 'TRIAL',
    "cutoff_time" TEXT NOT NULL DEFAULT '17:00',
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Paris',
    "reminder_lead_minutes" INTEGER NOT NULL DEFAULT 120,
    "settings" JSONB DEFAULT '{}',
    "legal_name" TEXT,
    "siren" TEXT,
    "siret" TEXT,
    "billing_address" TEXT,
    "billing_postal_code" TEXT,
    "billing_city" TEXT,
    "depot_latitude" DOUBLE PRECISION,
    "depot_longitude" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "auth_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "phone" TEXT,
    "avatar_url" TEXT,
    "settings" JSONB DEFAULT '{}',
    "status" "UserStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "company_id" TEXT,
    "role_id" TEXT NOT NULL,
    "merchant_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "last_login_at" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "system_role" "SystemRole" NOT NULL,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "resource" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "role_id" TEXT NOT NULL,
    "permission_id" TEXT NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_id","permission_id")
);

-- CreateTable
CREATE TABLE "merchants" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "trade_name" TEXT,
    "siren" TEXT,
    "vat_number" TEXT,
    "address" TEXT NOT NULL,
    "postal_code" TEXT,
    "city" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "access_instructions" TEXT,
    "contact_name" TEXT,
    "contact_phone" TEXT,
    "contact_email" TEXT,
    "billing_email" TEXT,
    "billing_address" TEXT,
    "billing_postal_code" TEXT,
    "billing_city" TEXT,
    "billing_period" "BillingPeriod" NOT NULL DEFAULT 'MONTHLY',
    "payment_method" "PaymentMethod",
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "merchants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "photo_url" TEXT,
    "unit" TEXT NOT NULL,
    "base_price_cents" INTEGER NOT NULL,
    "vat_rate_basis_points" INTEGER NOT NULL DEFAULT 550,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "merchant_prices" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "merchant_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "price_cents" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "merchant_prices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "slots" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "label" TEXT,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "merchant_id" TEXT NOT NULL,
    "delivery_date" DATE NOT NULL,
    "slot_id" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'DRAFT',
    "origin" "OrderOrigin" NOT NULL DEFAULT 'MANUAL',
    "notes" TEXT,
    "validated_at" TIMESTAMP(3),
    "locked_at" TIMESTAMP(3),
    "prepared_at" TIMESTAMP(3),
    "delivered_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "recurring_order_id" TEXT,
    "created_by_id" TEXT,
    "invoice_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_lines" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "quantity_ordered" INTEGER NOT NULL,
    "quantity_delivered" INTEGER,
    "unit_price_frozen_cents" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recurring_orders" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "merchant_id" TEXT NOT NULL,
    "slot_id" TEXT NOT NULL,
    "label" TEXT,
    "weekdays" INTEGER[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recurring_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recurring_order_lines" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "recurring_order_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "recurring_order_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rounds" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "slot_id" TEXT NOT NULL,
    "driver_id" TEXT,
    "name" TEXT,
    "status" "RoundStatus" NOT NULL DEFAULT 'DRAFT',
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rounds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stops" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "round_id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "status" "StopStatus" NOT NULL DEFAULT 'PENDING',
    "estimated_arrival_at" TIMESTAMP(3),
    "delivered_at" TIMESTAMP(3),
    "incident_code" TEXT,
    "incident_comment" TEXT,
    "incident_photo_path" TEXT,
    "incident_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stops_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "merchant_id" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "reference" TEXT NOT NULL,
    "period_type" "BillingPeriod" NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "due_date" TIMESTAMP(3),
    "subtotal_cents" INTEGER NOT NULL,
    "vat_cents" INTEGER NOT NULL,
    "total_cents" INTEGER NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'PENDING',
    "payment_method" "PaymentMethod",
    "paid_at" TIMESTAMP(3),
    "notes" TEXT,
    "pdf_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_lines" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "product_id" TEXT,
    "label" TEXT NOT NULL,
    "unit" TEXT,
    "quantity" INTEGER NOT NULL,
    "unit_price_cents" INTEGER NOT NULL,
    "vat_rate_basis_points" INTEGER NOT NULL,
    "total_cents" INTEGER NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "invoice_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "paid_at" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "recorded_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_counters" (
    "company_id" TEXT NOT NULL,
    "last_number" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoice_counters_pkey" PRIMARY KEY ("company_id")
);

-- CreateTable
CREATE TABLE "invoice_reminders" (
    "id" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'EMAIL',
    "result" TEXT NOT NULL,
    "completed_at" TIMESTAMP(3),
    "invoice_id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "sent_by_id" TEXT,
    "operation_job_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoice_reminders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "actor_id" TEXT,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_tickets" (
    "id" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" "SupportTicketStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "SupportTicketPriority" NOT NULL DEFAULT 'NORMAL',
    "contact_type" "SupportContactType",
    "company_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "related_order_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_ticket_messages" (
    "id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "is_staff" BOOLEAN NOT NULL DEFAULT false,
    "company_id" TEXT NOT NULL,
    "ticket_id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_ticket_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_notifications" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "href" TEXT,
    "read_at" TIMESTAMP(3),
    "company_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "driver_locations" (
    "driver_id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "accuracy" DOUBLE PRECISION,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "driver_locations_pkey" PRIMARY KEY ("driver_id")
);

-- CreateTable
CREATE TABLE "driver_push_subscriptions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "driver_push_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operation_jobs" (
    "id" TEXT NOT NULL,
    "job_key" TEXT NOT NULL,
    "type" "OperationJobType" NOT NULL,
    "status" "OperationJobStatus" NOT NULL DEFAULT 'PENDING',
    "payload" JSONB NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 3,
    "next_attempt_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "locked_at" TIMESTAMP(3),
    "last_error" TEXT,
    "completed_at" TIMESTAMP(3),
    "company_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "operation_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_login_failures" (
    "id" TEXT NOT NULL,
    "key_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_login_failures_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "companies_slug_key" ON "companies"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "companies_siren_key" ON "companies"("siren");

-- CreateIndex
CREATE UNIQUE INDEX "companies_siret_key" ON "companies"("siret");

-- CreateIndex
CREATE INDEX "companies_status_idx" ON "companies"("status");

-- CreateIndex
CREATE UNIQUE INDEX "users_auth_id_key" ON "users"("auth_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_company_id_idx" ON "users"("company_id");

-- CreateIndex
CREATE INDEX "users_role_id_idx" ON "users"("role_id");

-- CreateIndex
CREATE INDEX "users_merchant_id_idx" ON "users"("merchant_id");

-- CreateIndex
CREATE UNIQUE INDEX "roles_slug_key" ON "roles"("slug");

-- CreateIndex
CREATE INDEX "roles_system_role_idx" ON "roles"("system_role");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_slug_key" ON "permissions"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_resource_action_key" ON "permissions"("resource", "action");

-- CreateIndex
CREATE INDEX "role_permissions_permission_id_idx" ON "role_permissions"("permission_id");

-- CreateIndex
CREATE INDEX "merchants_company_id_active_idx" ON "merchants"("company_id", "active");

-- CreateIndex
CREATE INDEX "merchants_company_id_name_idx" ON "merchants"("company_id", "name");

-- CreateIndex
CREATE INDEX "categories_company_id_sort_order_idx" ON "categories"("company_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "categories_company_id_name_key" ON "categories"("company_id", "name");

-- CreateIndex
CREATE INDEX "products_category_id_sort_order_idx" ON "products"("category_id", "sort_order");

-- CreateIndex
CREATE INDEX "products_company_id_active_idx" ON "products"("company_id", "active");

-- CreateIndex
CREATE UNIQUE INDEX "products_company_id_name_key" ON "products"("company_id", "name");

-- CreateIndex
CREATE INDEX "merchant_prices_company_id_idx" ON "merchant_prices"("company_id");

-- CreateIndex
CREATE INDEX "merchant_prices_product_id_idx" ON "merchant_prices"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "merchant_prices_merchant_id_product_id_key" ON "merchant_prices"("merchant_id", "product_id");

-- CreateIndex
CREATE INDEX "slots_company_id_sort_order_idx" ON "slots"("company_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "slots_company_id_start_time_end_time_key" ON "slots"("company_id", "start_time", "end_time");

-- CreateIndex
CREATE INDEX "orders_company_id_delivery_date_slot_id_idx" ON "orders"("company_id", "delivery_date", "slot_id");

-- CreateIndex
CREATE INDEX "orders_company_id_status_idx" ON "orders"("company_id", "status");

-- CreateIndex
CREATE INDEX "orders_slot_id_idx" ON "orders"("slot_id");

-- CreateIndex
CREATE INDEX "orders_recurring_order_id_idx" ON "orders"("recurring_order_id");

-- CreateIndex
CREATE INDEX "orders_created_by_id_idx" ON "orders"("created_by_id");

-- CreateIndex
CREATE INDEX "orders_invoice_id_idx" ON "orders"("invoice_id");

-- CreateIndex
CREATE UNIQUE INDEX "orders_merchant_id_delivery_date_slot_id_key" ON "orders"("merchant_id", "delivery_date", "slot_id");

-- CreateIndex
CREATE UNIQUE INDEX "orders_company_id_reference_key" ON "orders"("company_id", "reference");

-- CreateIndex
CREATE INDEX "order_lines_company_id_idx" ON "order_lines"("company_id");

-- CreateIndex
CREATE INDEX "order_lines_product_id_idx" ON "order_lines"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "order_lines_order_id_product_id_key" ON "order_lines"("order_id", "product_id");

-- CreateIndex
CREATE INDEX "recurring_orders_company_id_active_idx" ON "recurring_orders"("company_id", "active");

-- CreateIndex
CREATE INDEX "recurring_orders_merchant_id_idx" ON "recurring_orders"("merchant_id");

-- CreateIndex
CREATE INDEX "recurring_orders_slot_id_idx" ON "recurring_orders"("slot_id");

-- CreateIndex
CREATE INDEX "recurring_order_lines_company_id_idx" ON "recurring_order_lines"("company_id");

-- CreateIndex
CREATE INDEX "recurring_order_lines_product_id_idx" ON "recurring_order_lines"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "recurring_order_lines_recurring_order_id_product_id_key" ON "recurring_order_lines"("recurring_order_id", "product_id");

-- CreateIndex
CREATE INDEX "rounds_company_id_date_slot_id_idx" ON "rounds"("company_id", "date", "slot_id");

-- CreateIndex
CREATE INDEX "rounds_slot_id_idx" ON "rounds"("slot_id");

-- CreateIndex
CREATE INDEX "rounds_driver_id_date_idx" ON "rounds"("driver_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "stops_order_id_key" ON "stops"("order_id");

-- CreateIndex
CREATE INDEX "stops_company_id_idx" ON "stops"("company_id");

-- CreateIndex
CREATE INDEX "stops_round_id_sequence_idx" ON "stops"("round_id", "sequence");

-- CreateIndex
CREATE INDEX "invoices_merchant_id_period_start_idx" ON "invoices"("merchant_id", "period_start");

-- CreateIndex
CREATE INDEX "invoices_company_id_status_idx" ON "invoices"("company_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_company_id_number_key" ON "invoices"("company_id", "number");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_company_id_reference_key" ON "invoices"("company_id", "reference");

-- CreateIndex
CREATE INDEX "invoice_lines_company_id_idx" ON "invoice_lines"("company_id");

-- CreateIndex
CREATE INDEX "invoice_lines_invoice_id_sort_order_idx" ON "invoice_lines"("invoice_id", "sort_order");

-- CreateIndex
CREATE INDEX "invoice_lines_product_id_idx" ON "invoice_lines"("product_id");

-- CreateIndex
CREATE INDEX "payments_company_id_idx" ON "payments"("company_id");

-- CreateIndex
CREATE INDEX "payments_invoice_id_idx" ON "payments"("invoice_id");

-- CreateIndex
CREATE INDEX "payments_recorded_by_id_idx" ON "payments"("recorded_by_id");

-- CreateIndex
CREATE INDEX "invoice_reminders_invoice_id_created_at_idx" ON "invoice_reminders"("invoice_id", "created_at");

-- CreateIndex
CREATE INDEX "invoice_reminders_company_id_created_at_idx" ON "invoice_reminders"("company_id", "created_at");

-- CreateIndex
CREATE INDEX "invoice_reminders_sent_by_id_idx" ON "invoice_reminders"("sent_by_id");

-- CreateIndex
CREATE INDEX "invoice_reminders_operation_job_id_idx" ON "invoice_reminders"("operation_job_id");

-- CreateIndex
CREATE INDEX "audit_logs_company_id_created_at_idx" ON "audit_logs"("company_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_company_id_entity_type_entity_id_idx" ON "audit_logs"("company_id", "entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_actor_id_idx" ON "audit_logs"("actor_id");

-- CreateIndex
CREATE INDEX "support_tickets_company_id_status_idx" ON "support_tickets"("company_id", "status");

-- CreateIndex
CREATE INDEX "support_tickets_customer_id_idx" ON "support_tickets"("customer_id");

-- CreateIndex
CREATE INDEX "support_tickets_related_order_id_idx" ON "support_tickets"("related_order_id");

-- CreateIndex
CREATE INDEX "support_ticket_messages_company_id_idx" ON "support_ticket_messages"("company_id");

-- CreateIndex
CREATE INDEX "support_ticket_messages_ticket_id_idx" ON "support_ticket_messages"("ticket_id");

-- CreateIndex
CREATE INDEX "client_notifications_company_id_idx" ON "client_notifications"("company_id");

-- CreateIndex
CREATE INDEX "client_notifications_user_id_created_at_idx" ON "client_notifications"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "driver_locations_company_id_idx" ON "driver_locations"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "driver_push_subscriptions_endpoint_key" ON "driver_push_subscriptions"("endpoint");

-- CreateIndex
CREATE INDEX "driver_push_subscriptions_user_id_company_id_idx" ON "driver_push_subscriptions"("user_id", "company_id");

-- CreateIndex
CREATE INDEX "driver_push_subscriptions_company_id_idx" ON "driver_push_subscriptions"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "operation_jobs_job_key_key" ON "operation_jobs"("job_key");

-- CreateIndex
CREATE INDEX "operation_jobs_status_next_attempt_at_idx" ON "operation_jobs"("status", "next_attempt_at");

-- CreateIndex
CREATE INDEX "operation_jobs_company_id_status_idx" ON "operation_jobs"("company_id", "status");

-- CreateIndex
CREATE INDEX "auth_login_failures_key_hash_created_at_idx" ON "auth_login_failures"("key_hash", "created_at");

-- CreateIndex
CREATE INDEX "auth_login_failures_created_at_idx" ON "auth_login_failures"("created_at");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merchants" ADD CONSTRAINT "merchants_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merchant_prices" ADD CONSTRAINT "merchant_prices_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merchant_prices" ADD CONSTRAINT "merchant_prices_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merchant_prices" ADD CONSTRAINT "merchant_prices_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "slots" ADD CONSTRAINT "slots_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_slot_id_fkey" FOREIGN KEY ("slot_id") REFERENCES "slots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_recurring_order_id_fkey" FOREIGN KEY ("recurring_order_id") REFERENCES "recurring_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_orders" ADD CONSTRAINT "recurring_orders_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_orders" ADD CONSTRAINT "recurring_orders_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_orders" ADD CONSTRAINT "recurring_orders_slot_id_fkey" FOREIGN KEY ("slot_id") REFERENCES "slots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_order_lines" ADD CONSTRAINT "recurring_order_lines_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_order_lines" ADD CONSTRAINT "recurring_order_lines_recurring_order_id_fkey" FOREIGN KEY ("recurring_order_id") REFERENCES "recurring_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_order_lines" ADD CONSTRAINT "recurring_order_lines_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rounds" ADD CONSTRAINT "rounds_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rounds" ADD CONSTRAINT "rounds_slot_id_fkey" FOREIGN KEY ("slot_id") REFERENCES "slots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rounds" ADD CONSTRAINT "rounds_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stops" ADD CONSTRAINT "stops_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stops" ADD CONSTRAINT "stops_round_id_fkey" FOREIGN KEY ("round_id") REFERENCES "rounds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stops" ADD CONSTRAINT "stops_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_recorded_by_id_fkey" FOREIGN KEY ("recorded_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_counters" ADD CONSTRAINT "invoice_counters_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_reminders" ADD CONSTRAINT "invoice_reminders_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_reminders" ADD CONSTRAINT "invoice_reminders_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_reminders" ADD CONSTRAINT "invoice_reminders_sent_by_id_fkey" FOREIGN KEY ("sent_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_reminders" ADD CONSTRAINT "invoice_reminders_operation_job_id_fkey" FOREIGN KEY ("operation_job_id") REFERENCES "operation_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_related_order_id_fkey" FOREIGN KEY ("related_order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_ticket_messages" ADD CONSTRAINT "support_ticket_messages_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_ticket_messages" ADD CONSTRAINT "support_ticket_messages_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "support_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_notifications" ADD CONSTRAINT "client_notifications_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_notifications" ADD CONSTRAINT "client_notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "driver_locations" ADD CONSTRAINT "driver_locations_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "driver_locations" ADD CONSTRAINT "driver_locations_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "driver_push_subscriptions" ADD CONSTRAINT "driver_push_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "driver_push_subscriptions" ADD CONSTRAINT "driver_push_subscriptions_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operation_jobs" ADD CONSTRAINT "operation_jobs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Partie 2 : contraintes métier que Prisma ne sait pas déclarer (CHECK).
-- ---------------------------------------------------------------------------
ALTER TABLE "companies" ADD CONSTRAINT "companies_cutoff_time_format" CHECK ("cutoff_time" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');
ALTER TABLE "companies" ADD CONSTRAINT "companies_reminder_lead_minutes_range" CHECK ("reminder_lead_minutes" BETWEEN 0 AND 1440);
ALTER TABLE "slots" ADD CONSTRAINT "slots_time_format" CHECK ("start_time" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' AND "end_time" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');
ALTER TABLE "slots" ADD CONSTRAINT "slots_start_before_end" CHECK ("start_time" < "end_time");
ALTER TABLE "products" ADD CONSTRAINT "products_base_price_cents_positive" CHECK ("base_price_cents" >= 0);
ALTER TABLE "products" ADD CONSTRAINT "products_vat_rate_range" CHECK ("vat_rate_basis_points" BETWEEN 0 AND 9999);
ALTER TABLE "merchant_prices" ADD CONSTRAINT "merchant_prices_price_cents_positive" CHECK ("price_cents" >= 0);
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_quantity_ordered_positive" CHECK ("quantity_ordered" > 0);
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_quantity_delivered_range" CHECK ("quantity_delivered" IS NULL OR ("quantity_delivered" >= 0 AND "quantity_delivered" <= "quantity_ordered"));
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_unit_price_frozen_positive" CHECK ("unit_price_frozen_cents" IS NULL OR "unit_price_frozen_cents" >= 0);
ALTER TABLE "recurring_orders" ADD CONSTRAINT "recurring_orders_weekdays_valid" CHECK (cardinality("weekdays") > 0 AND "weekdays" <@ ARRAY[1, 2, 3, 4, 5, 6, 7]);
ALTER TABLE "recurring_order_lines" ADD CONSTRAINT "recurring_order_lines_quantity_positive" CHECK ("quantity" > 0);
ALTER TABLE "stops" ADD CONSTRAINT "stops_sequence_positive" CHECK ("sequence" >= 1);
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_period_order" CHECK ("period_start" <= "period_end");
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_total_consistent" CHECK ("total_cents" = "subtotal_cents" + "vat_cents");
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_total_consistent" CHECK ("quantity" >= 0 AND "total_cents" = "quantity" * "unit_price_cents");
ALTER TABLE "payments" ADD CONSTRAINT "payments_amount_positive" CHECK ("amount_cents" > 0);

-- ---------------------------------------------------------------------------
-- Partie 3 : sécurité Supabase. Le schéma public est exposé par l'API REST avec la clé anon :
-- chaque table est fermée (RLS sans politique, aucun droit pour PUBLIC, anon, authenticated).
-- Seul Prisma, connecté en propriétaire (postgres), lit et écrit.
-- ---------------------------------------------------------------------------
ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE "audit_logs" FROM PUBLIC, anon, authenticated;

ALTER TABLE "auth_login_failures" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE "auth_login_failures" FROM PUBLIC, anon, authenticated;

ALTER TABLE "categories" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE "categories" FROM PUBLIC, anon, authenticated;

ALTER TABLE "client_notifications" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE "client_notifications" FROM PUBLIC, anon, authenticated;

ALTER TABLE "companies" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE "companies" FROM PUBLIC, anon, authenticated;

ALTER TABLE "driver_locations" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE "driver_locations" FROM PUBLIC, anon, authenticated;

ALTER TABLE "driver_push_subscriptions" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE "driver_push_subscriptions" FROM PUBLIC, anon, authenticated;

ALTER TABLE "invoice_counters" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE "invoice_counters" FROM PUBLIC, anon, authenticated;

ALTER TABLE "invoice_lines" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE "invoice_lines" FROM PUBLIC, anon, authenticated;

ALTER TABLE "invoice_reminders" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE "invoice_reminders" FROM PUBLIC, anon, authenticated;

ALTER TABLE "invoices" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE "invoices" FROM PUBLIC, anon, authenticated;

ALTER TABLE "merchant_prices" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE "merchant_prices" FROM PUBLIC, anon, authenticated;

ALTER TABLE "merchants" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE "merchants" FROM PUBLIC, anon, authenticated;

ALTER TABLE "operation_jobs" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE "operation_jobs" FROM PUBLIC, anon, authenticated;

ALTER TABLE "order_lines" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE "order_lines" FROM PUBLIC, anon, authenticated;

ALTER TABLE "orders" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE "orders" FROM PUBLIC, anon, authenticated;

ALTER TABLE "payments" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE "payments" FROM PUBLIC, anon, authenticated;

ALTER TABLE "permissions" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE "permissions" FROM PUBLIC, anon, authenticated;

ALTER TABLE "products" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE "products" FROM PUBLIC, anon, authenticated;

ALTER TABLE "recurring_order_lines" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE "recurring_order_lines" FROM PUBLIC, anon, authenticated;

ALTER TABLE "recurring_orders" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE "recurring_orders" FROM PUBLIC, anon, authenticated;

ALTER TABLE "role_permissions" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE "role_permissions" FROM PUBLIC, anon, authenticated;

ALTER TABLE "roles" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE "roles" FROM PUBLIC, anon, authenticated;

ALTER TABLE "rounds" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE "rounds" FROM PUBLIC, anon, authenticated;

ALTER TABLE "slots" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE "slots" FROM PUBLIC, anon, authenticated;

ALTER TABLE "stops" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE "stops" FROM PUBLIC, anon, authenticated;

ALTER TABLE "support_ticket_messages" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE "support_ticket_messages" FROM PUBLIC, anon, authenticated;

ALTER TABLE "support_tickets" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE "support_tickets" FROM PUBLIC, anon, authenticated;

ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE "users" FROM PUBLIC, anon, authenticated;

ALTER TABLE "_prisma_migrations" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE "_prisma_migrations" FROM PUBLIC, anon, authenticated;

-- Une fonction d'activation automatique de la RLS peut exister selon le projet : jamais exposée en RPC.
DO $$
BEGIN
  IF to_regprocedure('public.rls_auto_enable()') IS NOT NULL THEN
    REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;
  END IF;
END
$$;

-- Bucket privé des photos d'incident des arrêts (préfixe companyId/stopId-), versionné avec la base.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('delivery-pods', 'delivery-pods', false, 5242880, ARRAY['image/jpeg', 'image/png'])
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- Partie 4 : données de référence (rôles et permissions), identiques à prisma/reference-data.ts.
-- ---------------------------------------------------------------------------
INSERT INTO "permissions" ("id", "slug", "name", "resource", "action", "created_at")
VALUES
  ('rbac_permission_users_read', 'users:read', 'Lire les utilisateurs', 'users', 'read', CURRENT_TIMESTAMP),
  ('rbac_permission_users_create', 'users:create', 'Créer des utilisateurs', 'users', 'create', CURRENT_TIMESTAMP),
  ('rbac_permission_users_update', 'users:update', 'Modifier les utilisateurs', 'users', 'update', CURRENT_TIMESTAMP),
  ('rbac_permission_users_delete', 'users:delete', 'Supprimer les utilisateurs', 'users', 'delete', CURRENT_TIMESTAMP),
  ('rbac_permission_companies_read', 'companies:read', 'Lire les entreprises', 'companies', 'read', CURRENT_TIMESTAMP),
  ('rbac_permission_companies_create', 'companies:create', 'Créer des entreprises', 'companies', 'create', CURRENT_TIMESTAMP),
  ('rbac_permission_companies_update', 'companies:update', 'Modifier les entreprises', 'companies', 'update', CURRENT_TIMESTAMP),
  ('rbac_permission_companies_delete', 'companies:delete', 'Supprimer les entreprises', 'companies', 'delete', CURRENT_TIMESTAMP),
  ('rbac_permission_merchants_read', 'merchants:read', 'Lire les clients', 'merchants', 'read', CURRENT_TIMESTAMP),
  ('rbac_permission_merchants_manage', 'merchants:manage', 'Gérer les clients', 'merchants', 'manage', CURRENT_TIMESTAMP),
  ('rbac_permission_catalog_read', 'catalog:read', 'Lire le catalogue', 'catalog', 'read', CURRENT_TIMESTAMP),
  ('rbac_permission_catalog_manage', 'catalog:manage', 'Gérer le catalogue et les prix', 'catalog', 'manage', CURRENT_TIMESTAMP),
  ('rbac_permission_orders_read', 'orders:read', 'Lire les commandes', 'orders', 'read', CURRENT_TIMESTAMP),
  ('rbac_permission_orders_create', 'orders:create', 'Créer des commandes', 'orders', 'create', CURRENT_TIMESTAMP),
  ('rbac_permission_orders_update', 'orders:update', 'Modifier les commandes', 'orders', 'update', CURRENT_TIMESTAMP),
  ('rbac_permission_production_read', 'production:read', 'Lire la production', 'production', 'read', CURRENT_TIMESTAMP),
  ('rbac_permission_production_update', 'production:update', 'Marquer préparé, signaler un manquant', 'production', 'update', CURRENT_TIMESTAMP),
  ('rbac_permission_rounds_read', 'rounds:read', 'Lire les tournées', 'rounds', 'read', CURRENT_TIMESTAMP),
  ('rbac_permission_rounds_manage', 'rounds:manage', 'Gérer et attribuer les tournées', 'rounds', 'manage', CURRENT_TIMESTAMP),
  ('rbac_permission_stops_update', 'stops:update', 'Marquer un arrêt livré ou en incident', 'stops', 'update', CURRENT_TIMESTAMP),
  ('rbac_permission_invoices_read', 'invoices:read', 'Lire les factures', 'invoices', 'read', CURRENT_TIMESTAMP),
  ('rbac_permission_invoices_create', 'invoices:create', 'Créer des factures', 'invoices', 'create', CURRENT_TIMESTAMP),
  ('rbac_permission_invoices_update', 'invoices:update', 'Modifier les factures et règlements', 'invoices', 'update', CURRENT_TIMESTAMP),
  ('rbac_permission_settings_read', 'settings:read', 'Lire les paramètres', 'settings', 'read', CURRENT_TIMESTAMP),
  ('rbac_permission_settings_update', 'settings:update', 'Modifier les paramètres', 'settings', 'update', CURRENT_TIMESTAMP),
  ('rbac_permission_support_read', 'support:read', 'Lire le support', 'support', 'read', CURRENT_TIMESTAMP),
  ('rbac_permission_support_create', 'support:create', 'Créer une demande support', 'support', 'create', CURRENT_TIMESTAMP),
  ('rbac_permission_dashboard_admin', 'dashboard:admin', 'Espace plateforme', 'dashboard', 'admin', CURRENT_TIMESTAMP),
  ('rbac_permission_dashboard_company', 'dashboard:company', 'Back-office de l''entreprise', 'dashboard', 'company', CURRENT_TIMESTAMP),
  ('rbac_permission_dashboard_baker', 'dashboard:baker', 'Espace boulanger', 'dashboard', 'baker', CURRENT_TIMESTAMP),
  ('rbac_permission_dashboard_driver', 'dashboard:driver', 'Application livreur', 'dashboard', 'driver', CURRENT_TIMESTAMP),
  ('rbac_permission_dashboard_merchant', 'dashboard:merchant', 'Portail client', 'dashboard', 'merchant', CURRENT_TIMESTAMP);

INSERT INTO "roles" ("id", "name", "slug", "description", "system_role", "is_system", "created_at", "updated_at")
VALUES
  ('rbac_role_super_admin', 'Super-administrateur', 'super-admin', 'Éditeur de la plateforme', 'SUPER_ADMIN', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rbac_role_admin', 'Administrateur', 'admin', 'Gestion complète de l''entreprise', 'ADMIN', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rbac_role_baker', 'Boulanger', 'baker', 'Production et préparation des commandes', 'BAKER', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rbac_role_driver', 'Livreur', 'driver', 'Exécution des tournées', 'DRIVER', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rbac_role_merchant', 'Client', 'merchant', 'Commerçant qui commande', 'MERCHANT', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT INTO "role_permissions" ("role_id", "permission_id")
VALUES
  ('rbac_role_super_admin', 'rbac_permission_companies_read'),
  ('rbac_role_super_admin', 'rbac_permission_companies_create'),
  ('rbac_role_super_admin', 'rbac_permission_companies_update'),
  ('rbac_role_super_admin', 'rbac_permission_companies_delete'),
  ('rbac_role_super_admin', 'rbac_permission_users_read'),
  ('rbac_role_super_admin', 'rbac_permission_users_create'),
  ('rbac_role_super_admin', 'rbac_permission_users_update'),
  ('rbac_role_super_admin', 'rbac_permission_users_delete'),
  ('rbac_role_super_admin', 'rbac_permission_support_read'),
  ('rbac_role_super_admin', 'rbac_permission_dashboard_admin'),
  ('rbac_role_admin', 'rbac_permission_users_read'),
  ('rbac_role_admin', 'rbac_permission_users_create'),
  ('rbac_role_admin', 'rbac_permission_users_update'),
  ('rbac_role_admin', 'rbac_permission_users_delete'),
  ('rbac_role_admin', 'rbac_permission_companies_read'),
  ('rbac_role_admin', 'rbac_permission_companies_update'),
  ('rbac_role_admin', 'rbac_permission_merchants_read'),
  ('rbac_role_admin', 'rbac_permission_merchants_manage'),
  ('rbac_role_admin', 'rbac_permission_catalog_read'),
  ('rbac_role_admin', 'rbac_permission_catalog_manage'),
  ('rbac_role_admin', 'rbac_permission_orders_read'),
  ('rbac_role_admin', 'rbac_permission_orders_create'),
  ('rbac_role_admin', 'rbac_permission_orders_update'),
  ('rbac_role_admin', 'rbac_permission_production_read'),
  ('rbac_role_admin', 'rbac_permission_rounds_read'),
  ('rbac_role_admin', 'rbac_permission_rounds_manage'),
  ('rbac_role_admin', 'rbac_permission_stops_update'),
  ('rbac_role_admin', 'rbac_permission_invoices_read'),
  ('rbac_role_admin', 'rbac_permission_invoices_create'),
  ('rbac_role_admin', 'rbac_permission_invoices_update'),
  ('rbac_role_admin', 'rbac_permission_settings_read'),
  ('rbac_role_admin', 'rbac_permission_settings_update'),
  ('rbac_role_admin', 'rbac_permission_support_read'),
  ('rbac_role_admin', 'rbac_permission_dashboard_company'),
  ('rbac_role_baker', 'rbac_permission_catalog_read'),
  ('rbac_role_baker', 'rbac_permission_orders_read'),
  ('rbac_role_baker', 'rbac_permission_production_read'),
  ('rbac_role_baker', 'rbac_permission_production_update'),
  ('rbac_role_baker', 'rbac_permission_rounds_read'),
  ('rbac_role_baker', 'rbac_permission_dashboard_baker'),
  ('rbac_role_driver', 'rbac_permission_rounds_read'),
  ('rbac_role_driver', 'rbac_permission_stops_update'),
  ('rbac_role_driver', 'rbac_permission_dashboard_driver'),
  ('rbac_role_merchant', 'rbac_permission_catalog_read'),
  ('rbac_role_merchant', 'rbac_permission_orders_read'),
  ('rbac_role_merchant', 'rbac_permission_orders_create'),
  ('rbac_role_merchant', 'rbac_permission_orders_update'),
  ('rbac_role_merchant', 'rbac_permission_invoices_read'),
  ('rbac_role_merchant', 'rbac_permission_support_read'),
  ('rbac_role_merchant', 'rbac_permission_support_create'),
  ('rbac_role_merchant', 'rbac_permission_settings_read'),
  ('rbac_role_merchant', 'rbac_permission_settings_update'),
  ('rbac_role_merchant', 'rbac_permission_dashboard_merchant');
