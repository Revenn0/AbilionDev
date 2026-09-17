# AbilionDev

Fluxo de operação da Abilion: o canvas publicado **é o runtime** (Typebot / ManyChat). Telegram e WhatsApp são canais. Sté e Ester são nós. Banca ninguém inventa.

## O que entra

- Login local (qualquer e-mail + senha com 6+ caracteres)
- Dashboard: leads, conversas, fila Ester, espera, ofertas
- Leads no passo do fluxo (print, banca, espera, oferta só se o grafo deixar)
- Conversas = eventos do runtime
- Funil com mapa (tráfego, landing, campanha) e fluxo executável
- Simulador no editor
- Telegram: webhook no Worker (`/api/telegram`)
- Configurações: canal, Sté (handoff), Ester, plugins
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
- Correr [`supabase/migrations/001_flow.sql`](supabase/migrations/001_flow.sql) no SQL editor
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
