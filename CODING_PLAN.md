# Sté — motor e IA

A Sté corre o quadro publicado. A IA só entra no papo livre depois da oferta. Tokens vão em Configurações, nunca no git.

| | Valor |
|---|---|
| Principal | OpenCode Go · `deepseek-v4.1-flash` · chave `oc_sk_…` |
| Reserva 1 | OpenRouter · `google/gemma-4-31b-it:free` · chave `sk-or-v1…` |
| Reserva 2 | OpenRouter · `deepseek/deepseek-v4-flash-0731:free` |
| Volume pago | `z-ai/glm-5.3-flash` no OpenRouter |
| Sem chave | Script do quadro + voz local |

O funil inteiro (boas-vindas, minicurso, Superbet, lives, oferta, remarketing, ofensa) corre sem IA.

## Quando o modelo corre

| Evento | Motor |
|---|---|
| `/start` e `/start=fb` | 3 boas-vindas. Sem IA. |
| Minicurso / Superbet / lives / oferta | Prompt interno. Sem IA. |
| Follow-up 5–10 min e remarketing 7h | Cron + `replySteTick`. Sem IA. |
| Ofensa | Uma desculpa e silêncio. Sem IA. |
| Papo livre depois da oferta | OpenCode DeepSeek V4.1 Flash; se falhar, Gemma 4 31B e depois DeepSeek V4 Flash |
| API falha / vazio | Script da Sté (App / Premium / checkout) |
