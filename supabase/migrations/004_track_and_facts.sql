alter table public.leads add column if not exists visitor_id text;
alter table public.leads add column if not exists facts jsonb not null default '{}';
alter table public.leads add column if not exists ste_quiet boolean not null default false;

create table if not exists public.page_events (
  id uuid primary key,
  workspace_id text not null default 'local',
  visitor_id text not null,
  kind text not null,
  path text,
  referrer text,
  campaign text,
  country text,
  city text,
  region text,
  device text,
  language text,
  at timestamptz not null default now()
);

create index if not exists page_events_workspace_at on public.page_events (workspace_id, at desc);
create index if not exists page_events_visitor on public.page_events (workspace_id, visitor_id);
create index if not exists leads_visitor on public.leads (workspace_id, visitor_id);
