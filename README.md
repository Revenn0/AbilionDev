# AbilionDev

Fluxo de operação da Abilion: o canvas publicado **é o runtime** (Typebot / ManyChat). Telegram e WhatsApp são canais. Sté e Ester são nós. Banca ninguém inventa.

## O que entra

- Login real: `victor@abilion.com` ou `gabriel@abilion.com`. O primeiro acesso de cada conta define a senha (6+ caracteres).
- Dashboard: leads, conversas, fila Ester, espera, ofertas
- Leads no passo do fluxo (print, banca, espera, oferta só se o grafo deixar)
- Conversas Telegram: a Sté (Mãe do Aviator) segue o prompt interno — 3 boas-vindas, minicurso, Superbet, App/Premium e remarketing
- Funil com mapa e fluxo executável
- Telegram: webhook no Worker (`/api/telegram`) — /start abre a Sté
- Facebook → Telegram: `https://t.me/BOT?start=fb` (500–1000 /start por dia)
- Configurações: bot Telegram, Sté ligada/desligada
- Persistência local + Supabase quando houver anon key

## Stack

Vite + React + TypeScript + Tailwind + shadcn/ui + React Flow.

Worker Cloudflare (`abiliondev`) serve o estático e as rotas `/api/*`. O Worker antigo `abilion` / `*.vsanches1060.workers.dev` ficou de fora.

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

No 1:1 a Sté segue o prompt interno (GLM). O resto do quadro corre: espera, print, banca, oferta.

Sem print → sem banca. Sem o nó de oferta → o canal não vende. Campanhas WA e TG não se misturam.

## Supabase

Projecto já usado no wrangler:

- URL: `https://eyjgmkmaixmpmeeahxon.supabase.co`
- Correr [`supabase/migrations/001_flow.sql`](supabase/migrations/001_flow.sql), [`002_ste_chat.sql`](supabase/migrations/002_ste_chat.sql) e [`003_facebook_scale.sql`](supabase/migrations/003_facebook_scale.sql) no SQL editor
- Anon em `.env`. Service role só no Worker

## Produção

URL no ar: [https://www.abilion.lol](https://www.abilion.lol) (apex [https://abilion.lol](https://abilion.lol) e [https://abilion.vsanches1060.workers.dev](https://abilion.vsanches1060.workers.dev)).

O Worker `abilion` serve o painel e `/api/*`. O CRM Next antigo saiu do ar.

Login: só `victor@abilion.com` ou `gabriel@abilion.com`. O primeiro acesso de cada conta grava a senha no KV `abilion-auth`. Depois, só essa senha entra. Token do Telegram e chave de IA **não** entram no git — grava em Configurações e `wrangler secret put`.

Para forçar a mesma senha nas duas contas:

```bash
npx wrangler secret put ABILION_OPERATOR_PASSWORD
```

```bash
npm install
npx wrangler login
npm run deploy
```

Domínio **abilion.lol** (Namecheap → DNS na Cloudflare):

O domínio é novo: a ICANN trava **transferência de registrador** por 60 dias. O que activa o site é apontar os **nameservers** para a Cloudflare. A compra continua na Namecheap.

Estado actual do DNS: nameservers `coco.ns.cloudflare.com` / `etienne.ns.cloudflare.com`. O Worker já serve `abilion.lol` e `www.abilion.lol`.

1. Na Cloudflare, conta do Worker `abilion`: [Onboard a domain](https://dash.cloudflare.com/?to=/:account/add-site). Apex `abilion.lol`. Plano **Free**.
2. Na revisão de DNS, **apaga** o A de parking (`162.255.119.137`) e o CNAME/A de `www` da Namecheap. O custom domain do Worker cria os records certos depois. Continua e **copia os 2 nameservers** (`*.ns.cloudflare.com`).
3. Na Namecheap [Domain List](https://ap.www.namecheap.com/domains/list/) → **Manage** em `abilion.lol`. Se **DNSSEC** estiver ligado, desliga. **Nameservers** → **Custom DNS**. Cola os 2 NS da Cloudflare e guarda o visto verde.
4. Espera a zona ficar **Active** (minutos a algumas horas). Confere com `dig NS abilion.lol @1.1.1.1`.
5. Workers → `abilion` → Settings → Domains & Routes → **Add** → Custom Domain → `abilion.lol` e `www.abilion.lol`.

Não meter `custom_domain` no `wrangler.jsonc` de produção antes da zona existir — o deploy falha.

Enquanto o DNS não propaga, o painel continua em [https://abilion.vsanches1060.workers.dev](https://abilion.vsanches1060.workers.dev).

Secrets (nunca no git):

```bash
npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put TELEGRAM_WEBHOOK_SECRET
npx wrangler secret put SUPABASE_SERVICE_ROLE
npx wrangler secret put CRON_SECRET
npx wrangler secret put ESTER_CHAT_ID
npx wrangler secret put OPENAI_API_KEY
```

Sté responde com **GLM 5.3 Flash** no **GLM Coding Plan** (`https://api.z.ai/api/coding/paas/v4`). A chave vai só no secret do Worker. Não uses o endpoint geral `/api/paas/v4`.

Webhook Telegram: `{origem}/api/telegram`  
Cron de espera: hora a hora, ou `GET /api/cron?secret=…`  
WhatsApp Cloud: `POST /api/whatsapp` (mesmo contrato; token opcional)

O bot configura-se em Configurações e fica gravado no workspace. O token **não** entra no repositório.

## Facebook → Telegram (volume)

O anúncio aponta para `https://t.me/BOT?start=fb` (ou `fb_campanha`). O Worker:

- responde 200 na hora (`waitUntil`) para o Telegram não reenviar
- procura **um** lead por contacto / chat, sem carregar a base
- abre a Sté com o motor determinístico; as respostas usam **GLM 5.3 Flash** no GLM Coding Plan
- reenvia se a API do Telegram devolver 429

Correr [`supabase/migrations/003_facebook_scale.sql`](supabase/migrations/003_facebook_scale.sql) no SQL editor. A inbox mostra no máximo 80 conversas (aguardando / hoje / Facebook).
