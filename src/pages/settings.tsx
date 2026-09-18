import { useEffect, useState } from "react"
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
import { cleanBotUsername } from "@/lib/migrate"
import { useStore } from "@/lib/store"
import { fetchHealth, workerUrl } from "@/lib/channel"
import { fetchRuntime, saveRuntime, type RuntimeStatus } from "@/lib/runtime-api"
import { STE_LLM_MODEL, STE_LLM_MODELS, normalizeSteModel } from "@/lib/llm"
import { adsDeepLink } from "@/lib/telegram-start"
import { STE_REMARKETING_BLOCK, STE_WELCOME } from "@/lib/ste"
import { cn } from "@/lib/utils"
import type { PluginId } from "@/lib/types"
import { toast } from "sonner"

const TABS = [
  { id: "bot", label: "Bot Telegram" },
  { id: "ste", label: "Agente Sté" },
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
  { id: "telegram", title: "Telegram Bot", hint: "Token no Worker, webhook e Sté no 1:1.", icon: Send },
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
        {tab === "plugins" && <PluginsPane />}
        {tab === "notificacoes" && <NotifyPane />}
        {tab === "aparencia" && <ThemePane />}
      </div>
    </div>
  )
}

function BotPane() {
  const { state, saveSettings } = useStore()
  const [username, setUsername] = useState(state.settings.telegramBotUsername)
  const [token, setToken] = useState("")
  const [group, setGroup] = useState(state.settings.telegramGroupUrl)
  const [glm, setGlm] = useState("")
  const [model, setModel] = useState(STE_LLM_MODEL)
  const [busy, setBusy] = useState(false)
  const [health, setHealth] = useState<Awaited<ReturnType<typeof fetchHealth>>>({ ok: false })
  const [runtime, setRuntime] = useState<RuntimeStatus>({ ok: false })
  const origin = workerUrl()
  const hook = runtime.webhook || `${origin}/api/telegram`
  const pixel = `<script src="${origin}/t.js" data-cta="[data-abilion-cta]"></script>`
  const ads = adsDeepLink(cleanBotUsername(username) || runtime.telegramBotUsername || state.settings.telegramBotUsername)

  const refresh = async () => {
    const [nextHealth, nextRuntime] = await Promise.all([fetchHealth(), fetchRuntime()])
    setHealth(nextHealth)
    setRuntime(nextRuntime)
    if (nextRuntime.telegramBotUsername) setUsername(nextRuntime.telegramBotUsername)
    if (nextRuntime.telegramGroupUrl) setGroup(nextRuntime.telegramGroupUrl)
    if (nextRuntime.model) setModel(normalizeSteModel(nextRuntime.model))
  }

  useEffect(() => {
    void refresh()
  }, [])

  return (
    <div className="grid max-w-3xl gap-3">
      <section className="surface p-6">
        <p className="text-[14px] font-medium">Telegram em produção</p>
        <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
          Vincular grava o token no Worker e aponta o webhook. A Sté passa a responder no Telegram. O token não fica no
          browser nem no git.
        </p>
        <div className="mt-4 flex flex-wrap gap-1.5">
          <StatusPill tone={runtime.telegram || (health.ok && health.telegram) ? "success" : "muted"}>
            Telegram · {runtime.telegram || health.telegram ? "ligado" : "à espera do token"}
          </StatusPill>
          <StatusPill tone={runtime.webhookOk ? "success" : "muted"}>
            Webhook · {runtime.webhookOk ? "activo" : "ainda não apontado"}
          </StatusPill>
          <StatusPill tone={runtime.telegramBotUsername || username ? "success" : "muted"}>
            {runtime.telegramBotUsername || username || "Username vazio"}
          </StatusPill>
          <StatusPill tone={runtime.tokenHint ? "success" : "muted"}>
            {runtime.tokenHint ? `Token ${runtime.tokenHint}` : "Sem token no Worker"}
          </StatusPill>
          <StatusPill tone={runtime.llm || health.llm ? "success" : "muted"}>
            IA · {runtime.llm || health.llm ? runtime.model || health.model || "ligada" : "script da Sté"}
          </StatusPill>
          <StatusPill tone={health.persist === "kv" || health.persist === "supabase" ? "success" : "muted"}>
            Leads · {health.persist === "supabase" ? "Supabase" : "Worker"}
          </StatusPill>
        </div>
        <dl className="mt-5 space-y-2 text-[12.5px]">
          <div className="flex flex-wrap justify-between gap-2">
            <dt className="text-muted-foreground">Webhook</dt>
            <dd className="break-all font-medium">{hook}</dd>
          </div>
          {ads && (
            <div className="flex flex-wrap justify-between gap-2">
              <dt className="text-muted-foreground">Anúncio Facebook</dt>
              <dd className="break-all font-medium">{ads}</dd>
            </div>
          )}
          {(runtime.telegramGroupUrl || state.settings.telegramGroupUrl) && (
            <div className="flex flex-wrap justify-between gap-2">
              <dt className="text-muted-foreground">Grupo</dt>
              <dd className="break-all font-medium">{runtime.telegramGroupUrl || state.settings.telegramGroupUrl}</dd>
            </div>
          )}
        </dl>
        <form
          className="mt-5 space-y-4"
          onSubmit={(event) => {
            event.preventDefault()
            setBusy(true)
            const cleanUser = cleanBotUsername(username)
            void saveRuntime({
              telegramBotUsername: cleanUser,
              telegramGroupUrl: group.trim(),
              ...(token.trim() ? { telegramBotToken: token.trim() } : {}),
              ...(glm.trim() ? { openaiApiKey: glm.trim() } : {}),
              steModel: model,
            })
              .then((next) => {
                setRuntime(next)
                setToken("")
                setGlm("")
                saveSettings({
                  telegramBotUsername: next.telegramBotUsername || cleanUser,
                  telegramGroupUrl: next.telegramGroupUrl || group.trim(),
                  telegramBotToken: "",
                  plugins: { ...state.settings.plugins, telegram: Boolean(next.telegram) },
                })
                void fetchHealth().then(setHealth)
                toast.success(next.telegram ? "Telegram ligado no Worker." : "Username gravado. Falta o token.")
              })
              .catch((error: Error) => {
                toast.error(error.message)
              })
              .finally(() => setBusy(false))
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="bot-user">Username</Label>
            <Input
              id="bot-user"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="@teu_bot"
              autoComplete="off"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bot-token">Token do bot</Label>
            <Input
              id="bot-token"
              type="password"
              autoComplete="off"
              value={token}
              onChange={(event) => setToken(event.target.value)}
              placeholder={runtime.tokenHint ? `Já gravado ${runtime.tokenHint}. Cola outro para trocar.` : "Cola o token do BotFather"}
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
          <div className="space-y-1.5">
            <Label htmlFor="bot-model">Modelo OpenRouter</Label>
            <select
              id="bot-model"
              value={model}
              onChange={(event) => setModel(normalizeSteModel(event.target.value))}
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
            >
              {STE_LLM_MODELS.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
            <p className="text-[12px] text-muted-foreground">
              {STE_LLM_MODELS.find((item) => item.id === model)?.hint}
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bot-glm">Chave OpenRouter</Label>
            <Input
              id="bot-glm"
              type="password"
              autoComplete="off"
              value={glm}
              onChange={(event) => setGlm(event.target.value)}
              placeholder={runtime.llm ? "IA já ligada. Cola outra chave para trocar." : "Cola a chave sk-or-v1…"}
            />
          </div>
          {ads && <p className="break-all text-[12px] text-muted-foreground">Anúncio Facebook · {ads}</p>}
          <p className="break-all text-[12px] text-muted-foreground">Webhook · {hook}</p>
          <Button type="submit" className="rounded-full" disabled={busy}>
            {busy ? "A ligar…" : "Vincular Telegram"}
          </Button>
        </form>
      </section>
      <section className="surface p-6">
        <p className="text-[14px] font-medium">Pixel da landing</p>
        <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
          Cola isto na página para onde o Facebook manda o lead. No botão de Telegram usa{" "}
          <code className="text-foreground">data-abilion-cta</code>. O script grava visita, clique, bandeira e UF. O{" "}
          <code className="text-foreground">fb_vid</code> fecha o /start no mesmo visitante.
        </p>
        <p className="mt-3 text-[12.5px] text-muted-foreground">
          Landing de teste desta origem:{" "}
          <a className="font-medium text-foreground underline-offset-2 hover:underline" href={`${origin}/l`}>
            {origin}/l
          </a>
        </p>
        <pre className="mt-4 overflow-x-auto rounded-xl bg-muted px-4 py-3 text-[12px] leading-relaxed">{pixel}</pre>
        <Button
          type="button"
          variant="outline"
          className="mt-3 rounded-full"
          onClick={() => {
            void navigator.clipboard.writeText(pixel)
            toast.success("Snippet copiado.")
          }}
        >
          Copiar snippet
        </Button>
      </section>
    </div>
  )
}

function StePane() {
  const { state, saveSettings } = useStore()
  const [w1, setW1] = useState(state.settings.steWelcomeLines[0] || STE_WELCOME[0])
  const [w2, setW2] = useState(state.settings.steWelcomeLines[1] || STE_WELCOME[1])
  const [w3, setW3] = useState(state.settings.steWelcomeLines[2] || STE_WELCOME[2])
  const [remark, setRemark] = useState((state.settings.steRemarketingLines.length ? state.settings.steRemarketingLines : STE_REMARKETING_BLOCK).join("\n"))

  return (
    <section className="surface max-w-xl space-y-5 p-6">
      <div>
        <p className="text-[14px] font-medium">Sté · Telegram</p>
        <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
          Um bot no Telegram. Fora dele, cada lead tem o próprio cérebro. As 3 boas-vindas saem no /start e esperam. Às 7 h
          ela oferece o Grupo Premium. Se silenciar, essa instância morre — sem segundo bot.
        </p>
      </div>
      <label className="flex items-center justify-between gap-4">
        <span className="text-[13.5px]">Sté a falar no Telegram</span>
        <Switch
          checked={state.settings.steLinkedTelegram}
          onCheckedChange={(checked) => saveSettings({ steLinkedTelegram: checked })}
          aria-label="Sté no Telegram"
        />
      </label>
      <label className="flex items-center justify-between gap-4">
        <span>
          <span className="block text-[13.5px]">Silenciar depois do remarketing</span>
          <span className="mt-1 block text-[12.5px] text-muted-foreground">Oferece o Premium às 7 h e para de responder.</span>
        </span>
        <Switch
          checked={state.settings.steDieAfterRemarketing}
          onCheckedChange={(checked) => saveSettings({ steDieAfterRemarketing: checked })}
          aria-label="Silenciar depois do remarketing"
        />
      </label>
      <div className="space-y-1.5">
        <Label htmlFor="ste-w1">Boas-vindas 1</Label>
        <Textarea id="ste-w1" value={w1} onChange={(event) => setW1(event.target.value)} rows={2} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ste-w2">Boas-vindas 2</Label>
        <Textarea id="ste-w2" value={w2} onChange={(event) => setW2(event.target.value)} rows={2} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ste-w3">Boas-vindas 3</Label>
        <Textarea id="ste-w3" value={w3} onChange={(event) => setW3(event.target.value)} rows={3} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ste-remark">Follow-up 7 horas (uma linha por bloco)</Label>
        <Textarea id="ste-remark" value={remark} onChange={(event) => setRemark(event.target.value)} rows={6} />
      </div>
      <Button
        className="rounded-full"
        onClick={() => {
          saveSettings({
            steWelcomeLines: [w1.trim() || STE_WELCOME[0], w2.trim() || STE_WELCOME[1], w3.trim() || STE_WELCOME[2]],
            steWelcome: w1.trim() || STE_WELCOME[0],
            steRemarketingLines: remark.split("\n").map((item) => item.trim()).filter(Boolean),
          })
          toast.success("Cópia da Sté gravada.")
        }}
      >
        Guardar mensagens
      </Button>
    </section>
  )
}

function PluginsPane() {
  const { state, togglePlugin } = useStore()
  const on = Object.entries(state.settings.plugins).filter(([id, value]) => id !== "whatsapp" && value).length

  return (
    <section>
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <p className="text-[14px] font-medium">Plugins</p>
          <p className="mt-0.5 text-[12.5px] text-muted-foreground">O canal activo é o Telegram. O resto entra no mesmo grafo.</p>
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
                <Icon className="size-4" strokeWidth={1.75} />
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
    { key: "notifyNewLead" as const, title: "Novo lead", hint: "Facebook, popup, join ou /start a entrar no CRM." },
    { key: "notifyConversation" as const, title: "Conversa iniciada", hint: "Sté no Telegram 1:1." },
    { key: "notifyPrint" as const, title: "Print do cadastro", hint: "Aviso interno quando o print entra no fluxo." },
    { key: "notifyChannelFail" as const, title: "Falha de canal", hint: "Telegram sem responder." },
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
