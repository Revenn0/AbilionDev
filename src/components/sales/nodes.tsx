import type { ReactNode } from "react"
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react"
import { steLineLabel } from "./catalog"
import type { SalesKind, SalesNodeData } from "@/lib/types"
import { cn } from "@/lib/utils"

export type SalesCanvasNode = Node<SalesNodeData, SalesKind>

type Tone = "sky" | "pink" | "orange" | "violet" | "emerald" | "amber" | "slate" | "blue"

const TONE: Record<Tone, { pill: string; card: string; handle: string }> = {
  sky: { pill: "border-sky-200 bg-sky-100 text-sky-900", card: "border-sky-200", handle: "!bg-sky-500" },
  pink: { pill: "border-pink-200 bg-pink-100 text-pink-900", card: "border-pink-200", handle: "!bg-pink-500" },
  orange: { pill: "border-orange-200 bg-orange-100 text-orange-900", card: "border-orange-200", handle: "!bg-orange-500" },
  violet: { pill: "border-violet-200 bg-violet-100 text-violet-900", card: "border-violet-200", handle: "!bg-violet-500" },
  emerald: { pill: "border-emerald-200 bg-emerald-100 text-emerald-900", card: "border-emerald-200", handle: "!bg-emerald-500" },
  amber: { pill: "border-amber-200 bg-amber-100 text-amber-950", card: "border-amber-200", handle: "!bg-amber-500" },
  slate: { pill: "border-slate-200 bg-slate-100 text-slate-800", card: "border-slate-200", handle: "!bg-slate-400" },
  blue: { pill: "border-blue-200 bg-blue-100 text-blue-900", card: "border-blue-200", handle: "!bg-blue-500" },
}

function StudioCard({
  title,
  tone,
  selected,
  active,
  width = "w-[280px]",
  children,
  target = true,
  source = true,
  sourceId = "next",
}: {
  title: string
  tone: Tone
  selected?: boolean
  active?: boolean
  width?: string
  children: ReactNode
  target?: boolean
  source?: boolean
  sourceId?: string
}) {
  const skin = TONE[tone]
  return (
    <div className={cn(width, "relative")}>
      <div
        className={cn(
          "relative z-10 mx-5 rounded-full border px-3 py-1 text-center text-[12px] font-medium leading-5 shadow-sm",
          skin.pill,
          selected && "ring-2 ring-sky-400/50",
          active && "ring-2 ring-emerald-400/70"
        )}
      >
        <span className="block truncate">{title}</span>
        {target ? (
          <Handle
            type="target"
            position={Position.Left}
            style={{ top: 14 }}
            className={cn("!-left-1.5 !size-3 !border-2 !border-white", skin.handle)}
          />
        ) : null}
        {source ? (
          <Handle
            type="source"
            id={sourceId}
            position={Position.Right}
            style={{ top: 14 }}
            className={cn("!-right-1.5 !size-3 !border-2 !border-white", skin.handle)}
          />
        ) : null}
      </div>
      <div className={cn("-mt-2.5 rounded-[22px] border bg-white px-3 pb-3 pt-5 shadow-[0_10px_28px_-18px_rgba(15,23,42,0.28)]", skin.card)}>
        {children}
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="flex items-center gap-1.5 text-[10px] font-medium text-slate-400">
        <span className="size-1.5 rounded-full bg-slate-300" />
        {label}
      </p>
      <div className="rounded-lg border border-slate-200 bg-[#fbfcfd] px-2.5 py-1.5 text-[12px] leading-relaxed text-slate-700">
        {children}
      </div>
    </div>
  )
}

export function TrafficNode({ data, selected }: NodeProps<SalesCanvasNode>) {
  return (
    <StudioCard title={data.title || "Tráfego"} tone="blue" selected={selected} target={false}>
      <div className="space-y-2">
        <Field label="Canal">{data.tag || data.channel || "orgânico"}</Field>
        {data.url ? <Field label="Destino">{data.url}</Field> : null}
      </div>
    </StudioCard>
  )
}

export function EntryNode({ data, selected }: NodeProps<SalesCanvasNode>) {
  const trigger =
    data.entryTrigger === "popup" ? "Popup do mini curso" : data.entryTrigger === "group_join" ? "Join no grupo" : data.entryTrigger === "start" ? "/start no Telegram" : "Qualquer entrada"
  return (
    <StudioCard title={data.title || "Entrada"} tone="emerald" selected={selected}>
      <Field label="Quando">{trigger}</Field>
    </StudioCard>
  )
}

export function MessageNode({ data, selected }: NodeProps<SalesCanvasNode>) {
  return (
    <StudioCard title={data.title || "Mensagem"} tone="sky" selected={selected} width="w-[300px]">
      <div className="space-y-2">
        {data.steLine ? <Field label="Fala da Sté">{steLineLabel(data.steLine)}</Field> : null}
        <Field label="Texto">
          <span className="line-clamp-4 whitespace-pre-wrap">{data.body || "—"}</span>
        </Field>
        {data.cta ? <Field label="Botão">{data.cta}</Field> : null}
      </div>
    </StudioCard>
  )
}

export function WaitNode({ data, selected }: NodeProps<SalesCanvasNode>) {
  return (
    <StudioCard title={data.title || "Espera"} tone="orange" selected={selected}>
      <div className="space-y-2">
        <Field label="Horas">{data.delayHours ?? 1} h</Field>
        <Field label="Janela">{data.delayWindow || "comercial"}</Field>
      </div>
    </StudioCard>
  )
}

export function ConditionNode({ data, selected }: NodeProps<SalesCanvasNode>) {
  const label =
    data.conditionKind === "banca"
      ? "Banca enviada?"
      : data.conditionKind === "temperature"
        ? `Temperatura = ${data.conditionValue || "?"}`
        : data.conditionKind === "campaign"
          ? `Campanha = ${data.conditionValue || "?"}`
          : "Print recebido?"
  return (
    <StudioCard title={data.title || "Condição"} tone="violet" selected={selected} source={false}>
      <div className="space-y-2">
        <Field label="Pergunta">{label}</Field>
        <div className="relative flex justify-between px-1 text-[11px] text-slate-400">
          <span>Não</span>
          <span>Sim</span>
          <Handle type="source" id="no" position={Position.Bottom} className="!left-6 !size-3 !border-2 !border-white !bg-slate-400" />
          <Handle type="source" id="yes" position={Position.Right} className="!size-3 !border-2 !border-white !bg-emerald-500" />
        </div>
      </div>
    </StudioCard>
  )
}

export function HandoffNode({ data, selected }: NodeProps<SalesCanvasNode>) {
  return (
    <StudioCard title={data.title || "Sté"} tone="pink" selected={selected}>
      <div className="space-y-2">
        <Field label="Agente">{data.steTalk === false ? "Sté calada" : "Sté fala este quadro"}</Field>
        <Field label="Texto">
          <span className="line-clamp-3">{data.body || "Sté no 1:1. O fluxo pausa."}</span>
        </Field>
      </div>
    </StudioCard>
  )
}

export function BotNode({ data, selected }: NodeProps<SalesCanvasNode>) {
  const policy = data.botPolicy
  const branches = policy?.outputBranches?.length ? policy.outputBranches : ["next"]
  return (
    <StudioCard title={data.title || "IA iniciado"} tone="violet" selected={selected} width="w-[300px]" source={false}>
      <div className="space-y-2">
        <Field label="Modo">{policy?.mode === "decide" ? "Segue o fluxo" : policy?.mode || "responder"}</Field>
        <Field label="Texto de reserva">
          <span className="line-clamp-3 whitespace-pre-wrap">{data.body || "Sem texto de reserva."}</span>
        </Field>
        <Field label="Instrução">
          <span className="line-clamp-4 whitespace-pre-wrap">{policy?.instruction || "Define o que o bot faz neste passo."}</span>
        </Field>
        <div className="relative space-y-1 pt-1">
          {branches.map((branch) => (
            <div key={branch} className="relative pr-3 text-right text-[11px] text-slate-400">
              {branch}
              <Handle
                type="source"
                id={branch}
                position={Position.Right}
                className="!size-3 !border-2 !border-white !bg-violet-500"
              />
            </div>
          ))}
        </div>
      </div>
    </StudioCard>
  )
}

export function TalkNode({ data, selected }: NodeProps<SalesCanvasNode>) {
  return (
    <StudioCard title={data.title || "Iniciar conversa"} tone="emerald" selected={selected} width="w-[300px]">
      <Field label="Abertura">
        <span className="line-clamp-4 whitespace-pre-wrap">{data.body || "Escreve a primeira fala."}</span>
      </Field>
    </StudioCard>
  )
}

export function FileNode({ data, selected }: NodeProps<SalesCanvasNode>) {
  return (
    <StudioCard title={data.title || "Envio de arquivo"} tone="sky" selected={selected} width="w-[300px]">
      <div className="space-y-2">
        <Field label="Arquivo">{data.fileName || "Sem nome"}</Field>
        <Field label="Link">{data.url || "Configura o URL do arquivo."}</Field>
      </div>
    </StudioCard>
  )
}

export function IntakeNode({ data, selected }: NodeProps<SalesCanvasNode>) {
  return (
    <StudioCard title={data.title || "Leitura de arquivo"} tone="violet" selected={selected} source={false}>
      <div className="space-y-2">
        <Field label="Quando">{data.body || "Print, foto ou documento."}</Field>
        <div className="relative flex justify-between px-1 text-[11px] text-slate-400">
          <span>Sem arquivo</span>
          <span>Recebido</span>
          <Handle type="source" id="no" position={Position.Bottom} className="!left-6 !size-3 !border-2 !border-white !bg-slate-400" />
          <Handle type="source" id="yes" position={Position.Right} className="!size-3 !border-2 !border-white !bg-emerald-500" />
        </div>
      </div>
    </StudioCard>
  )
}

export function HumanNode({ data, selected }: NodeProps<SalesCanvasNode>) {
  return (
    <StudioCard title={data.title || "Humano"} tone="pink" selected={selected}>
      <div className="space-y-2">
        <Field label="Estado">Bot pausado</Field>
        <Field label="Orientação">{data.humanInstructions || "O operador assume esta conversa."}</Field>
      </div>
    </StudioCard>
  )
}

export function ApproveNode({ data, selected }: NodeProps<SalesCanvasNode>) {
  return (
    <StudioCard title={data.title || "Aprovar entrada"} tone="emerald" selected={selected}>
      <Field label="Automação">Aprova o pedido recebido neste canal.</Field>
    </StudioCard>
  )
}

export function AudioNode({ data, selected }: NodeProps<SalesCanvasNode>) {
  return (
    <StudioCard title={data.title || "Áudio"} tone="orange" selected={selected} width="w-[300px]">
      <div className="space-y-2">
        <Field label="Roteiro">
          <span className="line-clamp-4 whitespace-pre-wrap">{data.body || "Escreve o roteiro do áudio."}</span>
        </Field>
        <Field label="Se falhar">{data.audioFallback === "text" ? "Enviar texto" : "Seguir caminho de erro"}</Field>
      </div>
    </StudioCard>
  )
}

export function WebhookNode({ data, selected }: NodeProps<SalesCanvasNode>) {
  return (
    <StudioCard title={data.title || "Webhook"} tone="slate" selected={selected} width="w-[300px]">
      <div className="space-y-2">
        <Field label="Método">{data.webhookMethod || "POST"}</Field>
        <Field label="Destino">{data.url || "Configura um URL HTTPS."}</Field>
      </div>
    </StudioCard>
  )
}

export function NotifyNode({ data, selected }: NodeProps<SalesCanvasNode>) {
  return (
    <StudioCard title={data.title || "Aviso"} tone="amber" selected={selected}>
      <div className="space-y-2">
        <Field label="Destino">{data.notifyKind === "banca" ? "Banca · texto fixo" : "Ester · texto fixo"}</Field>
        <Field label="Payload">
          <span className="line-clamp-3">{data.notifyBody || "—"}</span>
        </Field>
      </div>
    </StudioCard>
  )
}

export function TagNode({ data, selected }: NodeProps<SalesCanvasNode>) {
  return (
    <StudioCard title={data.title || "Tag"} tone="slate" selected={selected}>
      <Field label="Marca">
        {data.tagKind === "campaign" ? `Campanha · ${data.campaignLock ?? "—"}` : `Temperatura · ${data.temperature ?? "novo"}`}
      </Field>
    </StudioCard>
  )
}

export function SplitNode({ data, selected }: NodeProps<SalesCanvasNode>) {
  return (
    <StudioCard title={data.title || "Divisor"} tone="violet" selected={selected} source={false}>
      <div className="space-y-1.5">
        {(data.splits || []).map((item) => (
          <div key={item.id} className="relative">
            <Field label={`${item.percent}%`}>{item.label}</Field>
            <Handle
              type="source"
              id={item.id}
              position={Position.Right}
              className="!right-[-10px] !size-3 !border-2 !border-white !bg-violet-500"
            />
          </div>
        ))}
      </div>
    </StudioCard>
  )
}

export function LandingNode({ data, selected }: NodeProps<SalesCanvasNode>) {
  return (
    <StudioCard title={data.title || "Landing"} tone="blue" selected={selected}>
      <div className="space-y-2">
        <Field label="Página">{data.url || "Landing do mini curso"}</Field>
        <Field label="Botão">{data.cta || "Abrir"}</Field>
      </div>
    </StudioCard>
  )
}

export function OfferNode({ data, selected }: NodeProps<SalesCanvasNode>) {
  return (
    <StudioCard title={data.title || "Oferta"} tone="emerald" selected={selected} width="w-[300px]">
      <div className="space-y-2">
        {data.steLine ? <Field label="Fala da Sté">{steLineLabel(data.steLine)}</Field> : null}
        <Field label="Texto">
          <span className="line-clamp-4">{data.body || "O fluxo oferece o produto."}</span>
        </Field>
        {data.cta ? <Field label="Botão">{data.cta}</Field> : null}
      </div>
    </StudioCard>
  )
}

export const salesNodeTypes = {
  traffic: TrafficNode,
  landing: LandingNode,
  split: SplitNode,
  entry: EntryNode,
  message: MessageNode,
  wait: WaitNode,
  condition: ConditionNode,
  handoff: HandoffNode,
  bot: BotNode,
  talk: TalkNode,
  file: FileNode,
  intake: IntakeNode,
  human: HumanNode,
  approve: ApproveNode,
  audio: AudioNode,
  webhook: WebhookNode,
  notify: NotifyNode,
  tag: TagNode,
  offer: OfferNode,
}
