SELECT relname, relrowsecurity FROM pg_class
WHERE oid IN ('public.order_messages'::regclass, 'public.order_thread_reads'::regclass);
SELECT grantee, table_name, privilege_type FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND table_name IN ('order_messages','order_thread_reads')
AND grantee IN ('PUBLIC','anon','authenticated');
SELECT column_name, data_type, is_nullable FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'client_notifications' AND column_name = 'order_message_id';
