-- Speeds up scheduled deletion of retention-eligible rows.
create index if not exists idx_webhook_logs_delivered_at on public.webhook_logs (delivered_at);
create index if not exists idx_delivered_transfers_delivered_at on public.delivered_transfers (delivered_at);
