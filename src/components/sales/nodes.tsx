import { Handle, Position, type Node, type NodeProps } from "@xyflow/react"
import { Bell, Clock3, GitFork, GitBranch, Handshake, MessageSquare, Play, Tag, Zap } from "lucide-react"
import { GoogleGlyph, InstagramGlyph, MetaGlyph, OrganicGlyph, YouTubeGlyph } from "@/components/canvas/icons"
import type { SalesKind, SalesNodeData } from "@/lib/types"
import { cn } from "@/lib/utils"

export type SalesCanvasNode = Node<SalesNodeData, SalesKind>

function ChannelGlyph({ channel, className = "size-8" }: { channel?: SalesNodeData["channel"]; className?: string }) {
  if (channel === "instagram") return <InstagramGlyph className={className} />
  if (channel === "youtube") return <YouTubeGlyph className={className} />
  if (channel === "google") return <GoogleGlyph className={className} />
  if (channel === "meta") return <MetaGlyph className={className} />
  return <OrganicGlyph className={className} />
}

function Card({
  selected,
  active,
  children,
  accent,
  width = "w-[400px]",
}: {
  selected?: boolean
  active?: boolean
  children: React.ReactNode
  accent?: string
  width?: string
}) {
  return (
    <div
      className={cn(
        width,
        "rounded-2xl border border-border bg-card shadow-[0_18px_40px_-24px_rgba(0,0,0,0.55)]",
        selected ? "border-primary ring-2 ring-primary/25" : "border-white/10",
        active && "ring-2 ring-emerald-400/70 border-emerald-400"
      )}
      style={accent ? { boxShadow: `0 18px 40px -24px rgba(15,23,42,0.35), inset 0 -3px 0 ${accent}` } : undefined}
    >
      {children}
    </div>
  )
}

function Head({ icon, title, tone }: { icon: React.ReactNode; title: string; tone: string }) {
  return (
    <div className="flex items-center gap-3 px-5 pt-4 pb-2">
      <div className={cn("size-10 rounded-xl grid place-items-center", tone)}>{icon}</div>
      <p className="text-[16px] font-semibold tracking-tight text-foreground">{title}</p>
    </div>
  )
}

function Next() {
  return <p className="px-5 pb-4 pt-2 text-right text-[12px] text-muted-foreground">Próximo passo</p>
}

function LeftHandle() {
  return <Handle type="target" position={Position.Left} className="!size-3.5 !border-2 !border-[#16181d] !bg-slate-400" />
}

function NextHandle() {
  return (
    <Handle
      type="source"
      id="next"
      position={Position.Right}
      className="!right-5 !bottom-5 !top-auto !size-3.5 !border-2 !border-[#16181d] !bg-primary"
    />
  )
}

export function TrafficNode({ data, selected }: NodeProps<SalesCanvasNode>) {
  return (
    <Card selected={selected} width="w-[300px]">
      <div className="px-4 py-4 flex items-start gap-3">
        <ChannelGlyph channel={data.channel} className="size-11 shrink-0" />
        <div className="min-w-0 flex-1">
          {data.tag && (
            <span className="inline-flex rounded-full bg-white/8 px-2.5 py-0.5 text-[11px] font-semibold tracking-wide text-muted-foreground">
              {data.tag}
            </span>
          )}
          <p className="mt-2 text-[16px] font-semibold leading-snug text-foreground">{data.title}</p>
          {data.url && <p className="mt-1 text-[13px] text-primary truncate">{data.url}</p>}
        </div>
      </div>
      <Handle type="source" position={Position.Right} className="!size-3.5 !border-2 !border-[#16181d] !bg-slate-500" />
    </Card>
  )
}

export function EntryNode({ data, selected }: NodeProps<SalesCanvasNode>) {
  const trigger =
    data.entryTrigger === "popup" ? "Popup" : data.entryTrigger === "group_join" ? "Join no grupo" : data.entryTrigger === "start" ? "/start" : "Qualquer entrada"
  return (
    <Card selected={selected} accent="#4ade80">
      <Head icon={<Play className="size-5 text-emerald-300" />} title={data.title} tone="bg-emerald-400/10" />
      <div className="mx-5 mb-1 rounded-xl border border-white/8 bg-white/4 p-4">
        <p className="text-[15px] font-semibold text-foreground">{trigger}</p>
        <p className="mt-1.5 text-[14px] leading-relaxed text-muted-foreground">Entrada no mapa. A Sté não lê este bloco.</p>
      </div>
      <Next />
      <LeftHandle />
      <NextHandle />
    </Card>
  )
}

export function MessageNode({ data, selected }: NodeProps<SalesCanvasNode>) {
  return (
    <Card selected={selected} accent="#38bdf8">
      <Head icon={<MessageSquare className="size-5 text-sky-300" />} title={data.title} tone="bg-sky-400/10" />
      <div className="mx-5 mb-1 rounded-xl border border-sky-400/20 bg-sky-400/8 p-4">
        <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-foreground">{data.body}</p>
        {data.cta && (
          <div className="mt-4 rounded-full bg-sky-500 text-white text-center text-[14px] font-semibold py-2.5">{data.cta}</div>
        )}
        {data.url && <p className="mt-2.5 truncate text-[13px] text-sky-300">{data.url}</p>}
      </div>
      <Next />
      <LeftHandle />
      <NextHandle />
    </Card>
  )
}

export function WaitNode({ data, selected }: NodeProps<SalesCanvasNode>) {
  return (
    <Card selected={selected} accent="#fb923c">
      <Head icon={<Clock3 className="size-5 text-orange-300" />} title={data.title} tone="bg-orange-400/10" />
      <div className="mx-5 mb-1 rounded-xl border border-orange-400/20 bg-orange-400/8 p-4">
        <p className="text-[28px] font-semibold leading-none tracking-tight text-foreground">Espere {data.delayHours ?? 1} horas</p>
        <p className="mt-2 text-[14px] text-muted-foreground">e avance no horário {data.delayWindow || "comercial"}</p>
      </div>
      <Next />
      <LeftHandle />
      <NextHandle />
    </Card>
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
    <Card selected={selected} accent="#a78bfa" width="w-[340px]">
      <Head icon={<GitBranch className="size-5 text-violet-300" />} title={data.title} tone="bg-violet-400/10" />
      <div className="mx-5 mb-4 rounded-xl border border-white/8 bg-white/4 p-4">
        <p className="text-[15px] font-medium text-foreground">{label}</p>
        <div className="mt-3 flex justify-between text-[12px] text-muted-foreground">
          <span>Não</span>
          <span>Sim</span>
        </div>
      </div>
      <LeftHandle />
      <Handle type="source" id="no" position={Position.Bottom} className="!left-8 !size-3.5 !border-2 !border-[#16181d] !bg-slate-400" />
      <Handle type="source" id="yes" position={Position.Right} className="!size-3.5 !border-2 !border-[#16181d] !bg-emerald-400" />
    </Card>
  )
}

export function HandoffNode({ data, selected }: NodeProps<SalesCanvasNode>) {
  return (
    <Card selected={selected} accent="#f472b6">
      <Head icon={<Handshake className="size-5 text-pink-300" />} title={data.title} tone="bg-pink-400/10" />
      <div className="mx-5 mb-1 rounded-xl border border-pink-400/20 bg-pink-400/8 p-4">
        <p className="text-[15px] leading-relaxed text-foreground">{data.body || "A Sté segue o prompt interno."}</p>
      </div>
      <Next />
      <LeftHandle />
      <NextHandle />
    </Card>
  )
}

export function NotifyNode({ data, selected }: NodeProps<SalesCanvasNode>) {
  return (
    <Card selected={selected} accent="#facc15">
      <Head icon={<Bell className="size-5 text-amber-200" />} title={data.title} tone="bg-amber-400/10" />
      <div className="mx-5 mb-1 rounded-xl border border-amber-400/20 bg-amber-400/8 p-4">
        <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-amber-200">
          {data.notifyKind === "banca" ? "Banca" : "Ester"} · texto fixo
        </p>
        <p className="mt-2 text-[14px] leading-relaxed text-foreground">{data.notifyBody}</p>
      </div>
      <Next />
      <LeftHandle />
      <NextHandle />
    </Card>
  )
}

export function TagNode({ data, selected }: NodeProps<SalesCanvasNode>) {
  return (
    <Card selected={selected} accent="#64748b" width="w-[300px]">
      <Head icon={<Tag className="size-5 text-slate-200" />} title={data.title} tone="bg-white/8" />
      <div className="mx-5 mb-1 rounded-xl border border-white/8 bg-white/4 p-4">
        <p className="text-[15px] text-foreground">
          {data.tagKind === "campaign" ? `Campanha · ${data.campaignLock ?? "—"}` : `Temperatura · ${data.temperature ?? "novo"}`}
        </p>
      </div>
      <Next />
      <LeftHandle />
      <NextHandle />
    </Card>
  )
}

export function SplitNode({ data, selected }: NodeProps<SalesCanvasNode>) {
  return (
    <Card selected={selected} accent="#7C3AED" width="w-[340px]">
      <Head icon={<GitFork className="size-5 text-violet-300" />} title={data.title} tone="bg-violet-400/10" />
      <div className="mx-5 mb-4 overflow-hidden rounded-xl border border-white/8 bg-white/4">
        {(data.splits || []).map((s) => (
          <div key={s.id} className="relative flex items-center justify-between gap-3 border-b border-white/8 px-3.5 py-3 text-[14px] last:border-0">
            <span className="truncate font-medium text-foreground">
              {s.percent}% → {s.label}
            </span>
            <Handle type="source" id={s.id} position={Position.Right} className="!size-3 !border-2 !border-[#16181d] !bg-violet-500 !right-[-10px]" />
          </div>
        ))}
      </div>
      <LeftHandle />
    </Card>
  )
}

export function LandingNode({ data, selected }: NodeProps<SalesCanvasNode>) {
  return (
    <Card selected={selected} accent="#2F6BFF" width="w-[300px]">
      <div className="h-[148px] bg-gradient-to-br from-slate-800 via-slate-700 to-slate-900 relative overflow-hidden rounded-t-2xl">
        <div className="absolute inset-x-6 top-8 h-3 w-2/3 rounded bg-white/25" />
        <div className="absolute inset-x-6 top-14 h-2.5 w-full rounded bg-white/15" />
        <div className="absolute inset-x-6 top-[72px] h-2.5 w-4/5 rounded bg-white/15" />
        <div className="absolute left-6 bottom-4 rounded-full bg-orange-500 px-4 py-1.5 text-[12px] font-semibold text-white">
          {data.cta || "Abrir"}
        </div>
      </div>
      <div className="px-4 py-3.5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Landing · mapa</p>
        <p className="mt-1 text-[16px] font-semibold leading-snug text-foreground">{data.title}</p>
        {data.url && <p className="text-[13px] text-primary truncate mt-1.5">{data.url}</p>}
      </div>
      <LeftHandle />
      <Handle type="source" position={Position.Right} className="!size-3.5 !border-2 !border-[#16181d] !bg-primary" />
    </Card>
  )
}

export function OfferNode({ data, selected }: NodeProps<SalesCanvasNode>) {
  return (
    <Card selected={selected} accent="#34d399">
      <Head icon={<Zap className="size-5 text-emerald-300" />} title={data.title} tone="bg-emerald-400/10" />
      <div className="mx-5 mb-1 rounded-xl border border-emerald-400/20 bg-emerald-400/8 p-4">
        <p className="text-[15px] leading-relaxed text-foreground">{data.body || "Oferta no mapa. A Sté decide pelo prompt."}</p>
        {data.cta && (
          <div className="mt-4 rounded-full bg-emerald-500 text-[#052e16] text-center text-[14px] font-semibold py-2.5">
            {data.cta}
          </div>
        )}
      </div>
      <Next />
      <LeftHandle />
      <NextHandle />
    </Card>
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
  notify: NotifyNode,
  tag: TagNode,
  offer: OfferNode,
}
