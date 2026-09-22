# Abilion — baseline antes da evolução multi-bot

Este documento congela o contrato funcional que precisa continuar verdadeiro
durante a migração. Ele descreve o estado anterior à área de Bots, Cérebro,
Criativos e grupos multiassociação.

## Caminho que está em produção

1. O anúncio abre `/l`; `t.js` associa a visita ao clique.
2. O Telegram entrega `/start`, mensagem, entrada no grupo ou pedido de entrada.
3. O webhook assinado responde `200` imediatamente e processa em segundo plano.
4. O `update_id` é reclamado antes da execução para não repetir envio.
5. A landing/script escolhe um funil; sem script, vale o publicado mais recente.
6. O runtime da Sté decide a fala, envia texto ou voz e só então persiste o
   transcript como entregue.
7. Esperas vencidas são retomadas pelo cron com lock renovável.

## Duas execuções que a migração precisa unificar

- O grafo em `src/lib/runtime.ts` executa entrada, mensagem, espera, condição,
  handoff, aviso, tag e oferta.
- A máquina em `src/lib/ste.ts` executa as fases conversacionais da Sté e ainda
  possui cópias padrão quando o quadro não define todos os passos.

O destino é um único `FlowVersion`: automação só corre em nós determinísticos e
o Cérebro só é chamado por um nó Bot/IA explícito.

## Estado e persistência que não podem regredir

- Catálogo `unread` nunca é tratado como vazio confirmado.
- Tombstone de lead ou funil ganha de cache, backup, webhook e cron.
- Alias de contacto/chat impede dois UUIDs para a mesma pessoa.
- Falha parcial de envio conserva o que o Telegram já aceitou e não duplica.
- Lead com chat real não avança o quadro no navegador.
- Importado não recebe automação da Sté.
- Links aceitam apenas HTTP(S) sem credenciais na URL.
- Token e chaves não entram no browser, git, exportação ou log.
- Staging e produção usam KV, webhook e bot separados.

## Dados existentes

- Um runtime global em `runtime:secrets`.
- Um anel de updates em `tg:updates`.
- Funis e definições em `crm:funnels` e `crm:settings`.
- Leads em `crm:lead:*`, índice em `crm:index`, aliases e tombstones.
- Áudios em `voice:clips`.
- Pixel em `track:events`.
- Autenticação em `snapshot`.

O backup operacional exporta CRM, tombstones, aliases, pixel e voz. Ele exclui
autenticação, sessões, tokens, segredos, throttles e locks. Backups de produção
nunca podem ser restaurados em staging.

## Critério de equivalência antes do corte

- Mesma entrada escolhe o mesmo funil e o mesmo primeiro passo.
- Mesma fala chega à mesma fase, preservando links e guardas.
- Mesma espera vence uma vez.
- Mesma recusa do Telegram não vira sucesso.
- Mesmo update repetido não envia novamente.
- Sem FlowVersion publicado, não há efeito automático.
- O trace em modo sombra explica qualquer diferença antes da activação.
