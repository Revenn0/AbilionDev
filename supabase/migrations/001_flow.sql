-- Recorte do fluxo executável. Correr no projecto Abilion já existente.
-- Service role só no Worker (wrangler secret). Anon no .env, nunca no git.

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  email text,
  name text,
  created_at timestamptz not null default now()
);

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
  temperature text not null default 'novo',
  stage text not null default 'capture',
  print_at timestamptz,
  banca_at timestamptz,
  memory text not null default '',
  last_message text,
  funnel_id text,
  node_id text,
  wait_until timestamptz,
  paused boolean not null default false,
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

create index if not exists funnels_workspace_idx on public.funnels (workspace_id);
create index if not exists leads_workspace_idx on public.leads (workspace_id);
create index if not exists lead_events_lead_idx on public.lead_events (lead_id);
create index if not exists leads_wait_idx on public.leads (wait_until);

alter table public.profiles enable row level security;
alter table public.funnels enable row level security;
alter table public.leads enable row level security;
alter table public.lead_events enable row level security;
alter table public.settings enable row level security;

-- Recorte sem auth de produto: o Worker usa service role.
-- Anon só escreve o workspace local deste recorte.
drop policy if exists funnels_local on public.funnels;
create policy funnels_local on public.funnels for all using (workspace_id = 'local') with check (workspace_id = 'local');

drop policy if exists leads_local on public.leads;
create policy leads_local on public.leads for all using (workspace_id = 'local') with check (workspace_id = 'local');

drop policy if exists lead_events_all on public.lead_events;
create policy lead_events_all on public.lead_events for all using (true) with check (true);

drop policy if exists settings_local on public.settings;
create policy settings_local on public.settings for all using (workspace_id = 'local') with check (workspace_id = 'local');

drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select using (true);
