# AbilionDev

Recorte novo do Abilion: **login**, **área interna** e **criador de funis / fluxo**.

A UI veio do CRM-ABILION (`web/`). O resto — inbox, bots, Baileys, motor — ficou de fora de propósito.

## O que entra

- Login em ecrã partido, wordmark e tema claro/escuro
- Shell interno (sidebar recolhível, dashboard)
- Página Fluxo: funil visual, fluxo do bot, campanhas
- Canvas com paleta, inspector, rascunho e publicação
- Variáveis do Supabase e Cloudflare do projecto anterior

## Stack

Vite + React + TypeScript + Tailwind + shadcn/ui + React Flow.

Dados deste recorte ficam no `localStorage`. Auth remoto e webhooks vêm depois.

## Correr

```bash
npm install
cp .env.example .env
npm run dev
```

Abre [http://127.0.0.1:43173](http://127.0.0.1:43173). Entra com qualquer e-mail e uma senha com 6+ caracteres.

## Supabase

Projecto já usado no wrangler do Abilion:

- URL: `https://eyjgmkmaixmpmeeahxon.supabase.co`
- Anon / service role: secrets no dashboard, nunca no git

## Cloudflare

- Worker de produção: `abilion` → `https://abilion.vsanches1060.workers.dev`
- Staging: `abilion-staging` → `https://abilion-staging.vsanches1060.workers.dev`
- Conta: `vsanches1060`

Publicar o estático:

```bash
npm run build
npx wrangler deploy
```

Segredos (`SUPABASE_ANON_KEY`, `CRON_SECRET`, tokens de canal) vão com `wrangler secret put`, não no `wrangler.jsonc`.
