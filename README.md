# AbilionDev

Fluxo de operação da Abilion: o canvas publicado **é o runtime** (Typebot / ManyChat). O canal é **só Telegram**. Sté é o agente no 1:1. Banca ninguém inventa.

## O que entra

- Login real: `victor@abilion.com` ou `gabriel@abilion.com` no primeiro acesso (cada um define a senha, 6+). Contas novas criam-se em **Utilizadores** — o login não inventa e-mails.
- Dashboard: leads, conversas, página / cliques, Facebook, espera, ofertas
- Analytics: funil Ads → landing → Telegram → chat, globo de visitantes, gráficos de 30 dias, geo e device — no mesmo estúdio claro do funil
- Leads no passo do fluxo (print, banca, espera, oferta só se o grafo deixar)
- Conversas Telegram: a Sté segue o funil publicado (boas-vindas, minicurso, Superbet, App/Premium, remarketing). A voz muda conforme o que o lead falou; o passo, os links e a próxima fase não mudam. Sem inbox, “Simular conversa” cria um lead Facebook a meio do funil (não o encerrado do lote). A caixa “Simular lead” corre o motor no painel — não envia Telegram. A IA começa no OpenCode (DeepSeek V4.1 Flash). Se falhar, cai no OpenRouter: Gemma 4 31B e depois DeepSeek V4 Flash. Sem chave, a voz local ainda reconhece o lead.
- Áudio: mensagens grandes do funil saem como áudio da ElevenLabs. Cada clip é gerado uma vez, guardado e reutilizado. Os links continuam no texto.
- Funil com mapa e fluxo executável, no estúdio visual claro (catálogo, quadro e propriedades). O rascunho grava sozinho e também ao sair (Voltar / fechar o separador). Publicar um funil torna-o o único quadro activo — a Sté segue o `publishedAt` mais recente. No telemóvel, toca num bloco da paleta para o adicionar. O último funil publicado não se apaga.
- Telegram: webhook no Worker (`/api/telegram`) — /start abre a Sté
- Facebook → Telegram: o anúncio aponta para `https://www.abilion.lol/l` (500–1000 /start por dia). O Worker serve o HTML com `t.js` e o CTA no primeiro byte; o pixel fecha o visitante no `?start=fb_{vid}`.
- Configurações: Telegram, webhook, pixel `/t.js`. A cópia da Sté edita-se no funil publicado
- Persistência no Worker (KV) + Supabase quando houver service role

## Stack

Vite + React + TypeScript + Tailwind + shadcn/ui + React Flow. Globo de visitantes no Analytics. Helix Chrono Matrix só no login.

Worker Cloudflare (`abilion`) serve o estático e as rotas `/api/*` em [abilion.lol](https://www.abilion.lol).

Dados: o Worker grava leads, funis e o token do Telegram no KV `abilion-auth`. Sem service role do Supabase a operação continua. Se o PostgREST falhar (rede, JSON inválido, 4xx/5xx), o Worker devolve o KV e não derruba o CRM. O browser não fala com o Supabase — não há cliente nem chave anónima no frontend. Só o Worker usa `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE`.

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
- O projecto Abilion em produção guarda o dump antigo em `public.app_kv`, não nas tabelas `workspace_id` do `001_flow`. Corre [`006_lock_legacy_app_kv.sql`](supabase/migrations/006_lock_legacy_app_kv.sql) no SQL editor para trancar `app_kv` (RLS + revoke anon/authenticated). Os ficheiros `001`–`005` descrevem um recorte que este projecto nunca criou — **não os corras** (incluindo `003` e `004`) à espera de ver os 2268 contactos. Sem `SUPABASE_SERVICE_ROLE` o Worker não lê Postgres.
- Service role só no Worker. Não há chave anónima no browser. O `006` tranca `app_kv`. O `005` só aplica se alguém tiver criado as tabelas do `001`.

## Produção

URL no ar: [https://www.abilion.lol](https://www.abilion.lol) (apex [https://abilion.lol](https://abilion.lol) e [https://abilion.vsanches1060.workers.dev](https://abilion.vsanches1060.workers.dev)).

O Worker `abilion` (conta `73dd2cecfc9c7f0220a36fe999e3edf1`) serve o painel e `/api/*`. O CRM Next antigo saiu do ar. `run_worker_first` faz o HTML (`/` incluído) passar pelo Worker para levar CSP, `X-Frame-Options` e o resto dos headers — o pipeline de assets sozinho não os punha na home. O tema deixa de ser script inline (`/theme.js`); `script-src` fica só `'self'`. Staging (`wrangler.staging.jsonc`) tem o mesmo `run_worker_first` e um KV `AUTH` próprio (`abilion-auth-staging`) — não aponta para o KV de produção. O webhook do Telegram guarda 8000 `update_id` e um piso: ids que saíram do anel não reprocessam. Update sem remetente (`my_chat_member`, mensagem sem `from`, saída do grupo) não entra no anel — o Telegram pode repetir quando o Worker passar a tratar.

Login: `victor@abilion.com` e `gabriel@abilion.com` no primeiro acesso (definem a senha). As outras contas só entram depois de um dono as criar em Utilizadores. Login, “Esqueceu a senha?” e troca de senha têm limite por IP (8, 5 e 5 tentativas / 15 min). Cada conta fica com no máximo 5 sessões activas e 20 tokens MCP (`abn_…`). O snapshot de auth no KV une sessões, tokens e contas no gravar. Uma troca de senha marca `passwordUpdatedAt`: um login que ainda tinha o hash velho não reverte a senha nem reabre sessões antigas. Desligar ou mudar o papel marca `accountUpdatedAt`: um snapshot velho com a conta ligada não a volta a ligar. Logout e troca de senha gravam tombstone do token de sessão (até 2000). Troca de senha e reset também esvaziam os tokens MCP da conta e gravam os ids em `revokedApi` — um `abn_…` velho não continua no `/mcp`. O merge do KV põe o tombstone novo à frente e não larga ids que ainda aparecem em sessões, tokens ou resets. Apagar um token MCP grava o id em `revokedApi` (até 2000) — um save concorrente não o ressuscita. Token do Telegram e chaves de IA **não** entram no git — Configurações → Vincular Telegram grava no mesmo KV e aponta o webhook. **Só o dono** grava token, chaves e gera a voz (`POST /api/runtime` e `/api/runtime/voice` são 403 para operador). O operador lê o estado e o pixel. Troca de senha: Configurações → Conta. “Esqueceu a senha?” só devolve link fora de produção (não há e-mail). Conta desligada não recebe link e um token antigo de reset também não troca a senha — o token gasta-se. Leads: busca por nome/@user/telefone/campanha (acentos dobrados no painel e no Worker; a caixa também pergunta o Worker se o lead já saiu da lista hidratada), exclusão com confirmação e hidratação até 16000 no login (40 páginas de 400). Tombstone de exclusão guarda 8000 ids no Worker e no `localStorage` (os mais novos). O `localStorage` guarda 2000 leads e não larga os que ainda estão na fila de POST. Simular 100 /start pede confirmação.

`ABILION_OPERATOR_PASSWORD` é opcional: só **cria** as contas que ainda não existem. Sem o secret, o primeiro login de cada operador define a senha. Depois de criadas, a troca em Configurações → Conta fica. Não reescreve o hash em cada `/api/auth/me`.

```bash
npx wrangler secret put ABILION_OPERATOR_PASSWORD
```

```bash
npm install
npx wrangler login
npm run deploy
```

Domínio **abilion.lol** já aponta para o Worker (`coco.ns.cloudflare.com` / `etienne.ns.cloudflare.com`). Apex, `www` e `abilion.vsanches1060.workers.dev` servem o mesmo painel.

Ao vincular o Telegram, o Worker gera um `secret_token` do webhook e guarda-o no KV. `POST /api/telegram` sem esse secret (ou com o header errado) responde 401 — não aceita updates assinados. `GET /api/cron` só corre com `CRON_SECRET`. Sem cookie nem Bearer `abn_…`, `/api/crm`, `/api/inbox`, `/api/leads` e `/api/track/summary` respondem 401. CRM, inbox e leads tratam isso como sessão expirada e voltam ao login. O poll do pixel (`/api/track/summary`) **não** desloga — Analytics/Dashboard mostram “Sem leitura”, não um gráfico vazio verde. A sessão cai pelo `/api/auth/me` (15 s) e pelas escritas do CRM. Sem rede, um aviso no topo deixa claro que a sincronização espera. Se o `/api/auth/me` falhar sem ser 401, o painel avisa que a sessão em cache não está confirmada — não finge que está tudo ok. O primeiro login de `victor@abilion.com` ou `gabriel@abilion.com` define a senha (6+), também em produção. Contas criadas em Utilizadores já nascem com senha. `ABILION_OPERATOR_PASSWORD` é opcional e só cria as duas contas iniciais que ainda não existem.

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

O anúncio aponta para a landing (`https://www.abilion.lol/l` ou `/l?s=ID`), não para `t.me`. O Worker:

- responde 200 na hora (`waitUntil`) para o Telegram não reenviar
- procura **um** lead por contacto / chat, sem carregar a base
- abre a Sté com o motor determinístico; o papo livre da oferta usa OpenCode (DeepSeek V4.1 Flash) e cai no OpenRouter (Gemma, DeepSeek V4 Flash)
- reenvia se a API do Telegram devolver 429

O volume Facebook → Telegram corre no Worker/KV. Não corras `003`/`004` no projecto Abilion — essas migrações pertencem ao recorte `001` que nunca existiu aqui. Conversas lista 80 e tem **Carregar mais** a partir dos leads hidratados. O poll da inbox pede as 400 conversas Telegram mais recentes; o hydrate e o reconcile de 30 s pedem até 5 páginas (2000).

Pixel da landing — botão **Pixel Ads** no Dashboard, no topo de Telegram e de Configurações → Bot Telegram (`#pixel`). O clique do Dashboard faz scroll até o snippet (`/telegram#pixel`). O snippet que se cola no anúncio é sempre o de produção, mesmo no painel local:

```html
<script src="https://www.abilion.lol/t.js?v=2" data-cta="[data-abilion-cta]"></script>
<a href="https://t.me/BOT?start=fb" data-abilion-cta>Falar no Telegram</a>
```

Manual de instalação (os mesmos 5 passos no painel, no comentário do `t.js`, no snippet que colas, em GET `/api/install` e no MCP `abilion_page_install_manual` / recurso `abilion://install`): [https://www.abilion.lol/api/install](https://www.abilion.lol/api/install). Outra landing / outro funil: cria um script em Telegram → Pixel, no funil (botão Script) ou `abilion_create_page_script` e cola `/t.js?v=2&s=ID`. O `/start` vira `fb_sID_vid` e a Sté fala o quadro daquele funil. Sem `s=`, usa o funil publicado. Teste: `/l?s=ID`. Leads: categorias no recorte e **Importar lista** (opção para o grupo Telegram). Criar categoria, script extra ou o primeiro funil com as definições unread e a lista oca não finge catálogo vazio — o painel e o MCP pedem confirmação. O Script no Fluxo usa o mesmo critério do pixel.

O script reescreve o `t.me/BOT?start=fb_{vid}` (ou `fb_sID_{vid}`) no `pointerdown`, no clique e no clique do meio. Se o construtor da página puser o script em `async`, o pixel ainda encontra o `/t.js` sem `currentScript`. Sem página própria, o anúncio aponta para [https://www.abilion.lol/l](https://www.abilion.lol/l). Em produção o Worker responde `/l` com HTML próprio (`t.js` + CTA) — não é a casca do SPA. O href sai `start=fb` ou `fb_sID`; o `t.js` mete o visitor no clique. O webhook fecha o evento `telegram` com o mesmo visitante.

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

- `/login` — entrada. Em produção o Worker manda o formulário no primeiro HTML (sem esperar o SPA). Victor e Gabriel no primeiro acesso; as outras contas vêm de Utilizadores. O POST `application/x-www-form-urlencoded` redirecciona; o JSON do painel continua igual.
- `/forgot` — localmente gera link de reset. Em produção não envia e-mail. O `next=` do login segue para forgot/reset e volta.
- `/reset?token=` — nova senha a partir do link local. Em produção o Worker manda o formulário no primeiro HTML (sem esperar o SPA). O POST `application/x-www-form-urlencoded` redirecciona para o login; o JSON do painel continua igual.
- `/privacidade` — política do CRM interno.
- `/l` — landing do anúncio: em produção o Worker manda HTML com `/t.js` e o CTA no primeiro byte (o Facebook não espera o SPA). O botão aponta para o username do Worker; o `t.js` reescreve `fb_{vid}`. Sem username, mostra empty state — não inventa um bot. Localmente o Vite ainda hidrata a mesma página em React.

Autenticadas:

- `/` — dashboard (leads, conversas, Facebook, espera, ofertas). Campanha Telegram/Facebook, espera, ofertas e temperatura hidratam pelo recorte — cache só de WhatsApp não finge Telegram zero.
- `/analytics` — funil Ads → landing → Telegram, globo, 30 dias.
- `/fluxo` — lista de funis. **Importar** lê JSON do ManyChat, n8n, Typebot, um funil Abilion ou uma lista de mensagens. O resultado fica rascunho. Novo funil / Importar com CRM unread e lista oca pedem confirmação. O botão Script de um quadro publicado não cria o primeiro script se as definições estiverem ocas.
- `/fluxo/funil/:id` — editor visual + runtime. Zoom/ajuste no canto superior direito; **Testar fluxo** no canto inferior direito — no telemóvel já não tapam um ao outro.
- `/leads` — CRM, captura, categorias, **Importar lista** (opcionalmente para o grupo). Contacto `ana` e `@ana` são o mesmo lead — import e MCP reusam o id do alias, não criam uma segunda ficha. Fechar a ficha grava o rascunho (onChange) e, se o React não ouviu, o texto visível — sem reverter a temperatura. Excluir só fecha a ficha se o Worker aceitar. Em lead com `telegramChatId` **ou** lista importada (WhatsApp / origem `import`) a ficha não avança print, espera nem oferta. Nota, temperatura e categoria ainda gravam. O tick da Sté / isolate não apaga a categoria. O POST `/api/leads` (`adoptOperatorLead`) recusa o mesmo avanço num chat real **e** num import. A busca `?q=` também casa a categoria. Com o índice KV oco, o painel e o MCP leem o Postgres em vez de fingir lista vazia. GET falho sem cache mostra “Não li os leads” em qualquer filtro — não “Nada neste recorte”. Criar “Nova categoria” com settings unread e catálogo oco mostra “Não confirmei as categorias” — não grava a primeira categoria por cima de um snapshot oco. **Nova captura** e **Importar lista** ficam bloqueados enquanto o GET dos leads não confirma; a captura também espera pelos funis se a lista estiver oca. O `POST /api/leads` e o MCP `abilion_import_leads` recusam o mesmo caso (índice oco + Postgres em baixo).
- `/conversas` — inbox Telegram da Sté. Os primeiros 80 vêm na lista; **Carregar mais** abre o resto hidratado. Sem conversas, “Simular conversa” corre o motor no painel — e fica bloqueado se os funis ainda não confirmaram. Leads com `telegramChatId` real não avançam a espera no browser e a caixa “Simular lead” fica fechada — simular ali gravaria falas que o Telegram nunca enviou. O cron é que manda o Telegram. Leads só do painel disparam a espera no `waitUntil` (setTimeout), não só quando o operador volta a escrever.
- `/telegram` — saúde do bot, webhook, snippet do pixel, simulação de /start. **Simular 100 /start** fica bloqueado se os leads ou os funis ainda não confirmaram — não grava 100 Facebook por cima de uma lista oca.
- `/utilizadores` — contas (dono cria / desliga / muda papel) e tokens MCP para Claude Code e outros agentes. Criar conta ou token com a lista por confirmar não finge equipa/token único — o formulário pede a leitura do Worker e o POST bem-sucedido volta a listar.
- `/configuracoes` — bot, conta, plugins, notificações, aparência.

Endereços desconhecidos no painel mostram 404. `next=` no login só aceita estas rotas.

## API do Worker

Todas as rotas `/api/*` (excepto `POST /api/track` e `POST /api/telegram`) exigem sessão ou token `abn_…`, salvo o que está abaixo.

| Rota | Quem |
| --- | --- |
| `GET /api/health` | público: `{ ok, telegramBotUsername }` e `telegramBotUnread` se as definições não confirmarem e o username estiver vazio. Não finge “bot desligado” |
| `POST /api/auth/login` | público, 8 tentativas / 15 min por IP |
| `POST /api/auth/logout` | sessão |
| `GET /api/auth/me` | sessão |
| `POST /api/auth/forgot` | público; em produção não devolve link |
| `POST /api/auth/reset` | token de reset |
| `POST /api/auth/password` | sessão |
| `GET/POST /api/crm` | sessão — funis e settings (sem token). POST aceita `removedFunnelIds`. GET une KV com o Postgres: um quadro no KV já não esconde os outros do backup. Se o KV está oco e o Postgres falha, GET é 503 — o painel não semeia por cima. Se os funis já estão no KV e o backup dos quadros falha, GET é 200 com `funnelsUnread` — o painel trata `crmSync` como erro, não como lista confirmada. Se só o backup das definições falha, GET é 200 com `settingsUnread`. A cópia Postgres dos funis não apaga ids se o upsert falhar, nem apaga um funil remoto só porque o KV tem outro — só tombstone. A cópia das definições e do lead faz merge com a linha remota e não grava à cega se o GET do backup falhar. O pixel não trata funil/script por ler como “não há” |
| `GET/POST/DELETE /api/leads` | sessão — GET pagina 400 (`nextCursor`, `stale` se o cursor sumiu) ou `?q=@user` no alias, no nome, no telefone e na categoria. A primeira página manda `removed` (tombstones) e `clipped` se o índice está no teto (8000 chats / 4000 sem chat) ou se o backup do Postgres devolveu uma página cheia. Com o KV oco o GET pagina o Postgres (keyset) em vez de fingir que 400 é o universo. Índice oco + Postgres em baixo é 503 (lista e `?q=`) — o painel mostra “Não li os leads”, não uma base vazia. Índice com entradas órfãs (sem `crm:lead`) também: 503 se o backup cair, `clipped` se vier vazio, ou as fichas do Postgres se existirem — nunca um `ok+[]` completo que apague o local. Página mista (fichas vivas + ids órfãos) preenche os buracos no Postgres e marca `clipped` se algum id ficar por resolver; Postgres em baixo nesta página é 200+clipped, não 503. Tombstone no índice não é buraco. Primeira página só com órfãos e mais páginas no índice mantém o cursor do KV — não troca o universo pelo top-N do Postgres. `clipped` em qualquer página impede o hydrate de fechar a lista. A busca `?q=` com miss no KV lê o Postgres (órfão / fora do índice); índice preenchido + backup em baixo é lista vazia, não 503. O hydrate pede até 40 páginas (16000). Página a meio vazia/stale **não** conta como lista; `clipped` ou teto de páginas é janela incompleta e **não** apaga leads locais |
| `GET /api/inbox` | sessão — página 400 do Telegram (`nextCursor`, `stale` se o cursor sumiu). A primeira página manda `removed` (tombstones), como o GET de leads. KV oco pagina o Postgres e marca `clipped` se a página estiver cheia; índice oco + Postgres em baixo é 503. O poll de 5 s aplica os tombstones e não reabre lead apagado noutro dispositivo |
| `GET/POST /api/runtime` | sessão — GET qualquer conta; POST só dono (token, IA, voz). GET junta o username/grupo das settings do KV e marca `settingsUnread` se o Postgres não confirmar. O Vincular mostra esse unread em vez de “Username vazio” |
| `POST /api/runtime/voice` | sessão, só dono — gera clips ElevenLabs |
| `POST /api/track` | público, CORS aberto só aqui (pixel) |
| `GET /api/track/summary` | sessão |
| `GET/POST/PATCH /api/users` | sessão — lista; POST/PATCH só dono (máx. 40 contas) |
| `GET/POST/DELETE /api/tokens` | sessão — token `abn_…` (o valor completo só no POST) |
| `POST /api/funnels/import` | sessão — ManyChat / n8n / Typebot / Abilion / mensagens. Funis unread (KV com quadro ou oco + Postgres em baixo) é 503 — o Fluxo desliga Importar e o MCP `abilion_import_funnel` já recusa |
| `POST /mcp` ou `/api/mcp` | Bearer ou cookie — JSON-RPC para agentes (60 / min por conta e IP). Settings, scripts, funis e import de leads usam o mesmo merge e a mesma cópia Postgres do painel. `abilion_list_funnels` com Postgres em baixo e quadros no KV devolve `unread` — não finge universo completo. `abilion_create_funnel` / `abilion_import_funnel` / `abilion_publish_funnel` e get em falta recusam com “Não confirmei os funis.” `abilion_list_leads` com `q=` usa a mesma busca do GET (KV, depois Postgres se o KV não tiver o nome). Sem `q=`, ids órfãos da página mista vêm do Postgres; se o backup falhar no meio da página a ferramenta marca `clipped` e não inventa lista vazia. `abilion_list_page_scripts` / `abilion_get_settings` / `abilion_delete_page_script` / `abilion_create_page_script` não fingem lista vazia nem script em falta se as definições estiverem unread; criar script com funil em falta e quadros unread pede confirmação dos funis, não “publica este funil”. `abilion_import_leads` com `toGroup` não marca grupo sem o URL se as definições estiverem unread; com `category` nova e catálogo oco unread também não grava a primeira categoria. Índice oco + Postgres em baixo também não importa nem aceita `POST /api/leads` — o mesmo 503 da lista. O formulário de criar script no pixel fica desligado enquanto a lista não confirma. `/Mcp` e `/Api/mcp` também |
| `GET /mcp` | público: `{ ok, name, version, install }`. `/Mcp` também |
| `GET /api/install` | público: manual do pixel + snippet (`?s=` para um script). Sem `s=` o JSON dos 5 passos continua mesmo se o Postgres das definições estiver unread. `?s=` com id de 8 hex e settings unread sem esse script no KV é 503 — não finge “script inexistente”. Se o script está no KV e os funis não confirmam, 503 no funil. MCP `abilion_page_install_manual` e `abilion://install/{id}` usam o mesmo critério |
| `POST /api/telegram` | Telegram; `secret_token` do webhook. `/start fb_sID_vid` com settings unread e o script só no Postgres não fala o funil publicado nem mint o lead nessa campanha — o update é libertado para o Telegram repetir. Update sem remetente (`my_chat_member`, mensagem sem `from`, saída do grupo) nem chega a reclamar o `update_id`. Se a Sté recusar o envio, o Worker esquece o id para o Telegram repetir |
| `GET /api/cron` | `CRON_SECRET` obrigatório; cada espera corre isolada. `remoteUnread` se o due do Postgres falhou; as esperas do KV avançam na mesma |
| `GET /t.js` | pixel. `/T.js` também. O Vite local manda a mesma rota ao Worker |
| `GET /l` | público: HTML da landing do anúncio (`t.js` + CTA + skip-link). `?s=` escolhe o script. `/L` e `/L/` também. O Vite local já não serve o SPA nestas rotas. Settings unread sem username não dizem “ainda não está ligado” — o pixel grava e o texto pede confirmação |
| `GET /login` | público: HTML do formulário com skip-link e Mostrar senha (`/auth.js`, sem script inline — o CSP é `script-src 'self'`). Com sessão, 303 para o `next` seguro. `/Login` também. `/Leads`, `/FLUXO` e o resto do painel em maiúsculas fazem 303 para a rota canónica — o React não mostra 404. O `next` do login também dobra `/Leads` → `/leads`. Sair, cookie apagado e um Link do SPA para `/login` `/forgot` `/reset` `/l` `/privacidade` fazem `location.replace` para este HTML — o painel já não fica no login React. Em local o Vite encaminha `/login`, `/forgot`, `/reset` e `/privacidade` (e as variantes em maiúsculas) para o mesmo HTML |
| `GET /forgot` | público: HTML do pedido de reset. `/Forgot` também |
| `GET /reset` | público: HTML da nova senha (`?token=`). Sem token mostra o empty state. `/Reset` também |
| `GET /privacidade` | público: HTML da política. `/Privacidade` também |

## MCP (Claude Code e outros agentes)

O Worker expõe JSON-RPC em `https://www.abilion.lol/mcp` (também `/api/mcp`). Em local o Vite encaminha `/mcp` para o mesmo handler. A sessão do painel ou um token `abn_…` (Utilizadores → Gerar token) autenticam. O proxy stdio do repositório reenvia o stdin:

```bash
export ABILION_URL=https://www.abilion.lol
export ABILION_TOKEN=abn_…
npm run mcp
```

No Claude Code / Claude Desktop, um exemplo está em [`mcp/claude.example.json`](mcp/claude.example.json):

```json
{
  "mcpServers": {
    "abilion": {
      "command": "npx",
      "args": ["tsx", "mcp/server.mts"],
      "env": {
        "ABILION_URL": "https://www.abilion.lol",
        "ABILION_TOKEN": "abn_…"
      }
    }
  }
}
```

Ferramentas: saúde, listar/criar/desligar contas, listar/criar/importar/publicar funis, listar leads, importar lista (`abilion_import_leads`, `toGroup` mete no grupo), definições (sem segredos), criar e revogar token (`abilion_revoke_token`), manual e scripts de página (`abilion_page_install_manual`, `abilion_create_page_script`, recurso `abilion://install`). Criar funil, script ou import de leads grava o KV e a mesma cópia no Postgres (sem `category` na linha do lead). O dono é que cria ou altera contas (`abilion_patch_user`). Importar um funil deixa-o em rascunho até `abilion_publish_funnel`. POST autenticado em `/mcp` tem limite de 60 pedidos / minuto por conta e IP. POST sem cookie nem Bearer não lê o snapshot de contas: 20 / minuto por IP, e o tecto do IP é 120 / minuto.

## Limitações e bloqueios

Estes itens dependem de credenciais ou de uma decisão humana. O código não inventa valores.

- **Telegram em produção** continua desligado até existir `TELEGRAM_BOT_TOKEN` (e, se quiseres fixar, `TELEGRAM_WEBHOOK_SECRET`). Sem isso não há /start reais. A landing `/l` também fica sem CTA até o username estar no Worker.
- **Voz da Sté** fica em texto até `ELEVENLABS_API_KEY` + `ELEVENLABS_VOICE_ID`. Não há `voice_id` inventado.
- **Esqueceu a senha?** em produção não envia e-mail. Troca em Configurações → Conta.
- **Supabase** só entra com `SUPABASE_SERVICE_ROLE`. Sem isso a operação corre no KV `abilion-auth`. O dump antigo está em `app_kv` — corre `006_lock_legacy_app_kv.sql` no SQL editor do projecto Abilion (`eyjgmkmaixmpmeeahxon`) para trancar anon/authenticated. Não é o projecto alecrim. `001`–`005` não criam as linhas do CRM.
- **Senhas dos operadores** não estão neste repositório. O primeiro acesso de cada e-mail (`victor@abilion.com` / `gabriel@abilion.com`) grava a senha no KV. Depois, só essa senha entra.
- Plugin **Agenda** e **webhooks de saída** são “Em breve” de propósito. Relatórios exporta CSV da base de leads (células `= + - @` saem como texto, para o Excel não as tratar como fórmula) só depois do GET confirmar — cache doutro canal ou GET falho não exporta como se fosse a base. Captura abre Leads. Telegram mostra o estado do Worker — sem interruptores que não fazem nada.
- **Notificações** na conta também são “Em breve”. O aviso da Ester no print só sai com o secret `ESTER_CHAT_ID` no Worker — um POST do CRM não define o chat. O botão Print no lead só marca o fluxo; o toast já não finge que a Ester foi avisada.
- **Primeiro login em produção** já não precisa de `ABILION_OPERATOR_PASSWORD`. Sem conta no KV, a senha digitada no formulário fica a da conta. O secret continua a ser um seed opcional — nunca reescreve um hash existente.
- `ESTER_CHAT_ID` só é preciso se a Ester receber aviso no Telegram. O campo não existe na UI. O POST `/api/crm` ignora `esterTelegramChatId` (o persist grava vazio) e o GET não o devolve.
- Links da Sté (markup e HTML do Telegram) recusam `javascript:` e URLs com userinfo, como o funil. Publicar um quadro com `javascript:` ou userinfo no `data.url` falha no painel e no POST `/api/crm` (400). O inspector marca o campo inválido. O persist ainda limpa o valor se alguém gravar só o rascunho.
- Gravar CRM ou leads com a rede em baixo devolve erro no banner — não rebenta a Promise no browser.
- Apagar um lead grava um tombstone no KV (`crm:removed`) e no `localStorage`. O webhook e o cron não voltam a puxar essa linha do Supabase. Sem `SUPABASE_SERVICE_ROLE` isto não muda nada. Se o DELETE falhar, o hydrate e o reconcile de 30 s voltam a pedir o DELETE enquanto o Worker ainda tiver a linha — o tombstone local não fica só a esconder o lead neste separador. Um POST `/api/leads` (ficha em voo, outro separador) com o mesmo id **não** limpa o tombstone nem volta a gravar a linha. O `upsertLeadKv` já não é undelete: se o id está em `crm:gone` / `crm:removed`, a escrita falha e o tombstone fica. O `saveLead` do Worker recusa id removido antes e depois do upsert, para um DELETE a meio do POST não gravar no Postgres. No painel, o DELETE espera o POST em voo e só depois pede o tombstone. Fechar a ficha depois de apagar já não volta a meter o lead na fila (`overlayPendingLeads` ignora o tombstone; `saveLead` do store também). O cron, se o id já estiver removido a meio do lote, **não** manda Telegram — `saveLead` false corta o envio.
- A lista antiga da Abilion (contactos em `app_kv`, workspace de 5 Set e o Telegram de 17 Set) volta para o KV `abilion-auth` com `scripts/restore-archived-leads.mts`. Import sem chat fica origem `import` (rótulo Importado, canal WhatsApp) — **não** “Privado /start”. `pagina` vira popup. A Sté **não** avança o quadro nestes contactos (só nota e temperatura). Nomes passam por `resolveLeadName`: MAIÚSCULAS/minúsculas viram título PT (`de`/`dos` ficam baixos); e-mail no facto ou “meu nome é…” nas falas do lead viram pessoa; telefone embutido no nome sai; se o “nome” era só o telefone e não há outra fonte, a ficha mostra o número formatado (`+55 11 98765-4321`) — **não** inventamos pessoa. O nome na ficha é editável. Um nome de pessoa no KV ganha de um nome-telefone mais novo no merge. O `/start` do Telegram reaparece com as falas. O dummy de QA (`Lead QA`) não entra. Sem `SUPABASE_SERVICE_ROLE` o Worker não lê essa tabela sozinho.
- O `upsertLeadKv` une o índice por id (`mergeIndexEntries`) e **repete o gravar** até o recorte incluir o lead (e o DELETE até o id sair). Dois `/start` ao mesmo tempo já não apagam o outro da lista nem da fila do cron. O índice do CRM mantém **todas** as esperas. Chats sem espera cortam em 8000 (os mais novos); simulação / captura / import sem chat corta em 4000. O contacto/chat fica num alias permanente — GET `?q=@user` e a busca de Leads/Conversas ainda encontram quem saiu do recorte. O GET pagina 400; o painel junta até 40 páginas (16000). Página a meio vazia/stale não reconcilia; bater no teto de páginas trata a janela como incompleta e não apaga o lead local que ficou de fora. O POST `/api/leads` continua a aceitar 120 de cada vez e devolve `saved` + `ids`; o flush só tira da fila esses ids (sem `ids`, só um `saved` igual ao lote inteiro conta) e manda o resto no pedido seguinte (no `pagehide` fica o primeiro lote). Simular 100 /start só mostra sucesso se o Worker gravou o lote todo. O Telegram não cria um lead novo só porque o recorte da lista encheu. Se o KV não tem o chat e o Postgres falha, o webhook **não** trata isso como miss nem inventa um segundo UUID — espera a próxima mensagem. A reserva do alias só corre depois desta confirmação, para um backup em baixo não deixar um id fantasma. Dois `/start` ao mesmo tempo no mesmo chat reivindicam o alias antes do UUID — o segundo reusa o id do primeiro. O CSV exporta a lista hidratada e avisa se bateu nos 8000. O `localStorage` só guarda os 2000 mais novos; o resto volta no GET.
- JSON inválido em `/api/crm`, `/api/leads`, `/api/runtime` e login devolve 400 — não grava objeto vazio.
- Vincular runtime (10 / 15 min) e gerar voz (5 / 15 min) têm limite por operador+IP. Gravar CRM (80 / min), leads (40 / min) e apagar lead (30 / min) também. URLs do funil só aceitam http(s). Chat id e aliases do KV são cortados para não rebentar a chave.
- O envio ao Telegram só conta sucesso com HTTP ok e `ok: true`. 429 e 5xx tentam de novo (até 3), inclusive no upload de voz. 400/403 ficam no log do Worker, sem token. O webhook só grava as falas da Sté depois do Telegram aceitar — se a primeira mensagem for recusada, o lead fica com o chat e o `/start` seguinte ainda pode mandar as boas-vindas. Se alguma fala (ou o áudio) já saiu e a seguinte falhar, o transcript grava-se na mesma: o Worker prefere perder o resto a reenviar o que o Telegram já aceitou. Se o `crm:lead` falhar depois do envio, o `crm:sent` fica no índice (`waitUntil` incluído) — o cron e o GET ainda vêem o lead. A recusa do Telegram (403) usa o mesmo persist com `crm:sent` e 4 tentativas — a fala do lead não depende de um único `saveLead`. O painel não trata GET ok como sync se ainda há POST pendente, nem POST ok se o GET falhou. Utilizadores não fica em “A carregar…” quando a lista falhou. A busca de Leads/Conversas (3+ letras) mostra “A procurar…” ou “Não consegui procurar” se o GET `?q=` falhar — não “Nada nesta busca”. `update_id` repetido não reprocessa: o claim grava um dono e o primeiro a escrever ganha, mesmo em dois webhooks ao mesmo tempo. Esquecer um `update_id` (envio falhou de ponta a ponta) une o KV antes de gravar — não apaga o claim de outro update. O cron continua a gravar a espera antes de mandar — prefere falhar uma vez a mandar duas. Se o Telegram recusar, a espera/fase voltam sem `replace` no KV: falas do lead que chegaram a meio ficam; as bolhas da Sté que não saíram saem. Sem `TELEGRAM_BOT_TOKEN`, o cron **não** avança espera de lead com `telegramChatId`: espera o token em vez de comer o follow-up. Leads só do painel (sem chat) continuam a avançar. Oferta e `send_message` do quadro saem no mesmo HTML da Sté (não em markdown cru). O pixel recusa corpo > 8 kb (413) e JSON inválido (400). Só reescreve deep link de bot (`t.me/user?start=`) — convites `t.me/+` e `joinchat` ficam. O balde `track:throttles` une as chaves no gravar — um POST do CRM não apaga o limite do pixel de outro IP. Dois POST `/api/track` ao mesmo tempo unem por id (`mergeTrackEvents`) e o gravar repete até os dois eventos ficarem — um page view não apaga o clique do outro visitante.
- Dashboard (número grande de capturas), Telegram (joins / Facebook hoje), Conversas (faixa do funil e chips de filtro) e os contadores dos filtros de Leads mostram "…" enquanto o Worker ainda não hidratou. Conversas, o KPI Conversas do Dashboard, as linhas Campanha Telegram/Facebook, espera, ofertas e temperatura, joins/Facebook hoje, o passo “Chat iniciado” do Analytics e cada filtro de Leads hidratam pelo recorte certo — cache só de WhatsApp não finge Telegram vazio; inbox com erro e zero naquele recorte é “…” / “Não li”. Não tratam zero como lista vazia.
- Gravar um lead mais novo com memória, factos ou mensagens vazias não apaga o que já estava no KV. Um POST com chat incompleto (gaveta aberta, clique de temperatura) une as falas por id — não substitui o array. Um webhook mais antigo ainda consegue acrescentar a fala nova sem reverter temperatura ou nota. Se o Telegram chegar depois com `updatedAt` mais novo, a fala entra e a temperatura/print/nome do operador ficam. O `saveLead` do painel faz o mesmo merge antes de pintar, para o clique na gaveta não esconder o chat até ao próximo poll.
- Espera do quadro com `delayHours` inválido (`NaN`, negativo) cai nas 84h e o persist do funil já não guarda `NaN`. O inspector também recusa o valor.
- O lock do cron (`claimCronLock`) relê até 16 vezes, como o índice: se o verify vier vazio tenta outra vez; se outro dono já estiver lá, desiste. Renova-se em cada lead. Se o TTL de 90s acabar a meio de um lote, o dono estende; um cron sobreposto não pega o mesmo lote. Antes de avançar, o cron relê o lead no KV (`pickLiveDueLead`): se outro passe já comeu a espera, esta cópia sai sem mandar Telegram outra vez. Espera no índice sem `crm:lead` (e sem tombstone) preenche pelo id no Postgres — `wait_until` null na linha ainda avança se o índice diz que venceu. Postgres em baixo no due **não** come as esperas do KV: o cron avança o que já estava no índice e o JSON marca `remoteUnread`. O filtro `wait_until` cita o timestamp (`lte."…"`).
- Em Conversas, mudar o filtro já não abre o chat de outra pessoa. A conversa escolhida que sair do recorte mostra o estado vazio. **Carregar mais** junta os próximos 80 do recorte hidratado — a busca já corre na lista toda. A espera simulada dispara no lead actual, não num snapshot anterior à última fala.
- A ficha do lead com chat real **ou** lista importada (WhatsApp / origem `import`) não dispara print/espera/oferta no browser. O POST `/api/leads` só aceita nota, nome e temperatura nesses leads (`adoptOperatorLead`). O cron **não** avança espera de import, mesmo com token. O quadro do Telegram continua com o webhook e o cron.
- `webhookOk` e `webhookUrl` só o Worker escreve depois do `setWebhook`. O cliente não marca o webhook como activo. Username/grupo vazios no POST `/api/runtime` não apagam o que já estava. O `saveSecrets` relê o KV e une (`commitSecrets`) — Vincular o token e gravar o username ao mesmo tempo já não fica só com um dos dois.
- O POST `/api/crm` das settings une o snapshot lido com o KV no persist (`commitStoredSettings`). Um autosave com username vazio **não** apaga o `@bot` que o Vincular acabou de gravar. Plugin Telegram ligado no KV também não volta a `false` nesse flush.
- `openaiBaseUrl` do POST `/api/runtime` é ignorado. A IA só fala com OpenCode, OpenRouter ou `OPENAI_BASE_URL` do Worker.
- O `saveLead` une o snapshot lido no início, grava o merge e só depois relê o KV (`commitStoredLead`). Dois `get` seguidos já não fingem corrida. O lock do cron (`crm:cron-lock`) grava um dono, confirma a escrita e volta a ler; um release alheio não solta o lock.
- Eventos do lead no Supabase unem-se aos do KV por id (não só quando o KV está vazio). A leitura vai em blocos de 50 ids.
- Apagar lead/funil nesta sessão fica no `localStorage`. Outro separador some o cartão sem esperar refresh. A lista de leads reconcilia com o Worker a cada 30 s.
- O Worker impõe um só funil `active`+`production` ao gravar. Tombstone de funil também fica no KV. Um POST `active`+`production` novo tem de passar no `validatePublish` (400 com a primeira falha). O mesmo `publishedAt` já gravado não é recusado se as regras apertarem — o Worker conserva o snapshot válido. Tombstone só se grava depois do POST ser aceite: recusar “ficar sem funil” ou um quadro inválido não esconde o que já estava no KV.
- O GET do CRM aplica tombstones locais (`hydrateFunnels`). Apagar um funil antes do hydrate não o ressuscita; o flush seguinte sobe o tombstone. `saveFunnel` de um id tombstoned não volta a meter o quadro na lista (o editor aberto noutro separador já não ressuscita o apagado). Settings sujos nesta sessão (e no `localStorage`) não são pisados pelo GET nem pelo runtime — um refresh a meio do debounce não devolve o username/grupo velho. O formulário do Bot sincroniza username/grupo/modelo depois do hydrate, sem pisar o que o operador está a escrever. A landing `/l` volta a ler o health a cada 15 s se o Worker falhar. Publicar espera o POST: se o Worker recusar, o painel devolve o `production` anterior e mostra o erro. Publicar e salvar rascunho partilham um lock — o segundo clique não manda outro POST. Gravar um funil já existente também fica pendente até o hydrate, para o publish antes do GET não se perder. Captura, lote Telegram, simular conversa, criar/renomear/apagar funil, rascunho e avanços da ficha só mostram sucesso depois do Worker aceitar. `flushCrmNow` e o apagar funil não repetem o toast genérico do store — a página diz o erro. O autosave (debounce) continua a avisar se o Worker recusar. A captura solta o lock no `finally`. Simular fala na inbox mostra erro se o POST dos leads falhar. O store escreve `stateRef` e a fila de leads no mesmo instante — o flush imediato já vê o quadro novo, não o estado do render anterior. Funis e leads ainda por gravar ficam no `localStorage`; um refresh não os apaga do hydrate e o flush corre depois do GET. Um `/api/auth/me` sem rede já não limpa a sessão local. Um 401 no `/me` (se o contrato mudar) também expira — hoje o Worker devolve 200 com `user: null`. Sair espera o flush. Fechar a ficha ou mandar fala na simulação também.
- Vincular o Telegram com token válido mas webhook recusado (rede, 5xx, Bad Request) grava o token e devolve 200 com `warning`. Token `Unauthorized` continua 400 e não pisa o que já estava. O operador não precisa de colar o token outra vez para tentar de novo. Gravar só a chave da IA já não finge “Username gravado”.
- A inbox de 5 s e o reconcile de 30 s passam por `overlayPendingLeads`: a ficha a meio do debounce não perde nota nem temperatura, e a fala nova do Telegram ainda entra. Sem fila, o overlay ainda aplica o tombstone — um GET da inbox não ressuscita o lead apagado. O hydrate e o reconcile de 30 s pedem leads e inbox no mesmo `Promise.all` e passam os dois a `hydrateLeads` — um GET `ok+[]` já não apaga as conversas que a inbox acabou de trazer. Captura e lote usam a mesma fila de flush. Nó sem `id` no POST do CRM é ignorado (já não é 500). Quadro em `/fluxo/funil/:id` com CRM em erro já não finge 404.
- `reconcileFunnels` já não apaga um quadro só porque o POST o omitiu. Um separador velho que grava A+B não remove o C criado noutro. Apagar exige tombstone (`removedFunnelIds`). O painel ainda não faz POST `/api/crm` até o GET hidratar, para o seed local não criar um quadro a mais. Seed só sobe quando o GET veio vazio. Os POSTs do CRM no painel vão à vez: criar funil + autosave + publicar já não se atropelam. Um POST que correu com o snapshot velho **não** limpa tombstones nem a fila de funis/settings gravados a meio do pedido — o flush seguinte sobe o que ficou. No Worker, o persist volta a ler o KV antes de gravar (`commitCrmFunnels`): um POST atrasado não ressuscita o funil que outro pedido já tombstonou. O flush dos leads também vai à vez: simular conversa + o tick da Sté já não mandam dois POSTs em paralelo. O upsert relê o KV (`commitStoredLead`) para um POST velho não apagar a fala ou a nota mais nova.
- Dashboard, Analytics e Conversas mostram "—" / "…" no pixel quando a leitura ainda não veio ou falhou. Um 401 no `/api/track/summary` **não** chama `noteUnauthorized` — o poll de 4–8 s não desloga. O funil Facebook e o split do ads usam o mesmo `pixelFigure` dos KPIs: "…" a carregar, "—" se a API falhou sem leitura anterior. As setas de conversão do funil usam `pixelDropFigure` — também "…" a carregar, não "—". Dashboard e Telegram só escondem os números de leads com "…" quando o GET ainda não veio **e** a lista local está vazia; cache no `localStorage` já conta. Conversas usa conversas Telegram com fala — cache só de WhatsApp não finge inbox vazia. Não tratam zero como dado real. Funis, leads e conversas mostram “A carregar…” enquanto o Worker ainda não respondeu — não fingem lista vazia. Vincular o bot não grava settings ocas se o GET falhou.
- `safeAppPath` só aceita rotas exactas do painel (e `/fluxo/funil/:id`). `/configuracoesfoo` não redirecciona para Configurações. `/privacidade` no `next=` do login é aceite. `withSafeNext` leva esse `next` no Esqueceu a senha / reset e no redirect do AppShell (404 não vira `next`). Já autenticado em `/login?next=` vai para o destino, não para a home. O skip-link aponta para `main#conteudo` (login, landing, privacidade e o painel). Conversas no telemóvel faz scroll da página; no desktop os painéis é que rolam. No `pagehide`, o quadro grava no capture antes do flush; o flush usa `keepalive` se o corpo tiver ≤ 60 kb — acima disso o browser corta o beacon; o pending no `localStorage` sobe no próximo login. O snippet do ads (`#pixel`) é sempre `https://www.abilion.lol/t.js?v=2`, nunca o origin local. A `/l` carrega o mesmo `?v=2`. Vincular Telegram manda também a chave/voice id da ElevenLabs se estiverem preenchidos. `/telegram#pixel` e `/configuracoes#pixel` fazem scroll até o snippet (e Configurações abre o tab Bot).
- Os fetches do painel (`/me`, CRM, leads, inbox, runtime, health, analytics) têm timeout de 12 s. Um `/me` pendurado já não deixa o login em “A carregar…” para sempre — timeout conta como falha de rede e **não** desloga. CRM/leads pendurados passam a `error` (banner), não ficam em “A carregar…” com `idle`. O hydrate continua a bloquear o flush do seed (`canFlushCrm`) até haver GET aceite. Se o GET do CRM falhar, o painel tenta outra vez a cada 8 s e ao focar a janela — o banner “Tentar outra vez” força o mesmo GET e também a inbox (em paralelo, sem prender o quadro). Dashboard e Analytics voltam a ler o pixel no mesmo clique. Telegram volta a ler health/runtime. Quando o GET do CRM passa, o flush que estava em `queued` sobe. A página Telegram também relê health/runtime a cada 15 s.
- `/t.js` passa pelos mesmos headers de segurança do Worker (HSTS, CSP, `X-Frame-Options`). O CORS aberto fica só no pixel.
- A ficha do lead fecha pelo botão, por Escape e pelo fundo (controlo com nome acessível). Com `prefers-reduced-motion`, animações e transições do estúdio param.

## Auditoria

```bash
npm run typecheck
npm run lint
npm test
npm run build
npx tsx scripts/ui-audit.mts
```

`scripts/ui-audit.mts` percorre login (incluindo `/Login` e o formulário do Worker), `/L` com `t.js` no primeiro HTML, rotas do painel, 404, funil inexistente, skip-link, teclado das tabs, captura, Utilizadores (mostrar senha inicial), Sair e cookie apagado → formulário do Worker, logout → forgot/reset e as larguras 320 / 375 / 768 / 1024 / 1440. Precisa do `npm run dev` em `http://127.0.0.1:43173`. O 404 interno espera o texto (não lê o body no primeiro paint).

`scripts/ste-flow.mts` cobre o webhook assinado (`/start fb`, segundo `/start` sem spam, fala do lead, join no grupo), recusa do Telegram que não grava boas-vindas mas guarda a fala do lead, envio parcial que já entregou uma fala (grava transcript e não reenvia), `update_id` repetido (incluindo dois claims ao mesmo tempo, verify vazio que retenta, forget que não apaga outro id, e update sem remetente que não ocupa o anel), inbox autenticada, runtime sem vazar o token, DELETE do lead, POST depois do DELETE que não ressuscita o lead nem limpa o tombstone, pending tombstoned que não volta à inbox, cron com duas esperas, cron que não come espera de chat real sem token, cron que não avança import, cron que manda oferta/`send_message` em HTML, recusa de JSON enorme (413) inclusive no pixel, hydrate que não ressuscita lead/funil apagado, tombstone de funil e de lead (KV ganha do Supabase no webhook e no cron), a regra de que simulação/lote não inventam `telegramChatId` e que lead com chat real **ou** import WhatsApp não simula no painel, o pixel que não finge zero quando a leitura falha e que não reescreve convite de grupo, o envio Telegram que não trata 403 como sucesso, o lock do cron com dono e renovação, a união de eventos e de falas do lead (POST incompleto e webhook atrasado), a corrida login/troca de senha, o desligar de conta e o token MCP revogado que não voltam no merge do KV, o POST MCP sem token que bloqueia à 21ª, o lock do cron que retenta o verify, o cron que relê a espera antes de avançar, o forgot/reset de conta desligada, a janela incompleta de leads que não apaga o local e o tombstone de auth que não larga a sessão ainda viva, a memória que sobrevive a um POST mais novo vazio, o HSTS do `/t.js`, links da Sté sem userinfo, settings sem chat da Ester, CSV sem fórmula, endpoint da IA só no Worker, os limites de escrita do CRM/leads, o balde de throttle que une chaves em escrita concorrente e a mesma chave no mesmo instante só deixa passar o limite, a espera `NaN` que não derruba o runtime, o seed local que não pode gravar o CRM antes do hydrate, o hydrate que aplica tombstone de funil, o reconcile que não apaga o quadro omitido sem tombstone, o POST do CRM que recusa um `production` vazio novo sem tombstonear o quadro que já estava, o alias do Telegram que não cria dois leads no mesmo chat, o webhook que não mint quando o Postgres falha e reusa o id do backup quando o KV está oco, o skip-link no HTML do Worker e o Vite que manda /Login /L /T.js ao mesmo handler, e a ficha/POST que não avançam o quadro de um chat real **nem** de um import, o publicar que reverte se o Worker recusar, o POST `/api/runtime` que guarda o token quando o webhook falha sem ser Unauthorized, o rascunho mais novo que volta à fila de flush depois do hydrate, a inbox que não pisa a ficha ainda por gravar, o hydrate de settings que não pisa username/grupo ainda por gravar, o `next=/privacidade` do login, o POST velho do CRM que não ressuscita funil já tombstonado, a fila de funis/settings que sobrevive a um flush a meio da edição, o POST velho do lead que não apaga a fala do tick, e o hydrate da inbox que une sem wipe quando o GET dos leads falhou.

```bash
npx tsx scripts/ui-audit.mts
AUDIT_URL=https://www.abilion.lol AUDIT_PUBLIC=1 npx tsx scripts/ui-audit.mts
```

`AUDIT_PUBLIC=1` só cobre páginas públicas (a senha de produção dos operadores não está no repositório).
