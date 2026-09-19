# OpenRouter — Sté

A Sté chama o OpenRouter (`https://openrouter.ai/api/v1`). O token vai em Configurações, nunca no git.

| | Valor |
|---|---|
| Provider | OpenRouter |
| Modelo desta lista | `google/gemma-4-31b-it:free` |
| Reserva | `deepseek/deepseek-v4-flash-0731:free` (entra sozinha se o Gemma falhar) |
| Porquê | Melhor português e tom de conversa entre os free. Embedding, TTS e Ultra não servem. |
| Volume pago | `z-ai/glm-5.3-flash` no mesmo OpenRouter |
| Secret | chave `sk-or-v1…` no KV do Worker |

Free no OpenRouter tem limite diário (~200 pedidos). O funil inteiro corre sem IA. A IA só entra no papo livre depois da oferta.

## Quando o modelo corre

| Evento | Motor |
|---|---|
| `/start` e `/start=fb` | 3 boas-vindas. Sem IA. |
| Minicurso / Superbet / lives / oferta | Prompt interno. Sem IA. |
| Follow-up 5–10 min e remarketing 7h | Cron + `replySteTick`. Sem IA. |
| Ofensa | Uma desculpa e silêncio. Sem IA. |
| Papo livre depois da oferta | Gemma 4 31B; se 429/erro, DeepSeek V4 Flash |
| API falha / vazio | Script da Sté (App / Premium / checkout) |
