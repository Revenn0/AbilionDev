# GLM 5.3 Flash — GLM Coding Plan

A Sté usa o **GLM Coding Plan** da Z.ai, não o endpoint geral de pay-as-you-go.

| | Valor |
|---|---|
| Plano | GLM Coding Plan (quota por pontos, 3× no Flash) |
| Modelo | `glm-5.3-flash` |
| Endpoint | `https://api.z.ai/api/coding/paas/v4` |
| Protocolo | OpenAI Chat Completions |
| Secret | `OPENAI_API_KEY` no Worker (nunca no git) |

Não uses `https://api.z.ai/api/paas/v4`. Esse é o API geral. A chave do Coding Plan entra em `/api/coding/paas/v4`.

## Contrato da chamada

O Worker manda:

```json
{
  "model": "glm-5.3-flash",
  "temperature": 1,
  "top_p": 0.95,
  "max_tokens": 1024,
  "thinking": { "type": "enabled" },
  "reasoning_effort": "low",
  "messages": [{ "role": "system" }, { "role": "user" }]
}
```

- Thinking no 5.3 **não desliga**. `thinking.type` só aceita `enabled`.
- `reasoning_effort: low` no Telegram (uma frase). `max` é para coding, não para Sté.
- `max_tokens` ≥ 1024: o thinking come tokens; 120 calava a resposta.
- Só o `message.content` vai para o lead. `reasoning_content` não se envia.

## Quando o modelo corre

| Evento | Motor |
|---|---|
| `/start` e `/start=fb` | Determinístico (opener). Sem GLM. |
| Ofensa | Motor. Uma desculpa e silêncio. Sem GLM. |
| Resposta do lead | `glm-5.3-flash` se existir `OPENAI_API_KEY` e `STE_USE_LLM ≠ 0` |
| API falha / vazio | Fallback do motor determinístico |

## Fases

1. **Endpoint certo** — `STE_LLM_BASE_URL` e `OPENAI_BASE_URL` = `/api/coding/paas/v4`.
2. **Secret no Worker** — Cloudflare → `abilion` → Secret `OPENAI_API_KEY`. Health: `llm: true`, `model: glm-5.3-flash`.
3. **Sté** — uma frase, PT, sem vender no primeiro toque; ofensa fora do modelo.
4. **Produção** — print Conversas depois de um lead real. Sem isto não está pronto.

## Fora

- Endpoint geral `/api/paas/v4`
- `reasoning_effort: max` no Telegram
- Meter a chave no git ou no wrangler `vars`
