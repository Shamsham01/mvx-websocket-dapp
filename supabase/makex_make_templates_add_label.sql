-- Add marketplace label column to existing makex_make_templates (run once in Supabase SQL editor).

alter table public.makex_make_templates
  add column if not exists label text;

update public.makex_make_templates
set label = 'Snapshots'
where label is null or trim(label) = '';

alter table public.makex_make_templates
  alter column label set not null,
  alter column label set default 'Snapshots';

create index if not exists idx_makex_make_templates_label
  on public.makex_make_templates (label);

comment on column public.makex_make_templates.label is 'Marketplace category: preset (Snapshots, Draws, …) or admin-defined custom text';
