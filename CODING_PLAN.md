# Coding plan — Abilion operacional

O recorte já está no ar. Este plano é o que **precisa ser** para a operação (Facebook → Telegram → Sté → Ester) funcionar de verdade, não só o painel vazio.

Critério de pronto (sempre): URL de produção + fluxo como utilizador + print + análise. Localhost não fecha fase.

Produção actual: https://abilion.vsanches1060.workers.dev  
Worker: `abilion`  
Modelo: `glm-5.3-flash` em `https://api.z.ai/api/paas/v4`  
Domínio comprado: `abilion.lol` (ainda na Namecheap)

---

## Já feito

- Painel Vite (login local, dashboard, leads, conversas, funil executável, Telegram, configurações)
- Worker serve estático + `/api/telegram` + `/api/cron` + `/api/health`
- Sté: opener determinístico; respostas pelo GLM 5.3 Flash quando existe `OPENAI_API_KEY`
- Facebook `/start=fb`, `waitUntil`, lookup de um lead, inbox cap 80, burst de 100
- Tema com contraste (já não é preto-em-preto)
- CRM Next antigo saiu; este recorte é o que o Worker `abilion` serve

## Bloqueios (não são código)

| Bloqueio | Quem | Sem isto |
|---|---|---|
| Secret `OPENAI_API_KEY` no Worker | Cloudflare → `abilion` → Variables | `health.llm` fica `false`; Sté não usa o GLM |
| Secret `TELEGRAM_BOT_TOKEN` (+ webhook secret) | Cloudflare + Configurações | Bot não fala; webhook morto |
| Nameservers `abilion.lol` → Cloudflare | Namecheap + Add site | Domínio fica no parking |
| `SUPABASE_SERVICE_ROLE` + migrations 001–003 | Cloudflare + SQL editor | Persistência só no `localStorage` do browser |
| `VITE_SUPABASE_ANON_KEY` no build | wrangler / `.env` de build | Painel não puxa a base |

Nenhuma chave entra no git.

---

## Fase 1 — Secrets no Worker

1. No dashboard Cloudflare, Worker `abilion` → Settings → Variables and Secrets, gravar **Secret**:
   - `OPENAI_API_KEY`
   - `TELEGRAM_BOT_TOKEN`
   - `TELEGRAM_WEBHOOK_SECRET`
   - `SUPABASE_SERVICE_ROLE` (quando a migration estiver corrida)
   - `ESTER_CHAT_ID` (quando Ester tiver chat)
2. Confirmar `GET /api/health` → `llm: true`, `telegram: true`, `model: glm-5.3-flash`.
3. Print do health e da aba Configurações.

Pronto quando o health reflecte os secrets e o painel não mostra ecrã preto.

## Fase 2 — `abilion.lol` na Cloudflare

1. Add site `abilion.lol` (Free); copiar os 2 NS.
2. Namecheap → Domain List → Manage → Custom DNS; DNSSEC off; colar NS.
3. Worker `abilion` → Custom Domain: `abilion.lol` e `www.abilion.lol`.
4. Deploy só depois da zona existir (senão o `custom_domain` no wrangler parte o build).
5. Abrir `https://abilion.lol/login`, print, login, dashboard.

Pronto quando o login no domínio próprio é o mesmo painel do workers.dev.

## Fase 3 — Telegram ao vivo

1. Configurações → username do bot (vazio até gravar).
2. `setWebhook` para `{origem}/api/telegram` com o secret do Worker.
3. Teste real: `/start`, `/start fb`, ofensa (uma desculpa e silêncio), dor, preço.
4. Anúncio: `https://t.me/BOT?start=fb`.
5. Print Conversas + thread + Telegram.

Pronto quando um telemóvel real recebe a Sté e o lead aparece no painel.

## Fase 4 — Supabase (a mesma base, não outra)

1. Correr `001_flow.sql`, `002_ste_chat.sql`, `003_facebook_scale.sql` no projecto `eyjgmkmaixmpmeeahxon`.
2. Anon no build (`VITE_SUPABASE_ANON_KEY`); service role só no Worker.
3. Verificar pull/push: funil publicado, lead de `/start`, eventos, settings sem apagar o token local.
4. Print Leads e Conversas depois de um reload noutro browser.

Pronto quando dois browsers vêem os mesmos leads (não só `localStorage`).

## Fase 5 — Sté + GLM em conversa real

1. Opener continua determinístico (500–1000 `/start`/dia).
2. Follow-up: `glm-5.3-flash`, `reasoning_effort: low`, uma frase, fallback se a API falhar.
3. Guardrail de ofensa no motor (não no modelo).
4. Burst 100 no painel + 5 conversas humanas.
5. Print thread: acolhimento → preço semestral só depois da dor.

Pronto quando o GLM não despeja bloco, não vende no primeiro toque, e ofensa encerra.

## Fase 6 — Ester e espera

1. `ESTER_CHAT_ID` ou chat gravado em Configurações.
2. Cron horário (conta paga) ou `GET /api/cron`.
3. Print sem banca → aviso Ester; espera do funil avança no timer.
4. Print fila Ester e lead em espera.

Pronto quando um wait do canvas dispara sozinho e Ester recebe o print.

## Fase 7 — Volume Facebook

1. Índices da `003` no ar.
2. Webhook 200 + `waitUntil`; sem `loadWorkspace` no `/start`.
3. Inbox 80; persistir só a fatia recente no browser.
4. 429 do Telegram com retry.
5. Print dashboard “Facebook hoje” depois de um burst ou de tráfego real.

Pronto quando 100 `/start` não derrubam o Worker nem o painel.

---

## Fora deste recorte

- WhatsApp Cloud como canal vivo (contrato `/api/whatsapp` já existe; não é a fatia)
- Auth Cloud / multi-tenant
- Domínio `abilion.com` (o que existe é `abilion.lol`)
- Recolocar o CRM Next

## Ordem (dependências)

```
Secrets GLM + Telegram  →  Fase 3 (bot fala)
Migrations + service role → Fase 4 (base) → Fase 6–7 (cron e volume)
NS Namecheap             →  Fase 2 (domínio)  — pode ir a par das fases 1 e 3
```

## Risco

- Meter `custom_domain` no wrangler antes da zona `abilion.lol` falha o deploy.
- Meter a chave do GLM ou o token do bot no git. Só secret.
- Ligar LLM no `/start` no pico. Opener fica determinístico.
- `max_tokens` baixo no GLM come o thinking e a Sté cala. Manter ≥ 1024 e `reasoning_effort: low`.
