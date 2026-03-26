-- Makex: Make.com blueprint templates
-- Run in Supabase SQL editor (or your migration pipeline).

-- Table: public read via anon key; INSERT/UPDATE/DELETE only with service role (backend).
create table if not exists public.makex_make_templates (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  preview_image_url text not null,
  blueprint_file_url text not null,
  blueprint_filename text not null default 'blueprint.json',
  storage_preview_path text not null,
  storage_blueprint_path text not null,
  label text not null default 'Snapshots',
  youtube_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_makex_make_templates_created_at
  on public.makex_make_templates (created_at desc);

create index if not exists idx_makex_make_templates_label
  on public.makex_make_templates (label);

alter table public.makex_make_templates enable row level security;

drop policy if exists "makex_make_templates_select_public" on public.makex_make_templates;
create policy "makex_make_templates_select_public"
  on public.makex_make_templates
  for select
  to anon, authenticated
  using (true);

-- Storage: public bucket for previews + blueprint JSON (direct download URLs)
insert into storage.buckets (id, name, public)
values ('make-blueprints', 'make-blueprints', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "make_blueprints_public_read" on storage.objects;
create policy "make_blueprints_public_read"
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'make-blueprints');

-- Uploads go through the API using the service role key (bypasses RLS).
comment on table public.makex_make_templates is 'Make.com scenario blueprints for MakeX; admin CRUD via backend only';
