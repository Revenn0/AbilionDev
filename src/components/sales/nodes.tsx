import { Handle, Position, type Node, type NodeProps } from "@xyflow/react"
import { Clock3, GitFork, Mail, Send, Zap } from "lucide-react"
import { GoogleGlyph, InstagramGlyph, MetaGlyph, OrganicGlyph, WhatsAppGlyph, YouTubeGlyph } from "@/components/canvas/icons"
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
  children,
  accent,
  width = "w-[400px]",
}: {
  selected?: boolean
  children: React.ReactNode
  accent?: string
  width?: string
}) {
  return (
    <div
      className={cn(
        width,
        "rounded-2xl border border-border bg-card shadow-[0_18px_40px_-24px_rgba(0,0,0,0.55)]",
        selected ? "border-primary ring-2 ring-primary/25" : "border-white/10"
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

export function TriggerNode({ data, selected }: NodeProps<SalesCanvasNode>) {
  return (
    <Card selected={selected} accent="#4ade80">
      <Head icon={<Zap className="size-5 text-emerald-300" />} title={data.title} tone="bg-emerald-400/10" />
      <div className="mx-5 mb-1 rounded-xl border border-white/8 bg-white/4 p-4">
        <p className="text-[15px] font-semibold text-foreground">{data.triggerLabel}</p>
        <p className="mt-1.5 text-[14px] leading-relaxed text-muted-foreground">{data.body}</p>
      </div>
      <Next />
      <LeftHandle />
      <NextHandle />
    </Card>
  )
}

export function WhatsappNode({ data, selected }: NodeProps<SalesCanvasNode>) {
  return (
    <Card selected={selected} accent="#25d366">
      <Head icon={<WhatsAppGlyph className="size-6" />} title={data.title} tone="bg-[#25d366]/12" />
      <div className="mx-5 mb-1 rounded-xl border border-[#25d366]/25 bg-[#25d366]/8 p-4">
        <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-foreground">{data.body}</p>
        {data.cta && (
          <div className="mt-4 rounded-full bg-[#25d366] text-[#052e16] text-center text-[14px] font-semibold py-2.5">
            {data.cta}
          </div>
        )}
        {data.url && <p className="mt-2.5 truncate text-[13px] text-emerald-300">{data.url}</p>}
      </div>
      <Next />
      <LeftHandle />
      <NextHandle />
    </Card>
  )
}

export function TelegramNode({ data, selected }: NodeProps<SalesCanvasNode>) {
  return (
    <Card selected={selected} accent="#38bdf8">
      <Head icon={<Send className="size-5 text-sky-300" />} title={data.title} tone="bg-sky-400/10" />
      <div className="mx-5 mb-1 rounded-xl border border-sky-400/20 bg-sky-400/8 p-4">
        <p className="text-[15px] leading-relaxed text-foreground">{data.body}</p>
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

export function EmailNode({ data, selected }: NodeProps<SalesCanvasNode>) {
  return (
    <Card selected={selected} accent="#2F6BFF">
      <Head icon={<Mail className="size-5 text-sky-200" />} title={data.title} tone="bg-sky-400/10" />
      <div className="mx-5 mb-1 space-y-3 rounded-xl border border-white/8 bg-white/4 p-4 text-[14px]">
        <p className="text-foreground">
          <span className="text-muted-foreground">De </span>
          <span className="font-medium">{data.fromEmail}</span>
        </p>
        <p className="text-[16px] font-semibold leading-snug text-foreground">{data.subject}</p>
        <p className="text-[15px] leading-relaxed text-muted-foreground">{data.body}</p>
        {data.url && <p className="text-primary truncate text-[13px]">{data.url}</p>}
      </div>
      <Next />
      <LeftHandle />
      <NextHandle />
    </Card>
  )
}

export function DelayNode({ data, selected }: NodeProps<SalesCanvasNode>) {
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

export function SalesPageNode({ data, selected }: NodeProps<SalesCanvasNode>) {
  return (
    <Card selected={selected} accent="#2F6BFF" width="w-[300px]">
      <div className="h-[148px] bg-gradient-to-br from-slate-800 via-slate-700 to-slate-900 relative overflow-hidden rounded-t-2xl">
        <div className="absolute inset-x-6 top-8 h-3 w-2/3 rounded bg-white/25" />
        <div className="absolute inset-x-6 top-14 h-2.5 w-full rounded bg-white/15" />
        <div className="absolute inset-x-6 top-[72px] h-2.5 w-4/5 rounded bg-white/15" />
        <div className="absolute left-6 bottom-4 rounded-full bg-orange-500 px-4 py-1.5 text-[12px] font-semibold text-white">
          {data.cta || "Ver oferta"}
        </div>
      </div>
      <div className="px-4 py-3.5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Página de vendas</p>
        <p className="mt-1 text-[16px] font-semibold leading-snug text-foreground">{data.title}</p>
        {data.url && <p className="text-[13px] text-primary truncate mt-1.5">{data.url}</p>}
      </div>
      <LeftHandle />
      <Handle type="source" position={Position.Right} className="!size-3.5 !border-2 !border-[#16181d] !bg-primary" />
    </Card>
  )
}

export const salesNodeTypes = {
  traffic: TrafficNode,
  trigger: TriggerNode,
  whatsapp: WhatsappNode,
  telegram: TelegramNode,
  email: EmailNode,
  delay: DelayNode,
  split: SplitNode,
  sales_page: SalesPageNode,
}
