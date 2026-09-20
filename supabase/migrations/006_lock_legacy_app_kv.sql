-- O dump histórico da Abilion vive em public.app_kv (id / user_id / doc).
-- As tabelas de 001_flow (workspace_id) não existem neste projecto.
-- Sem policies e com RLS o PostgREST já nega; isto tranca grants residuais.
-- Service role ignora RLS. Correr no SQL editor do projecto Abilion
-- (eyjgmkmaixmpmeeahxon). Sem SUPABASE_SERVICE_ROLE o Worker não lê esta tabela.

do $$
begin
  if to_regclass('public.app_kv') is null then
    raise notice 'app_kv ausente — nada a trancar';
    return;
  end if;
  execute 'alter table public.app_kv enable row level security';
  execute 'revoke all on table public.app_kv from anon, authenticated, public';
end $$;
