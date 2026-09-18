import { BANCA_FIXED, type SalesKind, type SalesNodeData } from "@/lib/types"

export type SalesGroup = "map" | "flow"

export type SalesCatalogItem = {
  id: string
  kind: SalesKind
  group: SalesGroup
  label: string
  hint: string
  defaults?: Partial<SalesNodeData>
}

export const SALES_GROUPS: { id: SalesGroup; label: string; hint: string }[] = [
  { id: "map", label: "Mapa", hint: "Tráfego e campanha — não executa" },
  { id: "flow", label: "Fluxo", hint: "O que o canal corre de verdade" },
]

export const SALES_CATALOG: SalesCatalogItem[] = [
  {
    id: "traffic-meta",
    kind: "traffic",
    group: "map",
    label: "Meta Ads",
    hint: "Anúncio de origem",
    defaults: { channel: "meta", tag: "META ADS", title: "Anúncio — Meta" },
  },
  {
    id: "traffic-yt",
    kind: "traffic",
    group: "map",
    label: "YouTube",
    hint: "Anúncio em vídeo",
    defaults: { channel: "youtube", tag: "AD — YOUTUBE", title: "Anúncio — YouTube" },
  },
  {
    id: "landing",
    kind: "landing",
    group: "map",
    label: "Landing",
    hint: "Mini curso / página",
    defaults: { title: "Landing", cta: "Quero o mini curso" },
  },
  { id: "split", kind: "split", group: "map", label: "Divisor", hint: "WA e TG não se misturam" },
  {
    id: "entry-popup",
    kind: "entry",
    group: "flow",
    label: "Entrada · popup",
    hint: "Captura do mini curso",
    defaults: { title: "Entrada · popup", entryTrigger: "popup" },
  },
  {
    id: "entry-join",
    kind: "entry",
    group: "flow",
    label: "Entrada · join",
    hint: "Entrou no grupo",
    defaults: { title: "Entrada · join", entryTrigger: "group_join" },
  },
  {
    id: "entry-start",
    kind: "entry",
    group: "flow",
    label: "Entrada · /start",
    hint: "Privado no bot",
    defaults: { title: "Entrada · /start", entryTrigger: "start" },
  },
  {
    id: "message",
    kind: "message",
    group: "flow",
    label: "Mensagem",
    hint: "Texto + botão, qualquer canal",
  },
  {
    id: "wait",
    kind: "wait",
    group: "flow",
    label: "Espera",
    hint: "Pausa em horas (84h)",
    defaults: { title: "Espera 3–4 dias", delayHours: 84 },
  },
  {
    id: "condition",
    kind: "condition",
    group: "flow",
    label: "Condição",
    hint: "Print, banca, temperatura",
    defaults: { title: "Chegou print?", conditionKind: "print" },
  },
  {
    id: "handoff",
    kind: "handoff",
    group: "flow",
    label: "Sté 1:1",
    hint: "Humano. O fluxo pausa.",
    defaults: { title: "Sté · atendimento 1:1", handoffAgent: "ste" },
  },
  {
    id: "notify",
    kind: "notify",
    group: "flow",
    label: "Avisar Ester",
    hint: "Payload fixo — nunca gerar",
    defaults: { title: "Avisar Ester", notifyKind: "ester", notifyBody: BANCA_FIXED },
  },
  {
    id: "tag",
    kind: "tag",
    group: "flow",
    label: "Tag",
    hint: "Novo / morno / quente",
    defaults: { title: "Marcar quente", tagKind: "temperature", temperature: "quente" },
  },
  {
    id: "offer",
    kind: "offer",
    group: "flow",
    label: "Oferta",
    hint: "Só se o quadro tiver este nó",
  },
]

export function defaultSalesData(kind: SalesKind): SalesNodeData {
  switch (kind) {
    case "traffic":
      return { title: "Fonte de tráfego", tag: "ORGÂNICO", channel: "organic", url: "" }
    case "landing":
      return { title: "Landing", url: "", cta: "Quero o mini curso" }
    case "split":
      return {
        title: "Campanha — não misturar",
        splits: [
          { id: "a", label: "WhatsApp · grupo", percent: 50 },
          { id: "b", label: "Telegram · convite", percent: 50 },
        ],
      }
    case "entry":
      return { title: "Entrada", entryTrigger: "any" }
    case "message":
      return {
        title: "Mensagem",
        body: "Oi, {{primeiro_nome}}. O próximo passo do fluxo está aqui.",
        cta: "Continuar",
      }
    case "wait":
      return { title: "Tempo de espera", delayHours: 84, delayWindow: "depois do print" }
    case "condition":
      return { title: "Chegou print?", conditionKind: "print" }
    case "handoff":
      return { title: "Sté · 1:1", handoffAgent: "ste", body: "Atendimento humano. O fluxo pausa." }
    case "notify":
      return { title: "Avisar Ester", notifyKind: "ester", notifyBody: BANCA_FIXED }
    case "tag":
      return { title: "Marcar quente", tagKind: "temperature", temperature: "quente" }
    case "offer":
      return { title: "Oferta do produto", body: "O fluxo oferece o produto.", cta: "Ver oferta", url: "" }
  }
}
