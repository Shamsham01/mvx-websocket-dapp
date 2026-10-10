-- Keep webhook_logs and delivered_transfers for 48 hours.
-- Run once in the Supabase SQL editor for project "MvX WebSocket Subscription"
-- (gqusqpeghneomshswcgt). The Node backend also prunes on this window after deploy;
-- this script deletes the backlog now and reclaims space against the 500 MB free-plan cap.
--
-- Free-plan read-only mode blocks deletes until this session is set read-write.
-- VACUUM FULL is required: a plain DELETE does not shrink the reported database size.

set session characteristics as transaction read write;
set statement_timeout = 0;
set lock_timeout = '3min';

create index if not exists idx_webhook_logs_delivered_at
  on public.webhook_logs (delivered_at);
create index if not exists idx_delivered_transfers_delivered_at
  on public.delivered_transfers (delivered_at);

create schema if not exists maintenance;
revoke all on schema maintenance from public;
revoke all on schema maintenance from anon, authenticated;

create or replace procedure maintenance.prune_log_retention(
  retention interval default interval '48 hours',
  batch_size integer default 5000,
  max_batches integer default 40
)
language plpgsql
set search_path = public, pg_catalog
as $$
declare
  deleted integer;
  batches integer := 0;
begin
  loop
    delete from public.webhook_logs
    where ctid in (
      select ctid
      from public.webhook_logs
      where delivered_at < now() - retention
      limit batch_size
    );
    get diagnostics deleted = row_count;
    batches := batches + 1;
    exit when deleted = 0 or batches >= max_batches;
    commit;
  end loop;

  batches := 0;
  loop
    delete from public.delivered_transfers
    where ctid in (
      select ctid
      from public.delivered_transfers
      where delivered_at < now() - retention
      limit batch_size
    );
    get diagnostics deleted = row_count;
    batches := batches + 1;
    exit when deleted = 0 or batches >= max_batches;
    commit;
  end loop;
end;
$$;

revoke all on procedure maintenance.prune_log_retention(interval, integer, integer) from public;
revoke all on procedure maintenance.prune_log_retention(interval, integer, integer) from anon, authenticated;

create extension if not exists pg_cron;

-- Hourly prune. Scheduling the same name again replaces the job.
select cron.schedule(
  'prune-webhook-logs-48h',
  '15 * * * *',
  $$call maintenance.prune_log_retention()$$
);

select cron.schedule(
  'prune-cron-run-details',
  '30 4 * * *',
  $$delete from cron.job_run_details where end_time < now() - interval '7 days'$$
);

-- Catch up the backlog in this session. Each committed batch is 5,000 rows.
-- If this reports "invalid transaction termination", run this CALL on its own.
call maintenance.prune_log_retention(interval '48 hours', 5000, 100000);

-- Rewrite the tables so the 500 MB quota sees the smaller size.
-- These lock each table until the rewrite finishes.
-- VACUUM cannot run inside a transaction; run these two on their own if the editor wraps the script.
vacuum (full, analyze) public.webhook_logs;
vacuum (full, analyze) public.delivered_transfers;

alter database postgres set default_transaction_read_only = off;

select
  pg_size_pretty(pg_database_size(current_database())) as database_size,
  pg_size_pretty(pg_total_relation_size('public.webhook_logs')) as webhook_logs,
  pg_size_pretty(pg_total_relation_size('public.delivered_transfers')) as delivered_transfers,
  (select count(*) from public.webhook_logs) as webhook_log_rows,
  (select count(*) from public.delivered_transfers) as delivered_transfer_rows,
  (select min(delivered_at) from public.webhook_logs) as oldest_webhook_log;
