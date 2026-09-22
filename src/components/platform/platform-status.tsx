import { StatusPill } from "@/components/layout/chrome"
import type {
  AudioStatus,
  BotStatus,
  IntegrationStatus,
  VersionStatus,
} from "@/lib/platform"

type Tone = "success" | "warn" | "danger" | "muted"

const BOT_STATUS: Record<BotStatus, { label: string; tone: Tone }> = {
  draft: { label: "Rascunho", tone: "muted" },
  active: { label: "Ativo", tone: "success" },
  paused: { label: "Pausado", tone: "warn" },
  error: { label: "Com erro", tone: "danger" },
  archived: { label: "Arquivado", tone: "muted" },
}

const INTEGRATION_STATUS: Record<IntegrationStatus, { label: string; tone: Tone }> = {
  disconnected: { label: "Desligada", tone: "muted" },
  pending: { label: "Pendente", tone: "warn" },
  connected: { label: "Ligada", tone: "success" },
  error: { label: "Com erro", tone: "danger" },
  retired: { label: "Retirada", tone: "muted" },
}

const VERSION_STATUS: Record<VersionStatus, { label: string; tone: Tone }> = {
  draft: { label: "Rascunho", tone: "muted" },
  testing: { label: "Em teste", tone: "warn" },
  published: { label: "Publicada", tone: "success" },
  archived: { label: "Arquivada", tone: "muted" },
}

const AUDIO_STATUS: Record<AudioStatus, { label: string; tone: Tone }> = {
  waiting: { label: "Em espera", tone: "muted" },
  uploading: { label: "A enviar", tone: "warn" },
  processing: { label: "A processar", tone: "warn" },
  completed: { label: "Concluído", tone: "success" },
  error: { label: "Com erro", tone: "danger" },
  cancelled: { label: "Cancelado", tone: "muted" },
}

export function BotStatusPill({ status }: { status: BotStatus }) {
  const item = BOT_STATUS[status]
  return <StatusPill tone={item.tone}>{item.label}</StatusPill>
}

export function IntegrationStatusPill({ status }: { status: IntegrationStatus }) {
  const item = INTEGRATION_STATUS[status]
  return <StatusPill tone={item.tone}>{item.label}</StatusPill>
}

export function VersionStatusPill({ status }: { status: VersionStatus }) {
  const item = VERSION_STATUS[status]
  return <StatusPill tone={item.tone}>{item.label}</StatusPill>
}

export function AudioStatusPill({ status }: { status: AudioStatus }) {
  const item = AUDIO_STATUS[status]
  return <StatusPill tone={item.tone}>{item.label}</StatusPill>
}
