alter table public.leads add column if not exists messages jsonb not null default '[]';
alter table public.leads add column if not exists ste_phase text;
alter table public.leads add column if not exists ste_blocked boolean not null default false;
alter table public.leads add column if not exists telegram_chat_id text;
