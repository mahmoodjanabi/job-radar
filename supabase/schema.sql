-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run
create table if not exists public.jobs (
  id            text primary key,          -- sha1(source:external_id)
  source        text not null,
  external_id   text not null,
  url           text not null,
  title         text not null,
  company       text,
  location      text,
  remote        boolean,
  salary_min    integer,
  salary_max    integer,
  description   text,
  posted_at     timestamptz,
  score         integer,                   -- 0-100 from Claude; 0 = prefilter reject; null = scoring failed
  verdict       jsonb,                     -- full Claude verdict (role_fit, work_mode, summary, concerns...)
  notified_at   timestamptz,
  first_seen_at timestamptz not null default now()
);

create index if not exists jobs_score_notified_idx on public.jobs (score desc) where notified_at is null;
create index if not exists jobs_first_seen_idx on public.jobs (first_seen_at desc);

-- Keep the service-role key server-side only; nothing here is exposed to browsers.
alter table public.jobs enable row level security;

-- Handy view for browsing matches in the Supabase table editor
create or replace view public.matches as
  select first_seen_at::date as seen, score, title, company, location,
         verdict->>'work_mode' as mode, verdict->>'salary_note' as salary,
         verdict->>'summary' as summary, url, notified_at
  from public.jobs
  where score >= 70
  order by first_seen_at desc, score desc;
