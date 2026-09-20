-- O browser já não fala com o Supabase. Só o Worker (service role) deve ler/escrever.
-- Correr no SQL editor do projecto Abilion. Service role ignora RLS.

alter table public.page_events enable row level security;

drop policy if exists funnels_local on public.funnels;
drop policy if exists leads_local on public.leads;
drop policy if exists lead_events_all on public.lead_events;
drop policy if exists settings_local on public.settings;
drop policy if exists profiles_read on public.profiles;
