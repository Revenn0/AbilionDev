-- Atribuição Facebook → Telegram e lookups do webhook (1 lead, não a base).
alter table public.leads add column if not exists start_payload text;

create index if not exists leads_contact_idx on public.leads (workspace_id, contact);
create index if not exists leads_tg_chat_idx on public.leads (workspace_id, telegram_chat_id);
create index if not exists leads_updated_idx on public.leads (workspace_id, updated_at desc);
create index if not exists leads_origin_created_idx on public.leads (workspace_id, origin, created_at desc);
