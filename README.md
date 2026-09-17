# AbilionDev

Fluxo de operação da Abilion: o canvas publicado **é o runtime** (Typebot / ManyChat). Telegram e WhatsApp são canais. Sté e Ester são nós. Banca ninguém inventa.

## O que entra

- Login local (qualquer e-mail + senha com 6+ caracteres)
- Dashboard: leads, conversas, fila Ester, espera, ofertas
- Leads no passo do fluxo (print, banca, espera, oferta só se o grafo deixar)
- Conversas Telegram: a Sté (Mãe do Aviator) fala uma frase e espera o lead
- Funil com mapa e fluxo executável
- Telegram: webhook no Worker (`/api/telegram`) — /start abre a Sté
- Facebook → Telegram: `https://t.me/BOT?start=fb` (500–1000 /start por dia)
- Configurações: bot Telegram, Sté ligada/desligada
- Persistência local + Supabase quando houver anon key

## Stack

Vite + React + TypeScript + Tailwind + shadcn/ui + React Flow.

Worker Cloudflare (`abilion` / `abilion-staging`) serve o estático e as rotas `/api/*`.

Dados: `localStorage` sempre; Supabase do projecto já usado se `VITE_SUPABASE_ANON_KEY` existir.

## Correr

```bash
npm install
cp .env.example .env
npm run dev
```

Abre [http://127.0.0.1:43173](http://127.0.0.1:43173).

## Fluxo

Nós de **mapa** (não executam): tráfego, landing, divisor de campanha.

Nós de **fluxo** (executam): entrada, mensagem, espera, condição, handoff Sté, avisar Ester, tag, oferta.

Sem print → sem banca. Sem o nó de oferta → o canal não vende. Campanhas WA e TG não se misturam.

## Supabase

Projecto já usado no wrangler:

- URL: `https://eyjgmkmaixmpmeeahxon.supabase.co`
- Correr [`supabase/migrations/001_flow.sql`](supabase/migrations/001_flow.sql), [`002_ste_chat.sql`](supabase/migrations/002_ste_chat.sql) e [`003_facebook_scale.sql`](supabase/migrations/003_facebook_scale.sql) no SQL editor
- Anon em `.env`. Service role só no Worker

## Cloudflare

- Produção: `abilion` → `https://abilion.vsanches1060.workers.dev`
- Staging: `abilion-staging` → `https://abilion-staging.vsanches1060.workers.dev`

```bash
npm run build
npx wrangler deploy
```

Secrets (nunca no git):

```bash
npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put TELEGRAM_WEBHOOK_SECRET
npx wrangler secret put SUPABASE_SERVICE_ROLE
npx wrangler secret put CRON_SECRET
npx wrangler secret put ESTER_CHAT_ID
```

Webhook Telegram: `https://abilion.vsanches1060.workers.dev/api/telegram`  
Cron de espera: hora a hora, ou `GET /api/cron?secret=…`  
WhatsApp Cloud: `POST /api/whatsapp` (mesmo contrato; token opcional)

O bot configura-se em Configurações e fica gravado no workspace. O token **não** entra no repositório.

## Facebook → Telegram (volume)

O anúncio aponta para `https://t.me/BOT?start=fb` (ou `fb_campanha`). O Worker:

- responde 200 na hora (`waitUntil`) para o Telegram não reenviar
- procura **um** lead por contacto / chat, sem carregar a base
- abre a Sté com o motor determinístico (LLM só com `STE_USE_LLM=1`)
- reenvia se a API do Telegram devolver 429

Correr [`supabase/migrations/003_facebook_scale.sql`](supabase/migrations/003_facebook_scale.sql) no SQL editor. A inbox mostra no máximo 80 conversas (aguardando / hoje / Facebook).
