# AbilionDev

Fluxo de operação da Abilion: o canvas publicado **é o runtime** (Typebot / ManyChat). O canal é **só Telegram**. Sté é o agente no 1:1. Banca ninguém inventa.

## O que entra

- Login real: `victor@abilion.com` ou `gabriel@abilion.com`. O primeiro acesso de cada conta define a senha (6+ caracteres).
- Dashboard: leads, conversas, página / cliques, Facebook, espera, ofertas
- Analytics: funil Ads → landing → Telegram → chat, globo de visitantes, gráficos de 30 dias, geo e device — no mesmo estúdio claro do funil
- Leads no passo do fluxo (print, banca, espera, oferta só se o grafo deixar)
- Conversas Telegram: a Sté segue o funil publicado (boas-vindas, minicurso, Superbet, App/Premium, remarketing). A voz muda conforme o que o lead falou; o passo, os links e a próxima fase não mudam. Sem inbox, “Simular conversa” cria um lead Facebook a meio do funil (não o encerrado do lote). A caixa “Simular lead” corre o motor no painel — não envia Telegram. A IA começa no OpenCode (DeepSeek V4.1 Flash). Se falhar, cai no OpenRouter: Gemma 4 31B e depois DeepSeek V4 Flash. Sem chave, a voz local ainda reconhece o lead.
- Áudio: mensagens grandes do funil saem como áudio da ElevenLabs. Cada clip é gerado uma vez, guardado e reutilizado. Os links continuam no texto.
- Funil com mapa e fluxo executável, no estúdio visual claro (catálogo, quadro e propriedades). O rascunho grava sozinho e também ao sair (Voltar / fechar o separador). Publicar um funil torna-o o único quadro activo — a Sté segue o `publishedAt` mais recente. No telemóvel, toca num bloco da paleta para o adicionar. O último funil publicado não se apaga.
- Telegram: webhook no Worker (`/api/telegram`) — /start abre a Sté
- Facebook → Telegram: `https://t.me/BOT?start=fb` (500–1000 /start por dia)
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
- Correr [`supabase/migrations/001_flow.sql`](supabase/migrations/001_flow.sql), [`002_ste_chat.sql`](supabase/migrations/002_ste_chat.sql), [`003_facebook_scale.sql`](supabase/migrations/003_facebook_scale.sql), [`004_track_and_facts.sql`](supabase/migrations/004_track_and_facts.sql) e [`005_worker_only_rls.sql`](supabase/migrations/005_worker_only_rls.sql) no SQL editor
- Service role só no Worker. Não há chave anónima no browser. O `005` tira as policies abertas do recorte antigo — sem isso, quem tiver a chave anon ainda lê o workspace `local`.

## Produção

URL no ar: [https://www.abilion.lol](https://www.abilion.lol) (apex [https://abilion.lol](https://abilion.lol) e [https://abilion.vsanches1060.workers.dev](https://abilion.vsanches1060.workers.dev)).

O Worker `abilion` (conta `73dd2cecfc9c7f0220a36fe999e3edf1`) serve o painel e `/api/*`. O CRM Next antigo saiu do ar. `run_worker_first` faz o HTML (`/` incluído) passar pelo Worker para levar CSP, `X-Frame-Options` e o resto dos headers — o pipeline de assets sozinho não os punha na home.

Login: só `victor@abilion.com` ou `gabriel@abilion.com`. O primeiro acesso de cada conta grava a senha no KV `abilion-auth`. Depois, só essa senha entra. Login, “Esqueceu a senha?” e troca de senha têm limite por IP (8, 5 e 5 tentativas / 15 min). Cada operador fica com no máximo 5 sessões activas. O snapshot de auth no KV une sessões no gravar — dois logins ao mesmo tempo já não apagam um ao outro. Uma troca de senha marca `passwordUpdatedAt`: um login que ainda tinha o hash velho não reverte a senha nem reabre sessões antigas. Logout e troca de senha gravam tombstone do token (até 2000). Token do Telegram e chaves de IA **não** entram no git — Configurações → Vincular Telegram grava no mesmo KV e aponta o webhook. Troca de senha: Configurações → Conta. “Esqueceu a senha?” só devolve link fora de produção (não há e-mail). Leads: busca por nome/@user, exclusão com confirmação e hidratação até 400 no login. Simular 100 /start pede confirmação.

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

Ao vincular o Telegram, o Worker gera um `secret_token` do webhook e guarda-o no KV. `POST /api/telegram` sem esse secret (ou com o header errado) responde 401 — não aceita updates assinados. `GET /api/cron` só corre com `CRON_SECRET`. Sem cookie, `/api/crm`, `/api/inbox`, `/api/leads` e `/api/track/summary` respondem 401. O painel trata isso como sessão expirada e volta ao login. Analytics com 401 mostra “Sem leitura”, não um gráfico vazio verde. Sem rede, um aviso no topo deixa claro que a sincronização espera. O primeiro login de `victor@abilion.com` ou `gabriel@abilion.com` define a senha (6+), também em produção. `ABILION_OPERATOR_PASSWORD` é opcional e só cria contas que ainda não existem.

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
- abre a Sté com o motor determinístico; o papo livre da oferta usa OpenCode (DeepSeek V4.1 Flash) e cai no OpenRouter (Gemma, DeepSeek V4 Flash)
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
- `/leads` — CRM, captura, print/banca. Em lead com `telegramChatId` a ficha não avança print, espera nem oferta — isso corre no Telegram. Nota e temperatura ainda gravam. O POST `/api/leads` recusa o mesmo avanço.
- `/conversas` — inbox Telegram da Sté (máx. 80). Sem conversas, “Simular conversa” corre o motor no painel. Leads com `telegramChatId` real não avançam a espera no browser e a caixa “Simular lead” fica fechada — simular ali gravaria falas que o Telegram nunca enviou. O cron é que manda o Telegram.
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
| `GET/POST /api/crm` | sessão — funis e settings (sem token). POST aceita `removedFunnelIds`; o KV ganha se já houver quadro |
| `GET/POST/DELETE /api/leads` | sessão — lista até 400. O hydrate trata o GET como lista completa |
| `GET /api/inbox` | sessão — recorte de 80 do Telegram. O poll não reabre lead apagado nesta sessão |
| `GET/POST /api/runtime` | sessão — Telegram, IA, voz |
| `POST /api/runtime/voice` | sessão — gera clips ElevenLabs |
| `POST /api/track` | público, CORS aberto só aqui (pixel) |
| `GET /api/track/summary` | sessão |
| `POST /api/telegram` | Telegram; `secret_token` do webhook |
| `GET /api/cron` | `CRON_SECRET` obrigatório; cada espera corre isolada |
| `GET /t.js` | pixel |

## Limitações e bloqueios

Estes itens dependem de credenciais ou de uma decisão humana. O código não inventa valores.

- **Telegram em produção** continua desligado até existir `TELEGRAM_BOT_TOKEN` (e, se quiseres fixar, `TELEGRAM_WEBHOOK_SECRET`). Sem isso não há /start reais. A landing `/l` também fica sem CTA até o username estar no Worker.
- **Voz da Sté** fica em texto até `ELEVENLABS_API_KEY` + `ELEVENLABS_VOICE_ID`. Não há `voice_id` inventado.
- **Esqueceu a senha?** em produção não envia e-mail. Troca em Configurações → Conta.
- **Supabase** só entra com `SUPABASE_SERVICE_ROLE`. Sem isso a operação corre no KV `abilion-auth`. Corre `005_worker_only_rls.sql` no SQL editor do projecto Abilion (`eyjgmkmaixmpmeeahxon`) para fechar as policies anónimas. Não é o projecto alecrim.
- **Senhas dos operadores** não estão neste repositório. O primeiro acesso de cada e-mail (`victor@abilion.com` / `gabriel@abilion.com`) grava a senha no KV. Depois, só essa senha entra.
- Plugin **Agenda** e **webhooks de saída** são “Em breve” de propósito. Relatórios exporta CSV da base de leads (células `= + - @` saem como texto, para o Excel não as tratar como fórmula). Captura abre Leads. Telegram mostra o estado do Worker — sem interruptores que não fazem nada.
- **Notificações** na conta também são “Em breve”. O aviso da Ester no print só sai com o secret `ESTER_CHAT_ID` no Worker — um POST do CRM não define o chat. O botão Print no lead só marca o fluxo; o toast já não finge que a Ester foi avisada.
- **Primeiro login em produção** já não precisa de `ABILION_OPERATOR_PASSWORD`. Sem conta no KV, a senha digitada no formulário fica a da conta. O secret continua a ser um seed opcional — nunca reescreve um hash existente.
- `ESTER_CHAT_ID` só é preciso se a Ester receber aviso no Telegram. O campo não existe na UI. O POST `/api/crm` ignora `esterTelegramChatId` (o persist grava vazio) e o GET não o devolve.
- Links da Sté (markup e HTML do Telegram) recusam `javascript:` e URLs com userinfo, como o funil. Publicar um quadro com `javascript:` ou userinfo no `data.url` falha no painel e no POST `/api/crm` (400). O inspector marca o campo inválido. O persist ainda limpa o valor se alguém gravar só o rascunho.
- Gravar CRM ou leads com a rede em baixo devolve erro no banner — não rebenta a Promise no browser.
- Apagar um lead grava um tombstone no KV (`crm:removed`) e no `localStorage`. O webhook e o cron não voltam a puxar essa linha do Supabase. Sem `SUPABASE_SERVICE_ROLE` isto não muda nada. Se o DELETE falhar, o hydrate e o reconcile de 30 s voltam a pedir o DELETE enquanto o Worker ainda tiver a linha — o tombstone local não fica só a esconder o lead neste separador. Um POST `/api/leads` (ficha em voo, outro separador) com o mesmo id **não** limpa o tombstone nem volta a gravar a linha. O `saveLead` do Worker recusa id removido. No painel, o DELETE espera o POST em voo e só depois pede o tombstone. Fechar a ficha depois de apagar já não volta a meter o lead na fila (`overlayPendingLeads` ignora o tombstone; `saveLead` do store também). O cron, se o id já estiver removido a meio do lote, **não** manda Telegram — `saveLead` false corta o envio.
- O índice do CRM lista 400 leads; o contacto/chat fica num alias permanente e as esperas não saem do índice. O Telegram não cria um lead novo só porque o recorte da lista encheu. Dois `/start` ao mesmo tempo no mesmo chat reivindicam o alias antes do UUID — o segundo reusa o id do primeiro.
- JSON inválido em `/api/crm`, `/api/leads`, `/api/runtime` e login devolve 400 — não grava objeto vazio.
- Vincular runtime (10 / 15 min) e gerar voz (5 / 15 min) têm limite por operador+IP. Gravar CRM (80 / min), leads (40 / min) e apagar lead (30 / min) também. URLs do funil só aceitam http(s). Chat id e aliases do KV são cortados para não rebentar a chave.
- O envio ao Telegram só conta sucesso com HTTP ok e `ok: true`. 429 e 5xx tentam de novo (até 3), inclusive no upload de voz. 400/403 ficam no log do Worker, sem token. O webhook só grava as falas da Sté depois do Telegram aceitar — se a primeira mensagem for recusada, o lead fica com o chat e o `/start` seguinte ainda pode mandar as boas-vindas. Se alguma fala (ou o áudio) já saiu e a seguinte falhar, o transcript grava-se na mesma: o Worker prefere perder o resto a reenviar o que o Telegram já aceitou. `update_id` repetido não reprocessa: o claim grava um dono e o primeiro a escrever ganha, mesmo em dois webhooks ao mesmo tempo. Esquecer um `update_id` (envio falhou de ponta a ponta) une o KV antes de gravar — não apaga o claim de outro update. O cron continua a gravar a espera antes de mandar — prefere falhar uma vez a mandar duas. Sem `TELEGRAM_BOT_TOKEN`, o cron **não** avança espera de lead com `telegramChatId`: espera o token em vez de comer o follow-up. Leads só do painel (sem chat) continuam a avançar. Oferta e `send_message` do quadro saem no mesmo HTML da Sté (não em markdown cru). O pixel recusa corpo > 8 kb (413) e JSON inválido (400). Só reescreve deep link de bot (`t.me/user?start=`) — convites `t.me/+` e `joinchat` ficam. O balde `track:throttles` une as chaves no gravar — um POST do CRM não apaga o limite do pixel de outro IP.
- Dashboard (número grande de capturas), Telegram (joins / Facebook hoje), Conversas (faixa do funil e chips de filtro) e os contadores dos filtros de Leads mostram "…" enquanto o Worker ainda não hidratou. O passo “Chat iniciado” do Analytics também. Não tratam zero como lista vazia.
- Gravar um lead mais novo com memória, factos ou mensagens vazias não apaga o que já estava no KV. Um POST com chat incompleto (gaveta aberta, clique de temperatura) une as falas por id — não substitui o array. Um webhook mais antigo ainda consegue acrescentar a fala nova sem reverter temperatura ou nota. Se o Telegram chegar depois com `updatedAt` mais novo, a fala entra e a temperatura/print/nome do operador ficam. O `saveLead` do painel faz o mesmo merge antes de pintar, para o clique na gaveta não esconder o chat até ao próximo poll.
- Espera do quadro com `delayHours` inválido (`NaN`, negativo) cai nas 84h e o persist do funil já não guarda `NaN`. O inspector também recusa o valor.
- O lock do cron renova-se em cada lead. Se o TTL de 90s acabar a meio de um lote, o dono estende; um cron sobreposto não pega o mesmo lote.
- Em Conversas, mudar o filtro já não abre o chat de outra pessoa. A conversa escolhida que sair do recorte mostra o estado vazio.
- A ficha do lead com chat real não dispara print/espera/oferta no browser. O POST `/api/leads` só aceita nota, nome e temperatura nesses leads — o quadro continua com o webhook e o cron.
- `webhookOk` e `webhookUrl` só o Worker escreve depois do `setWebhook`. O cliente não marca o webhook como activo.
- `openaiBaseUrl` do POST `/api/runtime` é ignorado. A IA só fala com OpenCode, OpenRouter ou `OPENAI_BASE_URL` do Worker.
- O lock do cron (`crm:cron-lock`) grava um dono e confirma a escrita. Um release alheio não solta o lock.
- Eventos do lead no Supabase unem-se aos do KV por id (não só quando o KV está vazio). A leitura vai em blocos de 50 ids.
- Apagar lead/funil nesta sessão fica no `localStorage`. Outro separador some o cartão sem esperar refresh. A lista de leads reconcilia com o Worker a cada 30 s.
- O Worker impõe um só funil `active`+`production` ao gravar. Tombstone de funil também fica no KV. Um POST `active`+`production` novo tem de passar no `validatePublish` (400 com a primeira falha). O mesmo `publishedAt` já gravado não é recusado se as regras apertarem — o Worker conserva o snapshot válido. Tombstone só se grava depois do POST ser aceite: recusar “ficar sem funil” ou um quadro inválido não esconde o que já estava no KV.
- O GET do CRM aplica tombstones locais (`hydrateFunnels`). Apagar um funil antes do hydrate não o ressuscita; o flush seguinte sobe o tombstone. `saveFunnel` de um id tombstoned não volta a meter o quadro na lista (o editor aberto noutro separador já não ressuscita o apagado). Settings sujos nesta sessão (e no `localStorage`) não são pisados pelo GET nem pelo runtime — um refresh a meio do debounce não devolve o username/grupo velho. O formulário do Bot sincroniza username/grupo depois do hydrate, sem pisar o que o operador está a escrever. A landing `/l` volta a ler o health a cada 15 s se o Worker falhar. Publicar espera o POST: se o Worker recusar, o painel devolve o `production` anterior e mostra o erro. Publicar e salvar rascunho partilham um lock — o segundo clique não manda outro POST. Gravar um funil já existente também fica pendente até o hydrate, para o publish antes do GET não se perder. Captura, lote Telegram, simular conversa, criar/renomear/apagar funil, rascunho e avanços da ficha só mostram sucesso depois do Worker aceitar. `flushCrmNow` e o apagar funil não repetem o toast genérico do store — a página diz o erro. O autosave (debounce) continua a avisar se o Worker recusar. A captura solta o lock no `finally`. Simular fala na inbox mostra erro se o POST dos leads falhar. O store escreve `stateRef` e a fila de leads no mesmo instante — o flush imediato já vê o quadro novo, não o estado do render anterior. Funis e leads ainda por gravar ficam no `localStorage`; um refresh não os apaga do hydrate e o flush corre depois do GET. Um `/api/auth/me` sem rede já não limpa a sessão local. Um 401 no `/me` (se o contrato mudar) também expira — hoje o Worker devolve 200 com `user: null`. Sair espera o flush. Fechar a ficha ou mandar fala na simulação também.
- Vincular o Telegram com token válido mas webhook recusado (rede, 5xx, Bad Request) grava o token e devolve 200 com `warning`. Token `Unauthorized` continua 400 e não pisa o que já estava. O operador não precisa de colar o token outra vez para tentar de novo. Gravar só a chave da IA já não finge “Username gravado”.
- A inbox de 5 s e o reconcile de 30 s passam por `overlayPendingLeads`: a ficha a meio do debounce não perde nota nem temperatura, e a fala nova do Telegram ainda entra. Sem fila, o overlay ainda aplica o tombstone — um GET da inbox não ressuscita o lead apagado. Captura e lote usam a mesma fila de flush. Nó sem `id` no POST do CRM é ignorado (já não é 500). Quadro em `/fluxo/funil/:id` com CRM em erro já não finge 404.
- `reconcileFunnels` já não apaga um quadro só porque o POST o omitiu. Um separador velho que grava A+B não remove o C criado noutro. Apagar exige tombstone (`removedFunnelIds`). O painel ainda não faz POST `/api/crm` até o GET hidratar, para o seed local não criar um quadro a mais. Seed só sobe quando o GET veio vazio. Os POSTs do CRM no painel vão à vez: criar funil + autosave + publicar já não se atropelam. Um POST que correu com o snapshot velho **não** limpa tombstones nem a fila de funis/settings gravados a meio do pedido — o flush seguinte sobe o que ficou. No Worker, o persist volta a ler o KV antes de gravar (`commitCrmFunnels`): um POST atrasado não ressuscita o funil que outro pedido já tombstonou. O flush dos leads também vai à vez: simular conversa + o tick da Sté já não mandam dois POSTs em paralelo. O upsert relê o KV (`commitStoredLead`) para um POST velho não apagar a fala ou a nota mais nova.
- Dashboard, Analytics e Conversas mostram "—" / "…" no pixel quando a leitura ainda não veio ou falhou. O funil Facebook e o split do ads usam o mesmo `pixelFigure` dos KPIs: "…" a carregar, "—" se a API falhou sem leitura anterior. As setas de conversão do funil usam `pixelDropFigure` — também "…" a carregar, não "—". Dashboard e Telegram só escondem os números de leads com "…" quando o GET ainda não veio **e** a lista local está vazia; cache no `localStorage` já conta. Não tratam zero como dado real. Funis, leads e conversas mostram “A carregar…” enquanto o Worker ainda não respondeu — não fingem lista vazia.
- `safeAppPath` só aceita rotas exactas do painel (e `/fluxo/funil/:id`). `/configuracoesfoo` não redirecciona para Configurações. `/privacidade` no `next=` do login é aceite.
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

`scripts/ui-audit.mts` percorre login, rotas do painel, 404, funil inexistente, skip-link, teclado das tabs, captura, logout → forgot/reset e as larguras 320 / 375 / 768 / 1024 / 1440. Precisa do `npm run dev` em `http://127.0.0.1:43173`. O 404 interno espera o texto (não lê o body no primeiro paint).

`scripts/ste-flow.mts` cobre o webhook assinado (`/start fb`, segundo `/start` sem spam, fala do lead, join no grupo), recusa do Telegram que não grava boas-vindas, envio parcial que já entregou uma fala (grava transcript e não reenvia), `update_id` repetido (incluindo dois claims ao mesmo tempo e forget que não apaga outro id), inbox autenticada, runtime sem vazar o token, DELETE do lead, POST depois do DELETE que não ressuscita o lead nem limpa o tombstone, pending tombstoned que não volta à inbox, cron com duas esperas, cron que não come espera de chat real sem token, cron que manda oferta/`send_message` em HTML, recusa de JSON enorme (413) inclusive no pixel, hydrate que não ressuscita lead/funil apagado, tombstone de funil e de lead (KV ganha do Supabase no webhook e no cron), a regra de que simulação/lote não inventam `telegramChatId` e que lead com chat real não simula no painel, o pixel que não finge zero quando a leitura falha e que não reescreve convite de grupo, o envio Telegram que não trata 403 como sucesso, o lock do cron com dono e renovação, a união de eventos e de falas do lead (POST incompleto e webhook atrasado), a corrida login/troca de senha, a memória que sobrevive a um POST mais novo vazio, o HSTS do `/t.js`, links da Sté sem userinfo, settings sem chat da Ester, CSV sem fórmula, endpoint da IA só no Worker, os limites de escrita do CRM/leads, o balde de throttle que une chaves em escrita concorrente, a espera `NaN` que não derruba o runtime, o seed local que não pode gravar o CRM antes do hydrate, o hydrate que aplica tombstone de funil, o reconcile que não apaga o quadro omitido sem tombstone, o POST do CRM que recusa um `production` vazio novo sem tombstonear o quadro que já estava, o alias do Telegram que não cria dois leads no mesmo chat, e a ficha/POST que não avançam o quadro de um chat real, o publicar que reverte se o Worker recusar, o POST `/api/runtime` que guarda o token quando o webhook falha sem ser Unauthorized, o rascunho mais novo que volta à fila de flush depois do hydrate, a inbox que não pisa a ficha ainda por gravar, o hydrate de settings que não pisa username/grupo ainda por gravar, o `next=/privacidade` do login, o POST velho do CRM que não ressuscita funil já tombstonado, a fila de funis/settings que sobrevive a um flush a meio da edição, o POST velho do lead que não apaga a fala do tick, e o hydrate da inbox que une sem wipe quando o GET dos leads falhou.

```bash
npx tsx scripts/ui-audit.mts
AUDIT_URL=https://www.abilion.lol AUDIT_PUBLIC=1 npx tsx scripts/ui-audit.mts
```

`AUDIT_PUBLIC=1` só cobre páginas públicas (a senha de produção dos operadores não está no repositório).
