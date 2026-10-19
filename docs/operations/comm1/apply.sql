BEGIN;
CREATE TABLE public.order_messages (
 id TEXT PRIMARY KEY, order_id TEXT NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
 author_id TEXT NOT NULL REFERENCES public.users(id), author_name TEXT NOT NULL, author_role TEXT NOT NULL,
 body TEXT NOT NULL, kind TEXT NOT NULL DEFAULT 'QUESTION', internal BOOLEAN NOT NULL DEFAULT false,
 request_key TEXT NOT NULL, created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT order_messages_kind_check CHECK (kind IN ('QUESTION','INSTRUCTION','CHANGE','INCIDENT')),
 CONSTRAINT order_messages_body_check CHECK (length(btrim(body)) BETWEEN 1 AND 4000)
);
CREATE UNIQUE INDEX order_messages_order_id_author_id_request_key_key ON public.order_messages(order_id,author_id,request_key);
CREATE INDEX order_messages_order_id_created_at_id_idx ON public.order_messages(order_id,created_at,id);
CREATE TABLE public.order_thread_reads (
 id TEXT PRIMARY KEY, order_id TEXT NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
 user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
 seen_at TIMESTAMP(3) NOT NULL, seen_id TEXT NOT NULL
);
CREATE UNIQUE INDEX order_thread_reads_order_id_user_id_key ON public.order_thread_reads(order_id,user_id);
ALTER TABLE public.client_notifications ADD COLUMN order_message_id TEXT REFERENCES public.order_messages(id) ON DELETE CASCADE;
ALTER TABLE public.order_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_thread_reads ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.order_messages, public.order_thread_reads FROM PUBLIC, anon, authenticated;
COMMIT;
