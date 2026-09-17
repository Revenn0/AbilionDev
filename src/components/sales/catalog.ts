import type { SalesKind, SalesNodeData } from "@/lib/types"

export type SalesGroup = "sales" | "messages"

export type SalesCatalogItem = {
  id: string
  kind: SalesKind
  group: SalesGroup
  label: string
  hint: string
  defaults?: Partial<SalesNodeData>
}

export const SALES_GROUPS: { id: SalesGroup; label: string; hint: string }[] = [
  { id: "sales", label: "Funil de vendas", hint: "Tráfego, divisor e páginas" },
  { id: "messages", label: "Mensagens", hint: "Quando, WhatsApp, e-mail" },
]

export const SALES_CATALOG: SalesCatalogItem[] = [
  {
    id: "traffic-yt",
    kind: "traffic",
    group: "sales",
    label: "YouTube",
    hint: "Anúncio em vídeo",
    defaults: { channel: "youtube", tag: "AD — YOUTUBE", title: "Anúncio — YouTube" },
  },
  {
    id: "traffic-gg",
    kind: "traffic",
    group: "sales",
    label: "Google",
    hint: "Display / Search",
    defaults: { channel: "google", tag: "GOOGLE DISPLAY", title: "Campanha — Google" },
  },
  {
    id: "traffic-meta",
    kind: "traffic",
    group: "sales",
    label: "Meta Ads",
    hint: "Facebook e Instagram Ads",
    defaults: { channel: "meta", tag: "META ADS", title: "Campanha — Meta" },
  },
  { id: "split", kind: "split", group: "sales", label: "Divisor", hint: "A/B de tráfego" },
  { id: "sales_page", kind: "sales_page", group: "sales", label: "Página de vendas", hint: "Preview + URL" },
  { id: "trigger", kind: "trigger", group: "messages", label: "Quando", hint: "Disparo por mensagem" },
  { id: "whatsapp", kind: "whatsapp", group: "messages", label: "WhatsApp", hint: "Texto + botão com URL" },
  { id: "email", kind: "email", group: "messages", label: "E-mail", hint: "Assunto e corpo" },
  { id: "delay", kind: "delay", group: "messages", label: "Espera", hint: "Pausa antes do próximo" },
]

export function defaultSalesData(kind: SalesKind): SalesNodeData {
  switch (kind) {
    case "traffic":
      return { title: "Fonte de tráfego", tag: "ORGÂNICO", channel: "organic", url: "" }
    case "trigger":
      return { title: "Quando", triggerType: "incoming_whatsapp", triggerLabel: "Mensagem do usuário", body: "Inicia o funil quando o lead responde." }
    case "whatsapp":
      return {
        title: "WhatsApp",
        body: "Ei, {{primeiro_nome}}! Vimos que você parou no meio. O próximo passo ainda está aberto.",
        cta: "Clique aqui",
        url: "https://abilion.com/oferta",
      }
    case "telegram":
      return { title: "Telegram", body: "{{primeiro_nome}}, a oferta do dia saiu na comunidade.", cta: "Abrir", url: "https://t.me/abilion" }
    case "email":
      return {
        title: "Enviar e-mail",
        fromEmail: "ops@abilion.com",
        subject: "Seu próximo passo no funil",
        body: "Vimos que você se interessou. O checkout continua disponível.",
        url: "https://abilion.com/checkout",
      }
    case "delay":
      return { title: "Tempo de espera", delayHours: 23, delayWindow: "08:00 às 20:00" }
    case "split":
      return {
        title: "Divisor de tráfego",
        splits: [
          { id: "a", label: "Página de vendas — V1", percent: 50 },
          { id: "b", label: "Página de vendas — V2", percent: 50 },
        ],
      }
    case "sales_page":
      return { title: "Página de vendas — V1", url: "https://abilion.com/v1", cta: "Ver oferta" }
  }
}
