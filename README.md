# AbilionDev

Fluxo de operação da Abilion: o canvas publicado **é o runtime** (Typebot / ManyChat). O canal é **só Telegram**. Sté é o agente no 1:1. Banca ninguém inventa.

## O que entra

- Login real: `victor@abilion.com` ou `gabriel@abilion.com`. O primeiro acesso de cada conta define a senha (6+ caracteres).
- Dashboard: leads, conversas, página / cliques, Facebook, espera, ofertas
- Analytics: funil Ads → landing → Telegram → chat, globo de visitantes, gráficos de 30 dias, geo e device — no mesmo estúdio claro do funil
- Leads no passo do fluxo (print, banca, espera, oferta só se o grafo deixar)
- Conversas Telegram: a Sté segue o funil publicado (boas-vindas, minicurso, Superbet, App/Premium, remarketing). A voz muda conforme o que o lead falou; o passo, os links e a próxima fase não mudam. A caixa “Simular lead” corre o motor no painel — não envia Telegram. A IA começa no OpenCode (DeepSeek V4.1 Flash). Se falhar, cai no OpenRouter: Gemma 4 31B e depois DeepSeek V4 Flash. Sem chave, a voz local ainda reconhece o lead.
- Áudio: mensagens grandes do funil saem como áudio da ElevenLabs. Cada clip é gerado uma vez, guardado e reutilizado. Os links continuam no texto.
- Funil com mapa e fluxo executável, no estúdio visual claro (catálogo, quadro e propriedades). O rascunho grava sozinho e também ao sair (Voltar / fechar o separador). No telemóvel, toca num bloco da paleta para o adicionar. O último funil publicado não se apaga.
- Telegram: webhook no Worker (`/api/telegram`) — /start abre a Sté
- Facebook → Telegram: `https://t.me/BOT?start=fb` (500–1000 /start por dia)
- Configurações: Telegram, webhook, pixel `/t.js`. A cópia da Sté edita-se no funil publicado
- Persistência no Worker (KV) + Supabase quando houver service role

## Stack

Vite + React + TypeScript + Tailwind + shadcn/ui + React Flow. Globo de visitantes no Analytics. Helix Chrono Matrix só no login.

Worker Cloudflare (`abilion`) serve o estático e as rotas `/api/*` em [abilion.lol](https://www.abilion.lol).

Dados: o Worker grava leads, funis e o token do Telegram no KV `abilion-auth`. Sem service role do Supabase a operação continua. O browser não fala com o Supabase — não há cliente nem chave anónima no frontend. Só o Worker usa `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE`.

## Correr

```bash
npm install
cp .env.example .env
npm run dev
```

Abre [http://127.0.0.1:43173](http://127.0.0.1:43173).

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

## Fluxo

Nós de **mapa** (não executam): tráfego, landing, divisor de campanha.

Nós de **fluxo** (executam): entrada, mensagem, espera, condição, handoff Sté, avisar Ester, tag, oferta.

No 1:1 a Sté fala o que está no quadro publicado (boas-vindas, minicurso, Superbet, remarketing). O resto do quadro corre: espera, print, banca, oferta.

Sem print → sem banca. Sem o nó de oferta → o canal não vende. O canal é Telegram.

## Supabase

Projecto já usado no wrangler:

- URL: `https://eyjgmkmaixmpmeeahxon.supabase.co`
- Correr [`supabase/migrations/001_flow.sql`](supabase/migrations/001_flow.sql), [`002_ste_chat.sql`](supabase/migrations/002_ste_chat.sql), [`003_facebook_scale.sql`](supabase/migrations/003_facebook_scale.sql), [`004_track_and_facts.sql`](supabase/migrations/004_track_and_facts.sql) e [`005_worker_only_rls.sql`](supabase/migrations/005_worker_only_rls.sql) no SQL editor
- Service role só no Worker. Não há chave anónima no browser. O `005` tira as policies abertas do recorte antigo — sem isso, quem tiver a chave anon ainda lê o workspace `local`.

## Produção

URL no ar: [https://www.abilion.lol](https://www.abilion.lol) (apex [https://abilion.lol](https://abilion.lol) e [https://abilion.vsanches1060.workers.dev](https://abilion.vsanches1060.workers.dev)).

O Worker `abilion` (conta `73dd2cecfc9c7f0220a36fe999e3edf1`) serve o painel e `/api/*`. O CRM Next antigo saiu do ar.

Login: só `victor@abilion.com` ou `gabriel@abilion.com`. O primeiro acesso de cada conta grava a senha no KV `abilion-auth`. Depois, só essa senha entra. Login e “Esqueceu a senha?” têm limite por IP (8 e 5 tentativas / 15 min). Token do Telegram e chaves de IA **não** entram no git — Configurações → Vincular Telegram grava no mesmo KV e aponta o webhook. Troca de senha: Configurações → Conta. “Esqueceu a senha?” só devolve link fora de produção (não há e-mail). Leads: busca por nome/@user, exclusão com confirmação e hidratação até 400 no login. Simular 100 /start pede confirmação.

`ABILION_OPERATOR_PASSWORD` só **cria** as contas que ainda não existem. Depois de criadas, a troca em Configurações → Conta fica. Não reescreve o hash em cada `/api/auth/me`.

```bash
npx wrangler secret put ABILION_OPERATOR_PASSWORD
```

```bash
npm install
npx wrangler login
npm run deploy
```

Domínio **abilion.lol** já aponta para o Worker (`coco.ns.cloudflare.com` / `etienne.ns.cloudflare.com`). Apex, `www` e `abilion.vsanches1060.workers.dev` servem o mesmo painel.

Ao vincular o Telegram, o Worker gera um `secret_token` do webhook e guarda-o no KV. `POST /api/telegram` sem esse secret (ou com o header errado) responde 401 — não aceita updates assinados. `GET /api/cron` só corre com `CRON_SECRET`. Sem cookie, `/api/crm`, `/api/inbox`, `/api/leads` e `/api/track/summary` respondem 401. O painel trata isso como sessão expirada e volta ao login. Analytics com 401 mostra “Sem leitura”, não um gráfico vazio verde. Sem rede, um aviso no topo deixa claro que a sincronização espera. Em produção, o primeiro login só cria a senha se existir `ABILION_OPERATOR_PASSWORD`.

Secrets (nunca no git):

```bash
npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put TELEGRAM_WEBHOOK_SECRET
npx wrangler secret put SUPABASE_SERVICE_ROLE
npx wrangler secret put CRON_SECRET
npx wrangler secret put ESTER_CHAT_ID
npx wrangler secret put OPENAI_API_KEY    # chave OpenRouter sk-or-v1…
npx wrangler secret put OPENCODE_API_KEY  # chave OpenCode oc_sk_… (DeepSeek V4.1 Flash)
npx wrangler secret put ELEVENLABS_API_KEY
npx wrangler secret put ELEVENLABS_VOICE_ID
```

A Sté fala primeiro com **DeepSeek V4.1 Flash** no OpenCode. Se cair, usa OpenRouter: **Gemma 4 31B** e depois **DeepSeek V4 Flash**. As chaves `oc_sk_…` e `sk-or-v1…` gravam-se em Configurações, nunca no git. Sem IA, o quadro e a voz local continuam.

Mensagens grandes saem em áudio da **ElevenLabs** (voz clonada da Sté). Cada beat gera um clip só uma vez; o Telegram reenvia o mesmo `file_id`. Cola o `voice_id` e a chave `sk_…` em Configurações → Bot → Voz da Sté. Sem isso, o bloco continua em texto.

Webhook Telegram: `{origem}/api/telegram`  
Cron de espera: a cada 5 minutos, ou `GET /api/cron?secret=…` (secret obrigatório)  
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

## Rotas

Públicas:

- `/login` — entrada. Só `victor@abilion.com` ou `gabriel@abilion.com`.
- `/forgot` — localmente gera link de reset. Em produção não envia e-mail.
- `/reset?token=` — nova senha a partir do link local.
- `/privacidade` — política do CRM interno.
- `/l` — landing de teste do pixel + CTA Telegram. O botão só aponta para o username gravado no Worker (`GET /api/health`). Sem username, mostra empty state — não inventa um bot.

Autenticadas:

- `/` — dashboard (leads, conversas, Facebook, espera, ofertas).
- `/analytics` — funil Ads → landing → Telegram, globo, 30 dias.
- `/fluxo` — lista de funis.
- `/fluxo/funil/:id` — editor visual + runtime.
- `/leads` — CRM, captura, print/banca.
- `/conversas` — inbox Telegram da Sté (máx. 80).
- `/telegram` — saúde do bot, webhook, simulação de /start.
- `/configuracoes` — bot, conta, plugins, notificações, aparência.

Endereços desconhecidos no painel mostram 404. `next=` no login só aceita estas rotas.

## API do Worker

Todas as rotas `/api/*` (excepto `POST /api/track` e `POST /api/telegram`) exigem sessão, salvo o que está abaixo.

| Rota | Quem |
| --- | --- |
| `GET /api/health` | público: só `{ ok, telegramBotUsername }` |
| `POST /api/auth/login` | público, 8 tentativas / 15 min por IP |
| `POST /api/auth/logout` | sessão |
| `GET /api/auth/me` | sessão |
| `POST /api/auth/forgot` | público; em produção não devolve link |
| `POST /api/auth/reset` | token de reset |
| `POST /api/auth/password` | sessão |
| `GET/POST /api/crm` | sessão — funis e settings (sem token) |
| `GET/POST/DELETE /api/leads` | sessão — lista até 400, grava e apaga |
| `GET /api/inbox` | sessão — leads do Telegram |
| `GET/POST /api/runtime` | sessão — Telegram, IA, voz |
| `POST /api/runtime/voice` | sessão — gera clips ElevenLabs |
| `POST /api/track` | público, CORS aberto só aqui (pixel) |
| `GET /api/track/summary` | sessão |
| `POST /api/telegram` | Telegram; `secret_token` do webhook |
| `GET /api/cron` | `CRON_SECRET` obrigatório |
| `GET /t.js` | pixel |

## Limitações e bloqueios

Estes itens dependem de credenciais ou de uma decisão humana. O código não inventa valores.

- **Telegram em produção** continua desligado até existir `TELEGRAM_BOT_TOKEN` (e, se quiseres fixar, `TELEGRAM_WEBHOOK_SECRET`). Sem isso não há /start reais. A landing `/l` também fica sem CTA até o username estar no Worker.
- **Voz da Sté** fica em texto até `ELEVENLABS_API_KEY` + `ELEVENLABS_VOICE_ID`. Não há `voice_id` inventado.
- **Esqueceu a senha?** em produção não envia e-mail. Troca em Configurações → Conta.
- **Supabase** só entra com `SUPABASE_SERVICE_ROLE`. Sem isso a operação corre no KV `abilion-auth`. Corre `005_worker_only_rls.sql` no SQL editor do projecto Abilion (`eyjgmkmaixmpmeeahxon`) para fechar as policies anónimas. Não é o projecto alecrim.
- **Senhas dos operadores** em produção já estão no KV. Não estão neste repositório. Primeiro acesso local define a senha (6+).
- Plugin **Agenda** e **webhooks de saída** são “Em breve” de propósito. Relatórios exporta CSV da base de leads. Captura abre Leads. Telegram mostra o estado do Worker — sem interruptores que não fazem nada.
- **Notificações** na conta também são “Em breve”. O aviso da Ester no print continua a sair pelo funil quando há `ESTER_CHAT_ID`.
- **Primeiro login em produção** recusa criar senha se o Worker não tiver `ABILION_OPERATOR_PASSWORD`. Localmente o primeiro acesso ainda define a senha (6+).
- `ESTER_CHAT_ID` só é preciso se a Ester receber aviso no Telegram.

## Auditoria

```bash
npm run typecheck
npm run lint
npm test
npm run build
npx tsx scripts/ui-audit.mts
```

`scripts/ui-audit.mts` percorre login, rotas do painel, 404, skip-link, captura, logout → forgot/reset e as larguras 320 / 375 / 768 / 1024 / 1440. Precisa do `npm run dev` em `http://127.0.0.1:43173`.

```bash
npx tsx scripts/ui-audit.mts
AUDIT_URL=https://www.abilion.lol AUDIT_PUBLIC=1 npx tsx scripts/ui-audit.mts
```

`AUDIT_PUBLIC=1` só cobre páginas públicas (a senha de produção dos operadores não está no repositório).
