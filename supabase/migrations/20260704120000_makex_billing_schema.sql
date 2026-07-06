-- MakeX billing schema: whitelist baseline, wallet prefs, app profiles, usage ledger.

-- 1. Whitelist (idempotent baseline)
create table if not exists public.makex_usage_fee_whitelist (
  id uuid primary key default gen_random_uuid(),
  wallet_address text not null unique,
  name text not null,
  email text,
  whitelist_start timestamptz not null,
  whitelist_end timestamptz not null,
  status text not null check (status in ('valid', 'expired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.makex_usage_fee_whitelist enable row level security;

drop policy if exists "makex_usage_fee_whitelist_anon_insert_trial" on public.makex_usage_fee_whitelist;
create policy "makex_usage_fee_whitelist_anon_insert_trial"
  on public.makex_usage_fee_whitelist
  for insert
  to anon
  with check (
    status = 'valid'
    and wallet_address is not null
    and length(trim(wallet_address)) > 0
    and name is not null
    and length(trim(name)) > 0
    and whitelist_start is not null
    and whitelist_end is not null
    and whitelist_end > whitelist_start
  );

-- 2. Wallet billing preferences (USDC default vs REWARD discount)
create table if not exists public.makex_wallet_billing_prefs (
  wallet_address text primary key,
  fee_token text not null default 'USDC'
    check (fee_token in ('USDC', 'REWARD')),
  fee_token_identifier text not null default 'USDC-c76f1f',
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint makex_billing_token_id_consistency check (
    (fee_token = 'USDC' and fee_token_identifier = 'USDC-c76f1f')
    or (fee_token = 'REWARD' and fee_token_identifier = 'REWARD-cf6eac')
  )
);

alter table public.makex_wallet_billing_prefs enable row level security;

drop policy if exists "makex_wallet_billing_prefs_service_all" on public.makex_wallet_billing_prefs;
create policy "makex_wallet_billing_prefs_service_all"
  on public.makex_wallet_billing_prefs
  for all
  to service_role
  using (true)
  with check (true);

-- 3. Per-app billing profiles (seeded reference config)
create table if not exists public.makex_app_billing_profiles (
  app_id text primary key,
  display_name text not null,
  tier text not null check (tier in ('standard', 'premium')),
  usd_fee_usdc numeric(10,4) not null,
  usd_fee_reward numeric(10,4),
  whitelist_enabled boolean not null default true,
  allowed_fee_tokens text[] not null,
  is_active boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.makex_app_billing_profiles enable row level security;

drop policy if exists "makex_app_billing_profiles_public_read" on public.makex_app_billing_profiles;
create policy "makex_app_billing_profiles_public_read"
  on public.makex_app_billing_profiles
  for select
  to anon, authenticated
  using (is_active = true);

drop policy if exists "makex_app_billing_profiles_service_all" on public.makex_app_billing_profiles;
create policy "makex_app_billing_profiles_service_all"
  on public.makex_app_billing_profiles
  for all
  to service_role
  using (true)
  with check (true);

insert into public.makex_app_billing_profiles (
  app_id, display_name, tier, usd_fee_usdc, usd_fee_reward, whitelist_enabled, allowed_fee_tokens
) values
  ('makex-warps', 'MakeX WARPS', 'standard', 0.03, 0.02, true, array['USDC', 'REWARD']),
  ('makex-transfers', 'MakeX Transfers', 'standard', 0.03, 0.02, true, array['USDC', 'REWARD']),
  ('makex-swap', 'MakeX Swap', 'standard', 0.03, 0.02, true, array['USDC', 'REWARD']),
  ('makex-assets', 'MakeX Assets Manager', 'standard', 0.03, 0.02, true, array['USDC', 'REWARD']),
  ('makex-nft-snapshot', 'MakeX NFT Snapshot', 'standard', 0.03, 0.02, true, array['USDC', 'REWARD']),
  ('makex-twitter-x', 'MakeX Twitter/X', 'premium', 0.05, null, false, array['USDC'])
on conflict (app_id) do update set
  display_name = excluded.display_name,
  tier = excluded.tier,
  usd_fee_usdc = excluded.usd_fee_usdc,
  usd_fee_reward = excluded.usd_fee_reward,
  whitelist_enabled = excluded.whitelist_enabled,
  allowed_fee_tokens = excluded.allowed_fee_tokens,
  is_active = excluded.is_active,
  updated_at = now();

-- 4. Usage fee ledger (audit trail)
create table if not exists public.makex_usage_fee_ledger (
  id uuid primary key default gen_random_uuid(),
  wallet_address text not null,
  app_id text not null references public.makex_app_billing_profiles(app_id),
  tx_hash text,
  fee_token text not null,
  fee_token_identifier text not null,
  amount_wei text not null,
  usd_amount numeric(10,4) not null,
  skipped_whitelist boolean not null default false,
  whitelist_reason text,
  created_at timestamptz not null default now()
);

create index if not exists makex_usage_fee_ledger_wallet_created_idx
  on public.makex_usage_fee_ledger (wallet_address, created_at desc);

create index if not exists makex_usage_fee_ledger_app_created_idx
  on public.makex_usage_fee_ledger (app_id, created_at desc);

alter table public.makex_usage_fee_ledger enable row level security;

drop policy if exists "makex_usage_fee_ledger_service_all" on public.makex_usage_fee_ledger;
create policy "makex_usage_fee_ledger_service_all"
  on public.makex_usage_fee_ledger
  for all
  to service_role
  using (true)
  with check (true);
