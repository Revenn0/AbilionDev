# Entrega

Nada fica “pronto” só no código ou no localhost. E nada vai para produção sem o Victor aprovar.

Ambientes (ver `docs/ambientes.md`):

- **Desenvolvimento**: `npm run dev` / `npm run dev:worker`. Serve para escrever e correr `npm run typecheck`, `npm run lint`, `npm test`.
- **Staging**: `https://staging.abilion.lol`. É aqui que o agente publica (`npm run deploy:staging`) e onde se prova a mudança.
- **Produção**: `https://www.abilion.lol`. Só sobe a partir do `main`, com o PR `staging → main` aprovado pelo Victor. **O agente não corre `npm run deploy:prod`.**

Antes de entregar qualquer mudança de UI, fluxo, bot ou painel:

1. Commit no branch de trabalho, testes verdes, `npm run deploy:staging`.
2. Abrir o **URL de staging** e percorrer o fluxo como utilizador: login, páginas afectadas, estados vazios e erro. `/l` e `/start` usam o bot de staging.
3. **Tirar print** de cada ecrã relevante em staging.
4. **Analisar** os prints: contraste, texto ilegível, ecrã preto, botões mortos, regressão.
5. Se falhar, corrigir e repetir. Só então pedir a aprovação: PR `staging → main` com os prints e o `version` que `https://staging.abilion.lol/api/health` está a devolver.

Localhost serve para desenvolver. Staging + print + análise é o critério de pronto para pedir aprovação. Produção é decisão do Victor.
