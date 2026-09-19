# AbilionDev

Fluxo de operação da Abilion: o canvas publicado **é o runtime** (Typebot / ManyChat). O canal é **só Telegram**. Sté é o agente no 1:1. Banca ninguém inventa.

## O que entra

- Login real: `victor@abilion.com` ou `gabriel@abilion.com`. O primeiro acesso de cada conta define a senha (6+ caracteres).
- Dashboard: leads, conversas, página / cliques, Facebook, espera, ofertas
- Analytics: funil Ads → landing → Telegram → chat, globo de visitantes, gráficos de 30 dias, geo e device
- Leads no passo do fluxo (print, banca, espera, oferta só se o grafo deixar)
- Conversas Telegram: a Sté segue o funil publicado (boas-vindas, minicurso, Superbet, App/Premium, remarketing). A voz muda conforme o que o lead falou; o passo, os links e a próxima fase não mudam. A IA tenta primeiro o MiMo V2.5 Free no OpenCode Zen; se o Zen recusar, cai no Gemma e no DeepSeek do OpenRouter. Sem chave, a voz local ainda reconhece o lead.
- Funil com mapa e fluxo executável
- Telegram: webhook no Worker (`/api/telegram`) — /start abre a Sté
- Facebook → Telegram: `https://t.me/BOT?start=fb` (500–1000 /start por dia)
- Configurações: Telegram, webhook, pixel `/t.js`. A cópia da Sté edita-se no funil publicado
- Persistência no Worker (KV) + Supabase quando houver service role

## Stack

Vite + React + TypeScript + Tailwind + shadcn/ui + React Flow. Globo de visitantes no Analytics. Helix Chrono Matrix só no login.

Worker Cloudflare (`abiliondev`) serve o estático e as rotas `/api/*`. O Worker antigo `abilion` / `*.vsanches1060.workers.dev` ficou de fora.

Dados: o Worker grava leads, funis e o token do Telegram no KV `abilion-auth`. Sem service role do Supabase a operação continua. O browser não guarda o token.

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

No 1:1 a Sté fala o que está no quadro publicado (boas-vindas, minicurso, Superbet, remarketing). O resto do quadro corre: espera, print, banca, oferta.

Sem print → sem banca. Sem o nó de oferta → o canal não vende. O canal é Telegram.

## Supabase

Projecto já usado no wrangler:

- URL: `https://eyjgmkmaixmpmeeahxon.supabase.co`
- Correr [`supabase/migrations/001_flow.sql`](supabase/migrations/001_flow.sql), [`002_ste_chat.sql`](supabase/migrations/002_ste_chat.sql) e [`003_facebook_scale.sql`](supabase/migrations/003_facebook_scale.sql) no SQL editor
- Anon em `.env`. Service role só no Worker

## Produção

URL no ar: [https://www.abilion.lol](https://www.abilion.lol) (apex [https://abilion.lol](https://abilion.lol) e [https://abilion.vsanches1060.workers.dev](https://abilion.vsanches1060.workers.dev)).

O Worker `abilion` serve o painel e `/api/*`. O CRM Next antigo saiu do ar.

Login: só `victor@abilion.com` ou `gabriel@abilion.com`. O primeiro acesso de cada conta grava a senha no KV `abilion-auth`. Depois, só essa senha entra. Token do Telegram e chave GLM **não** entram no git — Configurações → Vincular Telegram grava no mesmo KV e aponta o webhook.

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
npx wrangler secret put OPENCODE_API_KEY  # chave OpenCode oc_sk…
npx wrangler secret put OPENAI_API_KEY    # chave OpenRouter sk-or-v1…
```

Sté fala primeiro com **OpenCode Zen** no **MiMo V2.5 Free** (`mimo-v2.5-free`). O Zen grátis recusa pedidos feitos fora do app OpenCode (403); nesse caso a Sté cai no **Gemma 4 31B** e depois no **DeepSeek V4 Flash** do OpenRouter. As chaves `oc_sk…` e `sk-or-v1…` gravam-se em Configurações, nunca no git. Sem IA, o quadro e a voz local continuam.

Webhook Telegram: `{origem}/api/telegram`  
Cron de espera: hora a hora, ou `GET /api/cron?secret=…`  
O bot configura-se em Configurações. Vincular grava o token no Worker, aponta `https://www.abilion.lol/api/telegram` e a Sté passa a responder. O token **não** entra no repositório.

## Facebook → Telegram (volume)

O anúncio aponta para `https://t.me/BOT?start=fb` (ou `fb_campanha`). O Worker:

- responde 200 na hora (`waitUntil`) para o Telegram não reenviar
- procura **um** lead por contacto / chat, sem carregar a base
- abre a Sté com o motor determinístico; o papo livre da oferta usa OpenRouter (Gemma, DeepSeek de reserva)
- reenvia se a API do Telegram devolver 429

Correr [`supabase/migrations/003_facebook_scale.sql`](supabase/migrations/003_facebook_scale.sql) e [`supabase/migrations/004_track_and_facts.sql`](supabase/migrations/004_track_and_facts.sql) no SQL editor. A inbox mostra no máximo 80 conversas (aguardando / hoje / Facebook).

Pixel da landing (Configurações → Bot Telegram):

```html
<script src="https://www.abilion.lol/t.js" data-cta="[data-abilion-cta]"></script>
```

O clique reescreve o `t.me/BOT?start=fb_{vid}`. O webhook fecha o evento `telegram` com o mesmo visitor.

Landing de teste (pixel + CTA): `/l` — local [http://127.0.0.1:43173/l](http://127.0.0.1:43173/l), produção [https://www.abilion.lol/l](https://www.abilion.lol/l).

## País e estado

Não dá para inventar uma base GeoIP. O rastreio junta três fontes abertas, sem chave:

1. **Cloudflare `request.cf`** em produção (`country`, `region`, `regionCode`, `city`) — a melhor UF no Brasil
2. **[ipwho.is](https://ipwho.is)** e **[geojs.io](https://www.geojs.io)** como fallback HTTPS quando o Worker não traz região
3. Fuso horário do browser só para estados com TZ próprio (`America/Bahia` → BA). `America/Sao_Paulo` não separa SP/RJ/MG

Bandeira vem do ISO 3166-1 (emoji). UF brasileira usa a tabela IBGE. Conversas, Leads e Analytics mostram `🇧🇷 São Paulo (SP)`.

Simulador de 100 leads Facebook roda UFs reais para o CRM não ficar “Sem estado” sem pixel.
