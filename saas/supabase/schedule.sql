-- Configure os segredos logster_app_url e logster_cron_secret no Vault.
-- Ative as extensões pg_cron e pg_net antes de executar.
select cron.schedule(
  'logster-forecast-hourly',
  '0 * * * *',
  $job$
    select net.http_post(
      url := rtrim((select decrypted_secret from vault.decrypted_secrets where name = 'logster_app_url'), '/') || '/api/cron/forecast',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'logster_cron_secret')
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 30000
    );
  $job$
);
