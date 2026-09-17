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
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { useStore } from "@/lib/store"
import { cn } from "@/lib/utils"
import type { PluginId } from "@/lib/types"
import { toast } from "sonner"
import { WhatsAppGlyph } from "@/components/canvas/icons"

const TABS = [
  { id: "bot", label: "Bot Telegram" },
  { id: "ste", label: "Agente Sté" },
  { id: "ester", label: "Ester" },
  { id: "plugins", label: "Plugins" },
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
  { id: "telegram", title: "Telegram Bot", hint: "Token, grupo e join → lead da campanha.", icon: Send },
  { id: "whatsapp", title: "WhatsApp Cloud", hint: "Inbox e o mesmo agente Sté.", icon: Plug },
  { id: "forms", title: "Captura", hint: "Popup do mini curso da Stefany para o CRM.", icon: FormInput },
  { id: "webhooks", title: "Webhooks", hint: "Eventos para o Worker já existente.", icon: Webhook },
  { id: "reports", title: "Relatórios", hint: "Exportações da operação.", icon: FileSpreadsheet },
  { id: "calendar", title: "Agenda", hint: "Oferta 3–4 dias depois do print. Em breve.", icon: Calendar, soon: true },
]

function readTab(params: URLSearchParams): TabId {
  const raw = params.get("tab")
  return TABS.some((item) => item.id === raw) ? (raw as TabId) : "bot"
}

export function SettingsPage() {
  const [params, setParams] = useSearchParams()
  const [tab, setTab] = useState<TabId>(() => readTab(params))

  const go = (next: TabId) => {
    setTab(next)
    const copy = new URLSearchParams(params)
    if (next === "bot") copy.delete("tab")
    else copy.set("tab", next)
    setParams(copy, { replace: true })
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="page-shell">
        <PageChrome icon={SettingsIcon} title="Configurações" />

        <div className="flex w-fit flex-wrap gap-1 rounded-full bg-card p-1">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => go(item.id)}
              className={cn(
                "h-8 rounded-full px-3.5 text-[12.5px] font-medium",
                tab === item.id ? "bg-background text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {item.label}
            </button>
          ))}
        </div>

        {tab === "bot" && <BotPane />}
        {tab === "ste" && <StePane />}
        {tab === "ester" && <EsterPane />}
        {tab === "plugins" && <PluginsPane />}
        {tab === "notificacoes" && <NotifyPane />}
        {tab === "aparencia" && <ThemePane />}
      </div>
    </div>
  )
}

function BotPane() {
  const { state, saveSettings, togglePlugin } = useStore()
  const [username, setUsername] = useState(state.settings.telegramBotUsername)
  const [token, setToken] = useState(state.settings.telegramBotToken)
  const [group, setGroup] = useState(state.settings.telegramGroupUrl)

  return (
    <section className="surface max-w-xl p-6">
      <p className="text-[14px] font-medium">Vincular o bot</p>
      <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
        Pedido do sócio: tráfego → land → botão Telegram → boas-vindas e a pessoa no grupo. O token fica só neste
        browser — não vai para o git.
      </p>
      <form
        className="mt-5 space-y-4"
        onSubmit={(event) => {
          event.preventDefault()
          saveSettings({
            telegramBotUsername: username.trim() || "@vjungerfkaaiii_bot",
            telegramBotToken: token.trim(),
            telegramGroupUrl: group.trim(),
          })
          if (token.trim() && !state.settings.plugins.telegram) togglePlugin("telegram")
          toast.success("Bot guardado neste browser.")
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="bot-user">Username</Label>
          <Input id="bot-user" value={username} onChange={(event) => setUsername(event.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="bot-token">Token</Label>
          <Input
            id="bot-token"
            type="password"
            autoComplete="off"
            value={token}
            onChange={(event) => setToken(event.target.value)}
            placeholder="Cola o token. Não partilhes no chat."
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="bot-group">Convite do grupo / canal</Label>
          <Input
            id="bot-group"
            value={group}
            onChange={(event) => setGroup(event.target.value)}
            placeholder="https://t.me/..."
          />
        </div>
        <div className="flex items-center gap-2">
          <StatusPill tone={state.settings.telegramBotToken ? "success" : "muted"}>
            {state.settings.telegramBotToken ? "Token presente" : "Sem token"}
          </StatusPill>
          <StatusPill>Webhook por ligar</StatusPill>
        </div>
        <Button type="submit" className="rounded-full">
          Vincular
        </Button>
      </form>
    </section>
  )
}

function StePane() {
  const { state, saveSettings } = useStore()
  const [welcome, setWelcome] = useState(state.settings.steWelcome)

  return (
    <section className="surface max-w-xl space-y-5 p-6">
      <div>
        <p className="text-[14px] font-medium">Sté · atendimento</p>
        <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
          A Sté fala como pessoa. O mesmo agente no Telegram e no WhatsApp: boas-vindas + material. Memória é por lead.
        </p>
      </div>
      <label className="flex items-center justify-between gap-4">
        <span className="text-[13.5px]">Vincular no Telegram</span>
        <Switch
          checked={state.settings.steLinkedTelegram}
          onCheckedChange={(checked) => saveSettings({ steLinkedTelegram: checked })}
          aria-label="Vincular Sté no Telegram"
        />
      </label>
      <label className="flex items-center justify-between gap-4">
        <span className="text-[13.5px]">Vincular no WhatsApp</span>
        <Switch
          checked={state.settings.steLinkedWhatsapp}
          onCheckedChange={(checked) => saveSettings({ steLinkedWhatsapp: checked })}
          aria-label="Vincular Sté no WhatsApp"
        />
      </label>
      <div className="space-y-1.5">
        <Label htmlFor="ste-welcome">Boas-vindas</Label>
        <Textarea id="ste-welcome" value={welcome} onChange={(event) => setWelcome(event.target.value)} className="min-h-28" />
      </div>
      <Button
        className="rounded-full"
        onClick={() => {
          saveSettings({ steWelcome: welcome })
          toast.success("Sté actualizada.")
        }}
      >
        Guardar
      </Button>
    </section>
  )
}

function EsterPane() {
  const { state, saveSettings } = useStore()

  return (
    <section className="surface max-w-xl space-y-4 p-6">
      <p className="text-[14px] font-medium">Ester</p>
      <p className="text-[12.5px] leading-relaxed text-muted-foreground">
        Humana da casa. Quando o lead manda print do cadastro, ela envia a banca. O bot e a Sté não inventam isso.
      </p>
      <label className="flex items-center justify-between gap-4">
        <span>
          <span className="block text-[13.5px] font-medium">Avisar a Ester no print</span>
          <span className="mt-1 block text-[12.5px] text-muted-foreground">Fila no dashboard e no lead.</span>
        </span>
        <Switch
          checked={state.settings.esterNotify}
          onCheckedChange={(checked) => saveSettings({ esterNotify: checked, notifyPrint: checked })}
          aria-label="Avisar a Ester"
        />
      </label>
    </section>
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
          <p className="mt-0.5 text-[12.5px] text-muted-foreground">Liga o que a operação precisa. Nada dispara sozinho ainda.</p>
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

function NotifyPane() {
  const { state, saveSettings } = useStore()
  const rows = [
    { key: "notifyNewLead" as const, title: "Novo lead", hint: "Popup, join ou /start a entrar no CRM." },
    { key: "notifyConversation" as const, title: "Conversa iniciada", hint: "Sté no 1:1." },
    { key: "notifyPrint" as const, title: "Print do cadastro", hint: "Aviso para a Ester enviar a banca." },
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
