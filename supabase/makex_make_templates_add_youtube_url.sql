-- Optional YouTube walkthrough link for each template (run once in Supabase SQL editor).

alter table public.makex_make_templates
  add column if not exists youtube_url text;

comment on column public.makex_make_templates.youtube_url is 'Optional YouTube video URL (full https link)';
