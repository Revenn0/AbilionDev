import { BANCA_FIXED, type SalesKind, type SalesNodeData, type SteLine } from "@/lib/types"
import { LEGACY_BOT_ID, LEGACY_BRAIN_ID } from "@/lib/platform"

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

export const STE_LINE_LABELS: { id: SteLine; label: string }[] = [
  { id: "welcome", label: "Boas-vindas" },
  { id: "course", label: "Minicurso" },
  { id: "superbet", label: "Superbet" },
  { id: "rescue", label: "Resgate cadastro" },
  { id: "offer", label: "App / Premium" },
  { id: "lives", label: "Horário das lives" },
  { id: "remarketing", label: "Remarketing 7h" },
  { id: "close", label: "Encerrar" },
]

export function steLineLabel(id?: SteLine) {
  return STE_LINE_LABELS.find((item) => item.id === id)?.label ?? id ?? ""
}

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
  { id: "split", kind: "split", group: "map", label: "Divisor", hint: "Divide o mapa por campanha" },
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
    id: "talk",
    kind: "talk",
    group: "flow",
    label: "Iniciar conversa",
    hint: "O que a Sté manda ao abrir",
    defaults: { title: "Iniciar conversa", body: "Opa, seja muito bem-vindo! Aqui é a Sté." },
  },
  {
    id: "ai-started",
    kind: "bot",
    group: "flow",
    label: "IA iniciado",
    hint: "Escolhe a saída desenhada no fluxo",
    defaults: {
      title: "IA iniciado",
      body: "Oi! Me conta se você já joga ou está começando, e como têm sido os resultados.",
      botPolicy: {
        botId: LEGACY_BOT_ID,
        brainVersionId: LEGACY_BRAIN_ID,
        instruction: "Escolhe só uma saída deste bloco. Se nada casar, manda o texto de reserva e fica aqui.",
        mode: "decide",
        runWhen: "message",
        language: "pt-BR",
        contextFields: ["name", "lastMessage"],
        allowedActions: ["reply"],
        outputBranches: ["next"],
        branchRules: [],
        readLeadMemory: true,
        writeLeadMemory: false,
        timeoutSeconds: 20,
        retries: 0,
      },
    },
  },
  {
    id: "file",
    kind: "file",
    group: "flow",
    label: "Envio de arquivo",
    hint: "Manda um arquivo pelo link",
    defaults: { title: "Envio de arquivo", body: "Segue o arquivo.", fileName: "material.pdf", url: "" },
  },
  {
    id: "intake",
    kind: "intake",
    group: "flow",
    label: "Leitura de arquivo",
    hint: "Segue quando chega print ou arquivo",
    defaults: { title: "Leitura de arquivo", body: "Espera o print ou o arquivo do lead." },
  },
  {
    id: "ste-welcome",
    kind: "message",
    group: "flow",
    label: "Boas-vindas Sté",
    hint: "O que ela diz no /start",
    defaults: { title: "Boas-vindas", steLine: "welcome", body: "Opa, seja muito bem-vindo! Aqui é a Sté, conhecida como a Mãe do Aviator." },
  },
  {
    id: "ste-course",
    kind: "message",
    group: "flow",
    label: "Minicurso",
    hint: "Fala depois da primeira resposta",
    defaults: { title: "Minicurso", steLine: "course" },
  },
  {
    id: "ste-remark",
    kind: "offer",
    group: "flow",
    label: "Remarketing 7h",
    hint: "Follow-up e silêncio",
    defaults: { title: "Remarketing", steLine: "remarketing", dieAfter: true, delayHours: 7 },
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
    id: "bot",
    kind: "bot",
    group: "flow",
    label: "Bot / IA",
    hint: "Executa o Cérebro só neste passo",
    defaults: {
      title: "Bot / IA",
      botPolicy: {
        botId: LEGACY_BOT_ID,
        brainVersionId: LEGACY_BRAIN_ID,
        instruction: "",
        mode: "respond",
        runWhen: "message",
        language: "pt-BR",
        contextFields: ["name", "campaign", "temperature", "lastMessage"],
        allowedActions: ["reply"],
        outputBranches: ["next"],
        readLeadMemory: true,
        writeLeadMemory: false,
        timeoutSeconds: 20,
        retries: 1,
      },
    },
  },
  {
    id: "human",
    kind: "human",
    group: "flow",
    label: "Humano",
    hint: "Pausa até o operador retomar",
    defaults: { title: "Atendimento humano", humanInstructions: "" },
  },
  {
    id: "approve",
    kind: "approve",
    group: "flow",
    label: "Aprovar entrada",
    hint: "Aceita o pedido do canal",
    defaults: { title: "Aprovar entrada no canal" },
  },
  {
    id: "audio",
    kind: "audio",
    group: "flow",
    label: "Áudio",
    hint: "Voz fixa deste passo",
    defaults: { title: "Enviar áudio", body: "", audioFallback: "error" },
  },
  {
    id: "webhook",
    kind: "webhook",
    group: "flow",
    label: "Webhook",
    hint: "Chamada autorizada pelo fluxo",
    defaults: { title: "Chamar webhook", webhookMethod: "POST", url: "" },
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
          { id: "a", label: "Facebook Ads", percent: 50 },
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
    case "bot":
      return {
        title: "Bot / IA",
        botPolicy: {
          botId: LEGACY_BOT_ID,
          brainVersionId: LEGACY_BRAIN_ID,
          instruction: "",
          mode: "respond",
          runWhen: "message",
          language: "pt-BR",
          contextFields: ["name", "campaign", "temperature", "lastMessage"],
          allowedActions: ["reply"],
          outputBranches: ["next"],
          readLeadMemory: true,
          writeLeadMemory: false,
          timeoutSeconds: 20,
          retries: 1,
        },
      }
    case "human":
      return { title: "Atendimento humano", humanInstructions: "" }
    case "approve":
      return { title: "Aprovar entrada no canal" }
    case "audio":
      return { title: "Enviar áudio", body: "", audioFallback: "error" }
    case "webhook":
      return { title: "Chamar webhook", webhookMethod: "POST", url: "" }
    case "talk":
      return { title: "Iniciar conversa", body: "Opa, seja muito bem-vindo! Aqui é a Sté." }
    case "file":
      return { title: "Envio de arquivo", body: "Segue o arquivo.", fileName: "material.pdf", url: "" }
    case "intake":
      return { title: "Leitura de arquivo", body: "Espera o print ou o arquivo do lead." }
  }
}
