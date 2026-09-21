-- Projecto Supabase vazio SÓ de staging. Nunca corras isto no Postgres de produção.
-- Tabelas que o Worker realmente lê/escreve (workspace_id = 'local').
-- Sem service role o Worker opera só com o KV — este ficheiro é opcional.

create table if not exists public.funnels (
  id text primary key,
  workspace_id text not null default 'local',
  name text not null,
  mode text not null default 'sales',
  status text not null default 'draft',
  nodes jsonb not null default '[]',
  edges jsonb not null default '[]',
  production jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.leads (
  id text primary key,
  workspace_id text not null default 'local',
  name text not null,
  contact text not null,
  channel text not null,
  campaign text not null default '',
  origin text not null,
  start_payload text,
  visitor_id text,
  temperature text not null default 'novo',
  stage text not null default 'capture',
  print_at timestamptz,
  banca_at timestamptz,
  memory text not null default '',
  facts jsonb not null default '{}',
  last_message text,
  funnel_id text,
  node_id text,
  wait_until timestamptz,
  paused boolean not null default false,
  messages jsonb not null default '[]',
  ste_phase text,
  ste_blocked boolean not null default false,
  ste_quiet boolean not null default false,
  telegram_chat_id text,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.lead_events (
  id text primary key,
  lead_id text not null references public.leads(id) on delete cascade,
  at timestamptz not null default now(),
  kind text not null,
  node_id text,
  title text,
  body text,
  effect text
);

create table if not exists public.settings (
  workspace_id text primary key default 'local',
  data jsonb not null default '{}'
);

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

create index if not exists funnels_workspace_idx on public.funnels (workspace_id);
create index if not exists leads_workspace_idx on public.leads (workspace_id);
create index if not exists lead_events_lead_idx on public.lead_events (lead_id);
create index if not exists leads_wait_idx on public.leads (wait_until);
create index if not exists leads_visitor on public.leads (workspace_id, visitor_id);
create index if not exists page_events_workspace_at on public.page_events (workspace_id, at desc);
create index if not exists page_events_visitor on public.page_events (workspace_id, visitor_id);

alter table public.funnels enable row level security;
alter table public.leads enable row level security;
alter table public.lead_events enable row level security;
alter table public.settings enable row level security;
alter table public.page_events enable row level security;

revoke all on public.funnels from anon, authenticated;
revoke all on public.leads from anon, authenticated;
revoke all on public.lead_events from anon, authenticated;
revoke all on public.settings from anon, authenticated;
revoke all on public.page_events from anon, authenticated;
