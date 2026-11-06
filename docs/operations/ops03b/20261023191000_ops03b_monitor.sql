-- OPS-03B : journal privé et moniteur de préproduction.
-- Les valeurs sensibles restent dans Supabase Vault et ne sont jamais placées
-- dans la migration, le journal ou le résultat de la fonction.

CREATE SCHEMA IF NOT EXISTS ops_monitor;
REVOKE ALL ON SCHEMA ops_monitor FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS ops_monitor.runs (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  status TEXT NOT NULL CHECK (status IN ('healthy', 'down')),
  previous_status TEXT NOT NULL CHECK (previous_status IN ('unknown', 'healthy', 'down')),
  simulated BOOLEAN NOT NULL DEFAULT false,
  public_http_status INTEGER,
  deep_http_status INTEGER,
  database_status TEXT,
  storage_status TEXT,
  queue_status TEXT,
  alert_delivery TEXT NOT NULL CHECK (alert_delivery IN ('not_needed', 'disabled', 'sent', 'failed')),
  duration_ms INTEGER NOT NULL CHECK (duration_ms >= 0)
);

CREATE INDEX IF NOT EXISTS ops_monitor_runs_checked_at_idx
  ON ops_monitor.runs (checked_at DESC);

CREATE TABLE IF NOT EXISTS ops_monitor.state (
  singleton BOOLEAN PRIMARY KEY DEFAULT true CHECK (singleton),
  last_status TEXT NOT NULL DEFAULT 'unknown' CHECK (last_status IN ('unknown', 'healthy', 'down')),
  last_checked_at TIMESTAMPTZ,
  last_alerted_at TIMESTAMPTZ
);

INSERT INTO ops_monitor.state (singleton) VALUES (true)
ON CONFLICT (singleton) DO NOTHING;

REVOKE ALL ON ALL TABLES IN SCHEMA ops_monitor FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA ops_monitor FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION ops_monitor.secret_value(secret_name TEXT)
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, vault
AS $$
  SELECT decrypted_secret
  FROM vault.decrypted_secrets
  WHERE name = secret_name
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION ops_monitor.secret_value(TEXT) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION ops_monitor.run(simulate_outage BOOLEAN DEFAULT false)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, extensions, vault, ops_monitor
AS $$
DECLARE
  started_at TIMESTAMPTZ := clock_timestamp();
  checked_at TIMESTAMPTZ;
  app_url TEXT;
  health_secret TEXT;
  bypass_secret TEXT;
  webhook_url TEXT;
  previous_status TEXT;
  previous_alerted_at TIMESTAMPTZ;
  current_status TEXT;
  public_response extensions.http_response;
  deep_response extensions.http_response;
  alert_response extensions.http_response;
  deep_payload JSONB := '{}'::jsonb;
  public_http_status INTEGER;
  deep_http_status INTEGER;
  database_status TEXT;
  storage_status TEXT;
  queue_status TEXT;
  alert_delivery TEXT := 'not_needed';
  should_notify BOOLEAN := false;
  event_kind TEXT;
  event_key TEXT;
  event_payload JSONB;
BEGIN
  SELECT last_status, last_alerted_at INTO previous_status, previous_alerted_at
  FROM ops_monitor.state
  WHERE singleton = true
  FOR UPDATE;

  previous_status := COALESCE(previous_status, 'unknown');
  app_url := rtrim(ops_monitor.secret_value('ops03b_app_url'), '/');
  health_secret := ops_monitor.secret_value('ops03b_health_secret');
  bypass_secret := ops_monitor.secret_value('ops03b_vercel_bypass');
  webhook_url := ops_monitor.secret_value('ops03b_webhook_url');

  IF app_url IS NULL OR health_secret IS NULL THEN
    RAISE EXCEPTION 'OPS03B_MONITOR_NOT_CONFIGURED';
  END IF;

  PERFORM set_config('http.timeout_msec', '15000', true);
  PERFORM set_config('http.curlopt_connecttimeout_ms', '5000', true);

  IF simulate_outage THEN
    public_http_status := 599;
    deep_http_status := 599;
    current_status := 'down';
  ELSE
    BEGIN
      SELECT * INTO public_response
      FROM extensions.http((
        'GET'::extensions.http_method,
        app_url || '/api/health',
        ARRAY[
          extensions.http_header('user-agent', 'Annona-OPS-Monitor/1.0'),
          extensions.http_header('x-vercel-protection-bypass', COALESCE(bypass_secret, ''))
        ]::extensions.http_header[],
        NULL,
        NULL
      )::extensions.http_request);
      public_http_status := public_response.status;
    EXCEPTION WHEN OTHERS THEN
      public_http_status := 598;
    END;

    BEGIN
      SELECT * INTO deep_response
      FROM extensions.http((
        'GET'::extensions.http_method,
        app_url || '/api/health?deep=1',
        ARRAY[
          extensions.http_header('user-agent', 'Annona-OPS-Monitor/1.0'),
          extensions.http_header('authorization', 'Bearer ' || health_secret),
          extensions.http_header('x-vercel-protection-bypass', COALESCE(bypass_secret, ''))
        ]::extensions.http_header[],
        NULL,
        NULL
      )::extensions.http_request);
      deep_http_status := deep_response.status;
      IF deep_response.content IS NOT NULL THEN
        BEGIN
          deep_payload := deep_response.content::jsonb;
        EXCEPTION WHEN OTHERS THEN
          deep_payload := '{}'::jsonb;
        END;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      deep_http_status := 598;
      deep_payload := '{}'::jsonb;
    END;

    database_status := deep_payload #>> '{checks,database,status}';
    storage_status := deep_payload #>> '{checks,storage,status}';
    queue_status := deep_payload #>> '{checks,queue,status}';
    current_status := CASE
      WHEN public_http_status = 200
        AND deep_http_status = 200
        AND deep_payload ->> 'status' = 'ok'
      THEN 'healthy'
      ELSE 'down'
    END;
  END IF;

  should_notify := (
      current_status = 'down'
      AND (
        simulate_outage
        OR previous_status <> 'down'
        OR previous_alerted_at IS NULL
        OR previous_alerted_at < clock_timestamp() - INTERVAL '2 hours'
      )
    ) OR (current_status = 'healthy' AND previous_status = 'down');
  event_kind := CASE WHEN current_status = 'healthy' THEN 'recovery' ELSE 'outage' END;
  checked_at := clock_timestamp();
  event_key := 'ops03b:' || event_kind || ':' || to_char(
    date_trunc('minute', checked_at AT TIME ZONE 'UTC'),
    'YYYYMMDDHH24MI'
  );

  IF should_notify THEN
    IF webhook_url IS NULL OR webhook_url = '' THEN
      alert_delivery := 'disabled';
    ELSE
      event_payload := jsonb_build_object(
        'event', 'annona.ops_monitor',
        'eventId', event_key,
        'environment', 'preproduction',
        'kind', event_kind,
        'severity', CASE WHEN current_status = 'healthy' THEN 'info' ELSE 'critical' END,
        'fingerprint', CASE WHEN simulate_outage THEN 'ops03b-simulated-outage' ELSE 'preproduction-health' END,
        'occurredAt', checked_at,
        'status', current_status,
        'previousStatus', previous_status,
        'checks', jsonb_build_object(
          'publicHttpStatus', public_http_status,
          'deepHttpStatus', deep_http_status,
          'database', database_status,
          'storage', storage_status,
          'queue', queue_status
        )
      );
      BEGIN
        SELECT * INTO alert_response
        FROM extensions.http((
          'POST'::extensions.http_method,
          webhook_url,
          ARRAY[
            extensions.http_header('content-type', 'application/json'),
            extensions.http_header('user-agent', 'Annona-OPS-Monitor/1.0'),
            extensions.http_header('idempotency-key', event_key)
          ]::extensions.http_header[],
          'application/json',
          event_payload::text
        )::extensions.http_request);
        alert_delivery := CASE
          WHEN alert_response.status BETWEEN 200 AND 299 THEN 'sent'
          ELSE 'failed'
        END;
      EXCEPTION WHEN OTHERS THEN
        alert_delivery := 'failed';
      END;
    END IF;
  END IF;

  INSERT INTO ops_monitor.runs (
    checked_at, status, previous_status, simulated,
    public_http_status, deep_http_status,
    database_status, storage_status, queue_status,
    alert_delivery, duration_ms
  ) VALUES (
    checked_at, current_status, previous_status, simulate_outage,
    public_http_status, deep_http_status,
    database_status, storage_status, queue_status,
    alert_delivery,
    GREATEST(0, round(extract(epoch FROM (clock_timestamp() - started_at)) * 1000)::INTEGER)
  );

  UPDATE ops_monitor.state
  SET last_status = current_status,
      last_checked_at = checked_at,
      last_alerted_at = CASE WHEN alert_delivery = 'sent' THEN checked_at ELSE last_alerted_at END
  WHERE singleton = true;

  DELETE FROM ops_monitor.runs AS old_run
  WHERE old_run.checked_at < clock_timestamp() - INTERVAL '90 days';

  RETURN jsonb_build_object(
    'status', current_status,
    'previousStatus', previous_status,
    'simulated', simulate_outage,
    'alertDelivery', alert_delivery,
    'publicHttpStatus', public_http_status,
    'deepHttpStatus', deep_http_status,
    'database', database_status,
    'storage', storage_status,
    'queue', queue_status,
    'checkedAt', checked_at,
    'durationMs', GREATEST(0, round(extract(epoch FROM (clock_timestamp() - started_at)) * 1000)::INTEGER)
  );
END;
$$;

REVOKE ALL ON FUNCTION ops_monitor.run(BOOLEAN) FROM PUBLIC, anon, authenticated;
