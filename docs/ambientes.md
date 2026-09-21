# Ambientes: desenvolvimento → staging → produção

Regra única: **nada entra em produção sem passar por staging e ser aprovado pelo Victor.**
O que se testa em staging é exactamente o que sobe — o deploy de produção recusa qualquer outra coisa.

## Mapa

| | Desenvolvimento | Staging | Produção |
| --- | --- | --- | --- |
| Onde corre | máquina local | Cloudflare Worker `abilion-staging` | Cloudflare Worker `abilion` |
| URL | `http://127.0.0.1:43173` (Vite) · `:43174` (Worker local) | `https://staging.abilion.lol` | `https://www.abilion.lol` |
| Branch | `cursor/*`, `feat/*`, qualquer | `staging` | `main` |
| KV | simulado em `.wrangler/state` | `abilion-auth-staging` | `abilion-auth` |
| Postgres | nenhum | nenhum por defeito (projecto Supabase próprio, se quiseres) | Supabase Abilion |
| Bot Telegram | nenhum | **bot de staging** (token próprio) | bot da Sté |
| Cron | manual | a cada 5 min | a cada 5 min |
| Quem publica | ninguém | agente ou CI, a cada push em `staging` | CI no merge em `main`, ou `npm run deploy:prod -- --approved <sha>` |
| Quem aprova | — | — | **Victor**, no PR `staging → main` |
| `ABILION_ENV` | `development` | `staging` | `production` |

`GET /api/health` diz sempre `env` e `version` (commit). É assim que se confirma o que está no ar em cada ambiente.

## Fluxo

```
trabalho ──push──▶ branch cursor/…  ──PR──▶ staging ──deploy automático──▶ staging.abilion.lol
                                                                                │
                                                        Victor testa e aprova o PR staging → main
                                                                                ▼
                                                     main ──deploy automático──▶ www.abilion.lol
```

1. **Desenvolver.** Qualquer alteração nasce num branch (`cursor/…`). O CI corre `typecheck`, `lint`, `test` (2.100+ asserts) e `build` em cada push e PR.
2. **Levar a staging.** Merge (ou push) para o branch `staging`. Cada push em `staging` publica em `staging.abilion.lol` e corre o smoke (`scripts/smoke.mts`). O agente também pode publicar à mão com `npm run deploy:staging`.
3. **Testar em staging.** O Victor percorre o fluxo como utilizador: login, páginas afectadas, `/l`, `/start` com o bot de staging, estados vazios e de erro. Prints e análise (ver `AGENTS.md`) são feitos **aqui**, não em produção.
4. **Aprovar.** Abre-se o PR `staging → main`. O Victor revê e aprova. Sem a aprovação dele o merge é bloqueado pela regra do branch `main`.
5. **Produção.** O merge em `main` dispara o deploy de produção. O script confere antes de publicar que:
   - o branch é `main` e a árvore está limpa;
   - o commit aprovado é o HEAD;
   - **staging está a servir a mesma árvore** (`git rev-parse <sha>^{tree}`) — se alguém alterou algo depois do teste, recusa.
   Depois publica com `GIT_SHA` e corre o smoke em `www.abilion.lol`.

## Comandos

```bash
npm run dev            # Vite em 127.0.0.1:43173 (UI)
npm run dev:worker     # Worker local em :43174 com KV simulado (build + wrangler dev)
npm run deploy         # = deploy:staging — o defeito é sempre staging
npm run deploy:staging # build + wrangler deploy staging + smoke
npm run deploy:prod -- --approved <sha>   # só no main, só com o hash aprovado
npm run smoke -- https://staging.abilion.lol --env staging --sha <sha>
npm run staging:reset -- --yes            # limpa o KV de staging (recusa o de produção)
```

## Regras a ligar no Origin (uma vez)

No repositório → Settings → Rulesets:

- **`main`** (kind `merge_branch`): exige PR, **1 aprovação** (Victor), *dismiss stale reviews on push*, *require branch up to date*, *require status checks* (CI verde), **bloqueia push directo** e apagar o branch.
- **`staging`**: exige status checks (CI verde). Push directo permitido para o agente poder publicar rascunhos.

O mesmo pode ser feito por Terraform (`cursor_origin_repo_ruleset`).

### CI no Origin

O Origin corre workflows do GitHub Actions através do **Depot** ou do **Buildkite**. Uma vez:

1. Repositório → Apps → ligar o Depot.
2. Na máquina do Victor, no checkout do repo: `depot login` e `depot ci migrate workflows --forge=origin` — copia `.github/workflows/` para `.depot/workflows/` com os ajustes do Depot.
3. `depot ci migrate secrets-and-vars` e depois definir `CLOUDFLARE_API_TOKEN` (token API com *Workers Scripts:Edit*, *Workers KV:Edit*, *Workers Routes:Edit*, *Account Settings:Read*) e `CLOUDFLARE_ACCOUNT_ID` (`73dd2cecfc9c7f0220a36fe999e3edf1`).
4. Commit de `.depot/workflows/` e merge para `main`.

Sem CI ligado, o fluxo funciona na mesma à mão: o agente publica staging com `npm run deploy:staging`; o Victor aprova o PR; quem publica produção corre `npm run deploy:prod -- --approved <sha>` a partir do `main`. As guardas são as mesmas.

## Secrets por ambiente

Os secrets são por Worker. Staging **nunca** reutiliza os de produção que gravem dados.

| Secret | Produção | Staging |
| --- | --- | --- |
| `TELEGRAM_BOT_TOKEN` | bot da Sté | **outro bot** criado no @BotFather só para staging. O Telegram aceita um único webhook por bot — o mesmo token nos dois Workers roubava os updates de produção. |
| `TELEGRAM_WEBHOOK_SECRET` | próprio | próprio |
| `CRON_SECRET` | próprio | próprio |
| `SUPABASE_SERVICE_ROLE` | Supabase Abilion | **não definir**, a não ser com um projecto Supabase só de staging (e `SUPABASE_URL` desse projecto no `wrangler.staging.jsonc`) |
| `OPENAI_API_KEY` / `OPENCODE_API_KEY` | próprias | podem ser as mesmas (só custam pedidos) ou vazias — a Sté cai na voz local |
| `ELEVENLABS_API_KEY` / `ELEVENLABS_VOICE_ID` | próprias | opcional; cada clip gerado custa créditos |
| `ESTER_CHAT_ID` | chat da Ester | um chat de teste, ou vazio |
| `ABILION_OPERATOR_PASSWORD` | opcional | opcional |

```bash
npx wrangler secret put TELEGRAM_BOT_TOKEN --config wrangler.staging.jsonc
npx wrangler secret put CRON_SECRET --config wrangler.staging.jsonc
```

Vincular o bot de staging faz-se no próprio painel de staging (Configurações → Vincular Telegram), que aponta o webhook para `https://staging.abilion.lol/api/telegram`.

## Dados

- Staging não recebe PII de produção. Nada de copiar o KV `abilion-auth` nem o dump dos 2.269 leads para staging.
- Para popular: **Simular 100 /start** em Telegram, **Importar lista** em Leads com nomes fictícios, ou `/start` reais no bot de staging.
- `npm run staging:reset -- --yes` apaga o KV de staging quando se quer começar limpo. O script recusa o id do KV de produção.
- Os operadores de staging são os mesmos e-mails; a senha define-se no primeiro login de staging e vive só no KV de staging.

## Verificar e reverter

```bash
curl -s https://staging.abilion.lol/api/health   # {"ok":true,"env":"staging","version":"<sha>",…}
curl -s https://www.abilion.lol/api/health       # {"ok":true,"env":"production","version":"<sha>",…}
npx wrangler deployments list                    # histórico de produção
npx wrangler rollback                            # volta à versão anterior de produção
```

O rollback do Cloudflare repõe o Worker anterior em segundos. Para reverter também o código, `git revert` no `main` e o pipeline republica.

## Limites conhecidos

- O snippet do pixel que se cola no anúncio aponta sempre para `https://www.abilion.lol/t.js` (`ADS_ORIGIN`), mesmo no painel de staging. A landing `/l` de staging usa `/t.js` relativo, por isso o pixel de staging grava em staging.
- Staging sem Postgres testa só o caminho KV. Para testar a cópia Postgres, cria um projecto Supabase de staging (vazio) e aplica o esquema que o Worker usa (`leads`, `lead_events`, `funnels`, `settings`, `page_events`).
- O `GIT_SHA` é injectado pelo `scripts/deploy.mts`. Um `wrangler deploy` à mão sem `--var GIT_SHA:…` deixa a versão anterior no `/api/health` — usa sempre os scripts.
