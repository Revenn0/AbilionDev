import { useState } from "react"
import { useSearchParams } from "react-router-dom"
import { useTheme } from "next-themes"
import {
  Bell,
  Calendar,
  FileSpreadsheet,
  FormInput,
  Moon,
  Plug,
  Send,
  Settings as SettingsIcon,
  Sun,
  Webhook,
} from "lucide-react"
import { PageChrome, StatusPill } from "@/components/layout/chrome"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { useStore } from "@/lib/store"
import { cn } from "@/lib/utils"
import type { PluginId } from "@/lib/types"
import { toast } from "sonner"
import { WhatsAppGlyph } from "@/components/canvas/icons"

const TABS = [
  { id: "plugins", label: "Plugins" },
  { id: "canais", label: "Canais" },
  { id: "workspace", label: "Workspace" },
  { id: "notificacoes", label: "Notificações" },
  { id: "aparencia", label: "Aparência" },
] as const

type TabId = (typeof TABS)[number]["id"]

const PLUGINS: Array<{
  id: PluginId
  title: string
  hint: string
  soon?: boolean
  icon: typeof Plug
}> = [
  { id: "whatsapp", title: "WhatsApp Cloud", hint: "Inbox e envio pela Cloud API.", icon: Plug },
  { id: "telegram", title: "Telegram Bot", hint: "Mensagens e estado do canal.", icon: Send },
  { id: "webhooks", title: "Webhooks", hint: "Eventos para o Worker Cloudflare.", icon: Webhook },
  { id: "forms", title: "Captura", hint: "Formulários e páginas de captura.", icon: FormInput },
  { id: "reports", title: "Relatórios", hint: "Exportações e resumos da operação.", icon: FileSpreadsheet },
  { id: "calendar", title: "Agenda", hint: "Lembretes e follow-up. Em breve.", icon: Calendar, soon: true },
]

export function SettingsPage() {
  const [params, setParams] = useSearchParams()
  const raw = params.get("tab")
  const tab: TabId = TABS.some((item) => item.id === raw) ? (raw as TabId) : "plugins"

  const setTab = (next: TabId) => {
    const copy = new URLSearchParams(params)
    if (next === "plugins") copy.delete("tab")
    else copy.set("tab", next)
    setParams(copy, { replace: true })
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="page-shell">
        <PageChrome icon={SettingsIcon} title="Configurações" />

        <div className="flex flex-wrap gap-1 rounded-full bg-card p-1 w-fit">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={cn(
                "h-8 rounded-full px-3.5 text-[12.5px] font-medium",
                tab === item.id ? "bg-background text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {item.label}
            </button>
          ))}
        </div>

        {tab === "plugins" && <PluginsPane />}
        {tab === "canais" && <ChannelsPane />}
        {tab === "workspace" && <WorkspacePane />}
        {tab === "notificacoes" && <NotifyPane />}
        {tab === "aparencia" && <ThemePane />}
      </div>
    </div>
  )
}

function PluginsPane() {
  const { state, togglePlugin } = useStore()
  const on = Object.values(state.settings.plugins).filter(Boolean).length

  return (
    <section>
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <p className="text-[14px] font-medium">Plugins</p>
          <p className="mt-0.5 text-[12.5px] text-muted-foreground">Liga só o que a operação precisa. Nada corre sozinho ainda.</p>
        </div>
        <p className="text-[12.5px] text-muted-foreground">{on} ligados</p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {PLUGINS.map((plugin) => {
          const enabled = state.settings.plugins[plugin.id]
          const Icon = plugin.icon
          return (
            <article key={plugin.id} className="surface flex items-start gap-3.5 p-5">
              <div className="grid size-10 shrink-0 place-items-center rounded-2xl bg-muted">
                {plugin.id === "whatsapp" ? <WhatsAppGlyph className="size-5" /> : <Icon className="size-4" strokeWidth={1.75} />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[14px] font-medium">{plugin.title}</p>
                    <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">{plugin.hint}</p>
                  </div>
                  {plugin.soon ? (
                    <StatusPill>Em breve</StatusPill>
                  ) : (
                    <Switch
                      checked={enabled}
                      onCheckedChange={() => {
                        togglePlugin(plugin.id)
                        toast.success(enabled ? `${plugin.title} desligado.` : `${plugin.title} ligado.`)
                      }}
                      aria-label={`Ligar ${plugin.title}`}
                    />
                  )}
                </div>
                {!plugin.soon && (
                  <div className="mt-3">
                    <StatusPill tone={enabled ? "success" : "muted"}>{enabled ? "Ligado" : "Desligado"}</StatusPill>
                  </div>
                )}
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}

function ChannelsPane() {
  const { state } = useStore()
  const channels = [
    {
      id: "whatsapp" as const,
      title: "WhatsApp",
      hint: "Cloud API para inbox e envio.",
      on: state.settings.plugins.whatsapp,
    },
    {
      id: "telegram" as const,
      title: "Telegram",
      hint: "Bot e webhooks do canal.",
      on: state.settings.plugins.telegram,
    },
  ]

  return (
    <section className="grid gap-3">
      {channels.map((channel) => (
        <article key={channel.id} className="surface flex flex-wrap items-center justify-between gap-4 p-5">
          <div>
            <p className="text-[14px] font-medium">{channel.title}</p>
            <p className="mt-1 text-[12.5px] text-muted-foreground">{channel.hint}</p>
            <div className="mt-3">
              <StatusPill tone={channel.on ? "warn" : "muted"}>
                {channel.on ? "Plugin ligado · canal por configurar" : "Plugin desligado"}
              </StatusPill>
            </div>
          </div>
          <Button variant="outline" className="rounded-full" disabled>
            Configurar
          </Button>
        </article>
      ))}
      <p className="text-[12.5px] text-muted-foreground">
        Tokens e webhooks ficam no Cloudflare (`wrangler secret put`). Este recorte ainda não liga o canal.
      </p>
    </section>
  )
}

function WorkspacePane() {
  const { state, saveSettings } = useStore()
  const [name, setName] = useState(state.settings.workspaceName)
  const [timezone, setTimezone] = useState(state.settings.timezone)

  return (
    <section className="surface max-w-xl p-6">
      <p className="text-[14px] font-medium">Workspace</p>
      <p className="mt-1 text-[12.5px] text-muted-foreground">Nome e fuso usados nos relatórios e no quadro.</p>
      <form
        className="mt-5 space-y-4"
        onSubmit={(event) => {
          event.preventDefault()
          const next = name.trim() || "Abilion"
          saveSettings({ workspaceName: next, timezone })
          toast.success("Workspace actualizado.")
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="workspace-name">Nome</Label>
          <Input id="workspace-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={60} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="workspace-tz">Fuso horário</Label>
          <Input id="workspace-tz" value={timezone} onChange={(event) => setTimezone(event.target.value)} />
        </div>
        <Button type="submit" className="rounded-full">
          Guardar
        </Button>
      </form>
    </section>
  )
}

function NotifyPane() {
  const { state, saveSettings } = useStore()
  const rows = [
    { key: "notifyNewLead" as const, title: "Novo lead", hint: "Quando um contacto entra na base." },
    { key: "notifyConversation" as const, title: "Conversa iniciada", hint: "Primeiro contacto no inbox." },
    { key: "notifyChannelFail" as const, title: "Falha de canal", hint: "WhatsApp ou Telegram sem responder." },
  ]

  return (
    <section className="surface divide-y divide-border overflow-hidden">
      {rows.map((row) => (
        <label key={row.key} className="flex cursor-pointer items-center justify-between gap-4 px-5 py-4">
          <span>
            <span className="flex items-center gap-2 text-[14px] font-medium">
              <Bell className="size-3.5 text-muted-foreground" />
              {row.title}
            </span>
            <span className="mt-1 block text-[12.5px] text-muted-foreground">{row.hint}</span>
          </span>
          <Switch
            checked={state.settings[row.key]}
            onCheckedChange={(checked) => saveSettings({ [row.key]: checked })}
            aria-label={row.title}
          />
        </label>
      ))}
    </section>
  )
}

function ThemePane() {
  const { resolvedTheme, setTheme } = useTheme()
  const dark = resolvedTheme !== "light"

  return (
    <section className="grid gap-3 sm:grid-cols-2">
      <button
        type="button"
        onClick={() => setTheme("dark")}
        className={cn("surface p-5 text-left", dark && "ring-1 ring-foreground/20")}
      >
        <Moon className="size-4 text-muted-foreground" />
        <p className="mt-3 text-[14px] font-medium">Escuro</p>
        <p className="mt-1 text-[12.5px] text-muted-foreground">O tema do painel de operação.</p>
      </button>
      <button
        type="button"
        onClick={() => setTheme("light")}
        className={cn("surface p-5 text-left", !dark && "ring-1 ring-foreground/20")}
      >
        <Sun className="size-4 text-muted-foreground" />
        <p className="mt-3 text-[14px] font-medium">Claro</p>
        <p className="mt-1 text-[12.5px] text-muted-foreground">Mesma grelha, fundo claro.</p>
      </button>
    </section>
  )
}
