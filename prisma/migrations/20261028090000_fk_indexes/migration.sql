-- Index sur 12 clés étrangères signalées sans index par le conseiller Supabase.
-- Création idempotente ; aucun index existant n'est supprimé.

-- CreateIndex
CREATE INDEX IF NOT EXISTS "client_notifications_order_message_id_idx" ON "client_notifications"("order_message_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "invoices_order_id_idx" ON "invoices"("order_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "order_messages_author_id_idx" ON "order_messages"("author_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "order_thread_reads_user_id_idx" ON "order_thread_reads"("user_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "role_permissions_permission_id_idx" ON "role_permissions"("permission_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "saas_plan_assignments_plan_id_idx" ON "saas_plan_assignments"("plan_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "saas_seat_reservations_subscription_id_idx" ON "saas_seat_reservations"("subscription_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "saas_subscription_items_option_id_idx" ON "saas_subscription_items"("option_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "saas_subscriptions_catalog_version_id_idx" ON "saas_subscriptions"("catalog_version_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "saas_usage_events_subscription_id_idx" ON "saas_usage_events"("subscription_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "support_tickets_related_delivery_id_idx" ON "support_tickets"("related_delivery_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "support_tickets_related_order_id_idx" ON "support_tickets"("related_order_id");
