import { useEffect, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { useTheme } from "next-themes"
import {
  Bell,
  Calendar,
  FileSpreadsheet,
  FormInput,
  Moon,
  KeyRound,
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
import { cleanBotUsername } from "@/lib/migrate"
import { useStore } from "@/lib/store"
import { changePasswordRequest } from "@/lib/auth-api"
import { fetchHealth, workerUrl } from "@/lib/channel"
import { fetchRuntime, prepareVoice, saveRuntime, type RuntimeStatus } from "@/lib/runtime-api"
import { STE_LLM_FALLBACK, STE_LLM_MODEL, STE_LLM_MODELS, normalizeSteModel } from "@/lib/llm"
import { STE_VOICE_CLIPS } from "@/lib/ste-voice"
import { adsDeepLink } from "@/lib/telegram-start"
import { cn } from "@/lib/utils"
import type { PluginId } from "@/lib/types"
import { toast } from "sonner"

const TABS = [
  { id: "bot", label: "Bot Telegram" },
  { id: "conta", label: "Conta" },
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
        {tab === "conta" && <AccountPane />}
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
  const [elevenKey, setElevenKey] = useState("")
  const [voiceId, setVoiceId] = useState("")
  const [model, setModel] = useState(STE_LLM_MODEL)
  const [busy, setBusy] = useState(false)
  const [voiceBusy, setVoiceBusy] = useState(false)
  const [runtimeLoaded, setRuntimeLoaded] = useState(false)
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
    setRuntimeLoaded(true)
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
          Vincular grava o token no Worker e aponta o webhook. O que a Sté fala fica no funil publicado — não aqui. O
          token não fica no browser nem no git.
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
            IA · {runtime.llm || health.llm ? runtime.model || health.model || "deepseek-v4.1-flash" : "script da Sté"}
          </StatusPill>
          <StatusPill>
            Reserva · {runtime.fallbackModel || health.backup || STE_LLM_MODEL}
          </StatusPill>
          <StatusPill tone={health.persist === "kv" || health.persist === "supabase" ? "success" : "muted"}>
            Leads · {health.persist === "supabase" ? "Supabase" : "Worker"}
          </StatusPill>
          <StatusPill tone={runtime.voice ? "success" : "muted"}>
            Voz · {runtime.voice ? runtime.voiceHint || "ElevenLabs" : "texto"}
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
              steFallbackModel: STE_LLM_FALLBACK,
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
              A Sté fala primeiro com DeepSeek V4.1 Flash no OpenCode. Se cair, usa este modelo no OpenRouter e depois o
              DeepSeek V4 Flash.
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
              placeholder={runtime.llm ? "IA já ligada. Cola outra chave sk-or-v1… para trocar." : "Cola a chave sk-or-v1…"}
            />
          </div>
          <p className="text-[12.5px] leading-relaxed text-muted-foreground">
            Boas-vindas, minicurso, Superbet, remarketing e o silêncio depois das 7 h editam-se no{" "}
            <Link className="font-medium text-foreground underline-offset-2 hover:underline" to="/fluxo">
              template do funil
            </Link>
            . Publica o quadro para a Sté falar essa cópia.
          </p>
          {ads && <p className="break-all text-[12px] text-muted-foreground">Anúncio Facebook · {ads}</p>}
          <p className="break-all text-[12px] text-muted-foreground">Webhook · {hook}</p>
          <Button type="submit" className="rounded-full" disabled={busy}>
            {busy ? "A ligar…" : "Vincular Telegram"}
          </Button>
        </form>
      </section>
      <section className="surface p-6">
        <p className="text-[14px] font-medium">Voz da Sté · ElevenLabs</p>
        <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
          Mensagem grande vira áudio. A ElevenLabs gera cada clip uma vez; o Telegram reenvia o mesmo arquivo. Respostas
          curtas continuam texto. Os links saem numa mensagem à parte.
        </p>
        {!runtimeLoaded ? (
          <p className="mt-4 text-[12.5px] text-muted-foreground">A ler a voz gravada no Worker…</p>
        ) : !runtime.ok ? (
          <p className="mt-4 text-[12.5px] text-muted-foreground">
            Não consegui falar com o Worker. Recarrega para ver se a voz já está ligada.
          </p>
        ) : runtime.voice ? (
          <p className="mt-4 text-[12.5px] text-muted-foreground">
            Voz {runtime.voiceHint}. Gera os 8 clips uma vez; o Telegram reutiliza o mesmo arquivo.
          </p>
        ) : (
          <p className="mt-4 text-[12.5px] text-muted-foreground">
            Sem chave ou voice id a Sté continua em texto. Cola os dois campos e guarda — a chave não entra no git.
          </p>
        )}
        <form
          className="mt-5 space-y-4"
          onSubmit={(event) => {
            event.preventDefault()
            setVoiceBusy(true)
            void saveRuntime({
              ...(elevenKey.trim() ? { elevenApiKey: elevenKey.trim() } : {}),
              ...(voiceId.trim() ? { elevenVoiceId: voiceId.trim() } : {}),
            })
              .then((next) => {
                setRuntime(next)
                setElevenKey("")
                setVoiceId("")
                toast.success(next.voice ? "Voz gravada no Worker." : "Falta a chave ou o voice id.")
              })
              .catch((error: Error) => toast.error(error.message))
              .finally(() => setVoiceBusy(false))
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="ste-voice-id">Voice id da Sté</Label>
            <Input
              id="ste-voice-id"
              value={voiceId}
              onChange={(event) => setVoiceId(event.target.value)}
              placeholder={runtime.voiceHint ? `Já gravado ${runtime.voiceHint}. Cola outro para trocar.` : "Cola o voice id do clone"}
              autoComplete="off"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ste-eleven">Chave ElevenLabs</Label>
            <Input
              id="ste-eleven"
              type="password"
              autoComplete="off"
              value={elevenKey}
              onChange={(event) => setElevenKey(event.target.value)}
              placeholder={runtime.voice ? "Chave já ligada. Cola outra para trocar." : "Cola a chave sk_… da ElevenLabs"}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" className="rounded-full" disabled={voiceBusy}>
              {voiceBusy ? "A gravar…" : "Guardar voz"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="rounded-full"
              disabled={voiceBusy || !runtime.voice}
              onClick={() => {
                setVoiceBusy(true)
                void prepareVoice()
                  .then((next) => {
                    setRuntime(next)
                    const ready = next.voiceClips?.filter((item) => item.ready).length ?? 0
                    toast.success(`${ready} áudios prontos. Os próximos leads reutilizam.`)
                  })
                  .catch((error: Error) => toast.error(error.message))
                  .finally(() => setVoiceBusy(false))
              }}
            >
              Gerar áudios do funil
            </Button>
          </div>
        </form>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {STE_VOICE_CLIPS.map((clip) => {
            const live = runtime.voiceClips?.find((item) => item.id === clip.id)
            return (
              <StatusPill key={clip.id} tone={live?.ready ? "success" : "muted"}>
                {clip.label}
                {voiceBusy && !live?.ready ? " · a gerar" : live?.ready ? " · pronto" : " · à espera"}
              </StatusPill>
            )
          })}
        </div>
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

function AccountPane() {
  const { state } = useStore()
  const [current, setCurrent] = useState("")
  const [next, setNext] = useState("")
  const [busy, setBusy] = useState(false)

  return (
    <section className="surface max-w-3xl p-6">
      <p className="text-[14px] font-medium">Conta do operador</p>
      <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
        Em produção o “Esqueceu a senha?” não envia e-mail. Troca a senha aqui com a senha actual.
      </p>
      <dl className="mt-4 space-y-2 text-[12.5px]">
        <div className="flex flex-wrap justify-between gap-2">
          <dt className="text-muted-foreground">Operador</dt>
          <dd className="font-medium">{state.user?.name}</dd>
        </div>
        <div className="flex flex-wrap justify-between gap-2">
          <dt className="text-muted-foreground">E-mail</dt>
          <dd className="font-medium">{state.user?.email}</dd>
        </div>
      </dl>
      <form
        className="mt-5 space-y-4"
        onSubmit={(event) => {
          event.preventDefault()
          if (next.length < 6) {
            toast.error("A nova senha precisa de 6+ caracteres.")
            return
          }
          setBusy(true)
          void changePasswordRequest(current, next)
            .then(() => {
              setCurrent("")
              setNext("")
              toast.success("Senha actualizada.")
            })
            .catch((error: Error) => toast.error(error.message))
            .finally(() => setBusy(false))
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="current-password">Senha actual</Label>
          <Input
            id="current-password"
            type="password"
            autoComplete="current-password"
            value={current}
            onChange={(event) => setCurrent(event.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="new-password">Nova senha</Label>
          <Input
            id="new-password"
            type="password"
            autoComplete="new-password"
            value={next}
            onChange={(event) => setNext(event.target.value)}
          />
        </div>
        <Button type="submit" className="rounded-full" disabled={busy || !current || next.length < 6}>
          <KeyRound className="size-3.5" />
          {busy ? "A gravar…" : "Guardar senha"}
        </Button>
      </form>
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
