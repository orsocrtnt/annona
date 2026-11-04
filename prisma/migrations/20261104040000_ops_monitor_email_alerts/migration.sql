-- OPS-FIAB, 4 novembre 2026 : la sonde externe prévient le propriétaire par e-mail.
-- L'e-mail part de la base (Resend), sans passer par Vercel : une panne totale du site reste signalée.
-- Canal e-mail actif seulement si les trois secrets du coffre existent : `ops03b_resend_api_key`,
-- `ops03b_alert_email_to`, `ops03b_alert_email_from` (copie : `sh scripts/ops03b/copy-alert-email.sh`).
-- Sinon, comportement inchangé : webhook `ops03b_webhook_url` s'il existe. Le reste de la fonction est
-- recopié de 20261023192000_ops03b_monitor_fix.
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
  email_api_key TEXT;
  email_to TEXT;
  email_from TEXT;
  email_subject TEXT;
  email_text TEXT;
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
  email_api_key := ops_monitor.secret_value('ops03b_resend_api_key');
  email_to := ops_monitor.secret_value('ops03b_alert_email_to');
  email_from := ops_monitor.secret_value('ops03b_alert_email_from');

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
          extensions.http_header('user-agent', 'TutelLiv-OPS-Monitor/1.0'),
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
          extensions.http_header('user-agent', 'TutelLiv-OPS-Monitor/1.0'),
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
    IF COALESCE(email_api_key, '') <> '' AND COALESCE(email_to, '') <> '' AND COALESCE(email_from, '') <> '' THEN
      email_subject := CASE WHEN simulate_outage THEN '[Essai] ' ELSE '' END || CASE
        WHEN current_status = 'healthy' THEN 'TutelLiv préproduction : le site répond de nouveau'
        ELSE 'Alerte TutelLiv préproduction : le site ne répond plus'
      END;
      email_text := concat_ws(E'\n',
        CASE
          WHEN simulate_outage THEN 'Panne fictive déclenchée à la main pour tester ce canal. Rien à faire.'
          WHEN current_status = 'healthy' THEN 'La sonde externe voit de nouveau le site en bonne santé.'
          ELSE 'La sonde externe (Supabase, toutes les 30 minutes) ne voit plus le site en bonne santé.'
        END,
        '',
        'Contrôle : ' || to_char(checked_at AT TIME ZONE 'America/New_York', 'DD/MM/YYYY HH24:MI') || ' (New York), '
          || to_char(checked_at AT TIME ZONE 'Europe/Paris', 'HH24:MI') || ' (Paris)',
        'Page publique /api/health : ' || COALESCE(public_http_status::text, '?'),
        'Diagnostic profond : ' || COALESCE(deep_http_status::text, '?')
          || ' (base : ' || COALESCE(database_status, '?')
          || ', stockage : ' || COALESCE(storage_status, '?')
          || ', tâches de fond : ' || COALESCE(queue_status, '?') || ')',
        '',
        'Rappel au plus toutes les 2 heures tant que la panne dure ; un e-mail au retour à la normale.',
        'Que faire : docs/operations/ops03b/README.md (journaux Vercel, puis état Supabase).'
      );
      BEGIN
        SELECT * INTO alert_response
        FROM extensions.http((
          'POST'::extensions.http_method,
          'https://api.resend.com/emails',
          ARRAY[
            extensions.http_header('authorization', 'Bearer ' || email_api_key),
            extensions.http_header('user-agent', 'TutelLiv-OPS-Monitor/1.1'),
            extensions.http_header('idempotency-key', event_key)
          ]::extensions.http_header[],
          'application/json',
          jsonb_build_object(
            'from', email_from,
            'to', jsonb_build_array(email_to),
            'subject', email_subject,
            'text', email_text
          )::text
        )::extensions.http_request);
        alert_delivery := CASE
          WHEN alert_response.status BETWEEN 200 AND 299 THEN 'sent'
          ELSE 'failed'
        END;
      EXCEPTION WHEN OTHERS THEN
        alert_delivery := 'failed';
      END;
    ELSIF webhook_url IS NULL OR webhook_url = '' THEN
      alert_delivery := 'disabled';
    ELSE
      event_payload := jsonb_build_object(
        'event', 'tutelliv.ops_monitor',
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
            extensions.http_header('user-agent', 'TutelLiv-OPS-Monitor/1.0'),
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
