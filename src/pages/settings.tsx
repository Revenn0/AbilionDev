import { useEffect, useRef, useState } from "react"
import { Link, useLocation, useSearchParams } from "react-router-dom"
import { useHashScroll } from "@/lib/use-hash-scroll"
import { useTheme } from "@/components/theme/provider"
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
import { downloadLeadsCsv } from "@/lib/leads-export"
import { cleanBotUsername, cleanTelegramGroupUrl } from "@/lib/migrate"
import { useStore } from "@/lib/store"
import { changePasswordRequest } from "@/lib/auth-api"
import { PixelSnippet } from "@/components/layout/pixel-snippet"
import { workerUrl } from "@/lib/channel"
import { fetchRuntime, prepareVoice, saveRuntime, type RuntimeStatus } from "@/lib/runtime-api"
import { STE_LLM_FALLBACK, STE_LLM_MODEL, STE_LLM_MODELS, normalizeSteModel } from "@/lib/llm"
import { STE_VOICE_CLIPS } from "@/lib/ste-voice"
import { adsDeepLink } from "@/lib/telegram-start"
import { cn } from "@/lib/utils"
import type { PluginId } from "@/lib/types"
import { toast } from "sonner"
import { LEAD_LIST_CAP } from "@/lib/crm"

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
  exportCsv?: boolean
  icon: typeof Plug
}> = [
  { id: "telegram", title: "Telegram Bot", hint: "Liga-se em Bot Telegram. O interruptor daqui não mexe no token.", icon: Send },
  { id: "forms", title: "Captura", hint: "Nova captura está em Leads. Não é um interruptor morto.", icon: FormInput },
  { id: "webhooks", title: "Webhooks de saída", hint: "O webhook do Telegram já corre no Worker. Eventos para um URL teu ficam para depois.", icon: Webhook, soon: true },
  { id: "reports", title: "Relatórios", hint: "Exporta a base de leads em CSV. Sem toggle falso.", icon: FileSpreadsheet, exportCsv: true },
  { id: "calendar", title: "Agenda", hint: "Oferta 3–4 dias depois do print. Em breve.", icon: Calendar, soon: true },
]

function readTab(params: URLSearchParams): TabId {
  const raw = params.get("tab")
  return TABS.some((item) => item.id === raw) ? (raw as TabId) : "bot"
}

export function SettingsPage() {
  const [params, setParams] = useSearchParams()
  const { hash } = useLocation()
  const tab = readTab(params)
  useHashScroll("pixel", tab === "bot")

  const go = (next: TabId) => {
    const copy = new URLSearchParams(params)
    if (next === "bot") copy.delete("tab")
    else copy.set("tab", next)
    setParams(copy, { replace: true })
  }

  useEffect(() => {
    if (hash !== "#pixel" || tab === "bot") return
    const copy = new URLSearchParams(params)
    copy.delete("tab")
    setParams(copy, { replace: true })
  }, [hash, tab, params, setParams])

  return (
    <div className="h-full overflow-y-auto">
      <div className="page-shell">
        <PageChrome icon={SettingsIcon} title="Configurações" />

        <div role="tablist" aria-label="Secções de configurações" className="flex w-fit flex-wrap gap-1 rounded-full bg-card p-1">
          {TABS.map((item, index) => (
            <button
              key={item.id}
              id={`settings-tab-${item.id}`}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              aria-controls={`settings-panel-${item.id}`}
              tabIndex={tab === item.id ? 0 : -1}
              onClick={() => go(item.id)}
              onKeyDown={(event) => {
                if (event.key !== "ArrowRight" && event.key !== "ArrowLeft" && event.key !== "Home" && event.key !== "End") return
                event.preventDefault()
                const last = TABS.length - 1
                const nextIndex =
                  event.key === "Home" ? 0 : event.key === "End" ? last : event.key === "ArrowRight" ? (index + 1) % TABS.length : (index - 1 + TABS.length) % TABS.length
                const next = TABS[nextIndex]
                if (!next) return
                go(next.id)
                window.requestAnimationFrame(() => document.getElementById(`settings-tab-${next.id}`)?.focus())
              }}
              className={cn(
                "h-8 rounded-full px-3.5 text-[12.5px] font-medium",
                tab === item.id ? "bg-background text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div role="tabpanel" id={`settings-panel-${tab}`} aria-labelledby={`settings-tab-${tab}`} tabIndex={0}>
          {tab === "bot" && <BotPane />}
          {tab === "conta" && <AccountPane />}
          {tab === "plugins" && <PluginsPane />}
          {tab === "notificacoes" && <NotifyPane />}
          {tab === "aparencia" && <ThemePane />}
        </div>
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
  const [opencode, setOpencode] = useState("")
  const [elevenKey, setElevenKey] = useState("")
  const [voiceId, setVoiceId] = useState("")
  const [model, setModel] = useState(STE_LLM_MODEL)
  const [busy, setBusy] = useState(false)
  const [voiceBusy, setVoiceBusy] = useState(false)
  const [botError, setBotError] = useState("")
  const [groupError, setGroupError] = useState("")
  const [voiceError, setVoiceError] = useState("")
  const [runtimeLoaded, setRuntimeLoaded] = useState(false)
  const [runtime, setRuntime] = useState<RuntimeStatus>({ ok: false })
  const botLock = useRef(false)
  const voiceLock = useRef(false)
  const userDirty = useRef(false)
  const groupDirty = useRef(false)
  const modelDirty = useRef(false)
  const origin = workerUrl()
  const hook = runtime.webhook || `${origin}/api/telegram`
  const ads = adsDeepLink(cleanBotUsername(username) || runtime.telegramBotUsername || state.settings.telegramBotUsername)

  const refresh = async () => {
    const nextRuntime = await fetchRuntime()
    setRuntime(nextRuntime)
    setRuntimeLoaded(true)
    if (nextRuntime.telegramBotUsername && !userDirty.current) setUsername(nextRuntime.telegramBotUsername)
    if (nextRuntime.telegramGroupUrl && !groupDirty.current) setGroup(nextRuntime.telegramGroupUrl)
    if (nextRuntime.model && !modelDirty.current) setModel(normalizeSteModel(nextRuntime.model))
  }

  useEffect(() => {
    if (!userDirty.current) setUsername(state.settings.telegramBotUsername)
    if (!groupDirty.current) setGroup(state.settings.telegramGroupUrl)
  }, [state.settings.telegramBotUsername, state.settings.telegramGroupUrl])

  useEffect(() => {
    void refresh()
    const pull = () => {
      if (document.visibilityState === "hidden") return
      void refresh()
    }
    const timer = window.setInterval(pull, 15_000)
    window.addEventListener("focus", pull)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener("focus", pull)
    }
  }, [])

  return (
    <div className="grid max-w-3xl gap-3">
      {runtimeLoaded && !runtime.ok && (
        <p role="alert" className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-[12.5px] text-destructive">
          Não consegui ler o runtime do Worker.{" "}
          <button type="button" className="font-medium underline-offset-2 hover:underline" onClick={() => void refresh()}>
            Tentar outra vez
          </button>
        </p>
      )}
      <PixelSnippet
        origin={origin}
        botUsername={cleanBotUsername(username) || runtime.telegramBotUsername || state.settings.telegramBotUsername}
      />
      <section className="surface p-6">
        <p className="text-[14px] font-medium">Telegram em produção</p>
        <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
          Vincular grava o token no Worker e aponta o webhook. O que a Sté fala fica no funil publicado — não aqui. O
          token não fica no browser nem no git.
        </p>
        <div className="mt-4 flex flex-wrap gap-1.5">
          <StatusPill tone={runtime.telegram ? "success" : "muted"}>
            Telegram · {!runtimeLoaded ? "a verificar" : runtime.telegram ? "ligado" : "à espera do token"}
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
          <StatusPill tone={runtime.llm ? "success" : "muted"}>
            IA · {runtime.llm ? runtime.model || "deepseek-v4.1-flash" : "script da Sté"}
          </StatusPill>
          <StatusPill>
            Reserva · {runtime.fallbackModel || STE_LLM_MODEL}
          </StatusPill>
          <StatusPill tone={runtime.persist === "kv" || runtime.persist === "supabase" ? "success" : "muted"}>
            Leads · {runtime.persist === "supabase" ? "Supabase" : "Worker"}
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
            if (botLock.current || busy) return
            const cleanUser = cleanBotUsername(username)
            const cleanGroup = cleanTelegramGroupUrl(group)
            if (username.trim() && !cleanUser) {
              setBotError("Username inválido. Usa 5–32 caracteres: letra inicial, depois letras, números ou _.")
              return
            }
            if (group.trim() && !cleanGroup) {
              setGroupError("O convite tem de ser um link https://t.me/…")
              return
            }
            if (!cleanUser && !runtime.telegramBotUsername && !token.trim() && !glm.trim() && !opencode.trim() && !cleanGroup) {
              setBotError("Informa o username do bot ou cola o token.")
              return
            }
            setBotError("")
            setGroupError("")
            botLock.current = true
            setBusy(true)
            void saveRuntime({
              telegramBotUsername: cleanUser,
              telegramGroupUrl: cleanGroup,
              ...(token.trim() ? { telegramBotToken: token.trim() } : {}),
              ...(glm.trim() ? { openaiApiKey: glm.trim() } : {}),
              ...(opencode.trim() ? { opencodeApiKey: opencode.trim() } : {}),
              ...(elevenKey.trim() ? { elevenApiKey: elevenKey.trim() } : {}),
              ...(voiceId.trim() ? { elevenVoiceId: voiceId.trim() } : {}),
              steModel: model,
              steFallbackModel: STE_LLM_FALLBACK,
            })
              .then((next) => {
                setRuntime(next)
                setToken("")
                setGlm("")
                setOpencode("")
                setElevenKey("")
                setVoiceId("")
                userDirty.current = false
                groupDirty.current = false
                modelDirty.current = false
                saveSettings({
                  telegramBotUsername: next.telegramBotUsername || cleanUser,
                  telegramGroupUrl: next.telegramGroupUrl || group.trim(),
                  telegramBotToken: "",
                  plugins: { ...state.settings.plugins, telegram: Boolean(next.telegram) },
                })
                if (next.warning) toast.warning(next.warning)
                else if (next.telegram) toast.success("Telegram ligado no Worker.")
                else if (cleanUser) toast.success("Username gravado. Falta o token.")
                else toast.success("Runtime gravado no Worker.")
              })
              .catch((error: Error) => {
                toast.error(error.message)
                void fetchRuntime().then(setRuntime)
              })
              .finally(() => {
                botLock.current = false
                setBusy(false)
              })
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="bot-user">Username</Label>
            <Input
              id="bot-user"
              value={username}
              onChange={(event) => {
                userDirty.current = true
                setUsername(event.target.value)
                setBotError("")
              }}
              placeholder="@teu_bot"
              autoComplete="off"
              aria-invalid={Boolean(botError)}
              aria-describedby={botError ? "bot-user-error" : undefined}
            />
            {botError ? (
              <p id="bot-user-error" role="alert" className="text-[12px] text-destructive">
                {botError}
              </p>
            ) : null}
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
              onChange={(event) => {
                groupDirty.current = true
                setGroup(event.target.value)
                setGroupError("")
              }}
              placeholder="https://t.me/..."
              aria-invalid={Boolean(groupError)}
              aria-describedby={groupError ? "bot-group-error" : undefined}
            />
            {groupError ? (
              <p id="bot-group-error" role="alert" className="text-[12px] text-destructive">
                {groupError}
              </p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bot-model">Modelo OpenRouter</Label>
            <select
              id="bot-model"
              value={model}
              onChange={(event) => {
                modelDirty.current = true
                setModel(normalizeSteModel(event.target.value))
              }}
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
            <Label htmlFor="bot-opencode">Chave OpenCode</Label>
            <Input
              id="bot-opencode"
              type="password"
              autoComplete="off"
              value={opencode}
              onChange={(event) => setOpencode(event.target.value)}
              placeholder={runtime.llm && runtime.model?.includes("deepseek-v4.1") ? "OpenCode já ligada. Cola outra chave oc_sk_… para trocar." : "Cola a chave oc_sk_… (DeepSeek V4.1 Flash)"}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bot-glm">Chave OpenRouter</Label>
            <Input
              id="bot-glm"
              type="password"
              autoComplete="off"
              value={glm}
              onChange={(event) => setGlm(event.target.value)}
              placeholder={runtime.llm ? "Reserva já ligada. Cola outra chave sk-or-v1… para trocar." : "Cola a chave sk-or-v1…"}
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
            if (voiceLock.current || voiceBusy) return
            if (!elevenKey.trim() && !voiceId.trim() && !runtime.voice) {
              setVoiceError("Cola o voice id e a chave da ElevenLabs.")
              return
            }
            setVoiceError("")
            voiceLock.current = true
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
              .finally(() => {
                voiceLock.current = false
                setVoiceBusy(false)
              })
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="ste-voice-id">Voice id da Sté</Label>
            <Input
              id="ste-voice-id"
              value={voiceId}
              placeholder={runtime.voiceHint ? `Já gravado ${runtime.voiceHint}. Cola outro para trocar.` : "Cola o voice id do clone"}
              autoComplete="off"
              onChange={(event) => {
                setVoiceId(event.target.value)
                setVoiceError("")
              }}
              aria-invalid={Boolean(voiceError)}
              aria-describedby={voiceError ? "ste-voice-error" : undefined}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ste-eleven">Chave ElevenLabs</Label>
            <Input
              id="ste-eleven"
              type="password"
              autoComplete="off"
              value={elevenKey}
              onChange={(event) => {
                setElevenKey(event.target.value)
                setVoiceError("")
              }}
              placeholder={runtime.voice ? "Chave já ligada. Cola outra para trocar." : "Cola a chave sk_… da ElevenLabs"}
            />
            {voiceError ? (
              <p id="ste-voice-error" role="alert" className="text-[12px] text-destructive">
                {voiceError}
              </p>
            ) : null}
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
                if (voiceLock.current || voiceBusy) return
                voiceLock.current = true
                setVoiceBusy(true)
                void prepareVoice()
                  .then((next) => {
                    setRuntime(next)
                    const ready = next.voiceClips?.filter((item) => item.ready).length ?? 0
                    toast.success(`${ready} áudios prontos. Os próximos leads reutilizam.`)
                  })
                  .catch((error: Error) => toast.error(error.message))
                  .finally(() => {
                    voiceLock.current = false
                    setVoiceBusy(false)
                  })
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
    </div>
  )
}

function AccountPane() {
  const { state } = useStore()
  const [current, setCurrent] = useState("")
  const [next, setNext] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const lock = useRef(false)

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
          if (lock.current || busy) return
          if (!current.trim()) {
            setError("Informa a senha actual.")
            return
          }
          if (next.length < 6) {
            setError("A nova senha precisa de 6+ caracteres.")
            return
          }
          setError("")
          lock.current = true
          setBusy(true)
          void changePasswordRequest(current, next)
            .then(() => {
              setCurrent("")
              setNext("")
              toast.success("Senha actualizada.")
            })
            .catch((err: Error) => {
              setError(err.message)
              toast.error(err.message)
            })
            .finally(() => {
              lock.current = false
              setBusy(false)
            })
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="current-password">Senha actual</Label>
          <Input
            id="current-password"
            type="password"
            autoComplete="current-password"
            value={current}
            aria-invalid={Boolean(error) && (error.includes("actual") || error.includes("inválida"))}
            aria-describedby={error ? "password-error" : undefined}
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
            aria-invalid={error.includes("6+")}
            aria-describedby={error ? "password-error" : undefined}
            onChange={(event) => setNext(event.target.value)}
          />
        </div>
        {error ? (
          <p id="password-error" role="alert" className="text-[12px] text-destructive">
            {error}
          </p>
        ) : null}
        <Button type="submit" className="rounded-full" disabled={busy}>
          <KeyRound className="size-3.5" />
          {busy ? "A gravar…" : "Guardar senha"}
        </Button>
      </form>
    </section>
  )
}

function PluginsPane() {
  const { state, persistSync } = useStore()
  const telegramOn = Boolean(state.settings.plugins.telegram)
  const leadCount = persistSync === "idle" && state.leads.length === 0 ? "…" : state.leads.length

  return (
    <section>
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <p className="text-[14px] font-medium">Plugins</p>
          <p className="mt-0.5 text-[12.5px] text-muted-foreground">O canal activo é o Telegram. Interruptores sem efeito saíram daqui.</p>
        </div>
        <p className="text-[12.5px] text-muted-foreground">{leadCount} leads na base</p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {PLUGINS.map((plugin) => {
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
                  {plugin.soon ? <StatusPill>Em breve</StatusPill> : null}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {plugin.id === "telegram" ? (
                    <StatusPill tone={telegramOn ? "success" : "muted"}>{telegramOn ? "Ligado no Worker" : "Ainda sem token"}</StatusPill>
                  ) : null}
                  {plugin.id === "forms" ? (
                    <Button asChild size="sm" variant="outline" className="rounded-full">
                      <Link to="/leads">Abrir captura</Link>
                    </Button>
                  ) : null}
                  {plugin.exportCsv ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-full"
                      disabled={!state.leads.length}
                      onClick={() => {
                        downloadLeadsCsv(state.leads)
                        toast.success(
                          state.leads.length >= LEAD_LIST_CAP
                            ? `CSV com ${state.leads.length} leads (teto da lista hidratada).`
                            : `CSV com ${state.leads.length} leads.`
                        )
                      }}
                    >
                      Exportar CSV
                    </Button>
                  ) : null}
                </div>
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}

function NotifyPane() {
  const rows = [
    { key: "notifyNewLead" as const, title: "Novo lead", hint: "Facebook, popup, join ou /start a entrar no CRM." },
    { key: "notifyConversation" as const, title: "Conversa iniciada", hint: "Sté no Telegram 1:1." },
    { key: "notifyPrint" as const, title: "Print do cadastro", hint: "Aviso interno quando o print entra no fluxo." },
    { key: "notifyChannelFail" as const, title: "Falha de canal", hint: "Telegram sem responder." },
  ]

  return (
    <section>
      <p className="mb-3 text-[12.5px] text-muted-foreground">
        Ainda não disparam e-mail nem Telegram. O aviso da Ester no print continua a sair pelo funil quando há ESTER_CHAT_ID.
      </p>
      <div className="surface divide-y divide-border overflow-hidden">
        {rows.map((row) => (
          <div key={row.key} className="flex items-center justify-between gap-4 px-5 py-4">
            <span>
              <span className="flex items-center gap-2 text-[14px] font-medium">
                <Bell className="size-3.5 text-muted-foreground" />
                {row.title}
              </span>
              <span className="mt-1 block text-[12.5px] text-muted-foreground">{row.hint}</span>
            </span>
            <StatusPill>Em breve</StatusPill>
          </div>
        ))}
      </div>
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
        aria-pressed={dark}
        className={cn("surface p-5 text-left", dark && "ring-1 ring-foreground/20")}
      >
        <Moon className="size-4 text-muted-foreground" />
        <p className="mt-3 text-[14px] font-medium">Escuro</p>
        <p className="mt-1 text-[12.5px] text-muted-foreground">O tema do painel de operação.</p>
      </button>
      <button
        type="button"
        onClick={() => setTheme("light")}
        aria-pressed={!dark}
        className={cn("surface p-5 text-left", !dark && "ring-1 ring-foreground/20")}
      >
        <Sun className="size-4 text-muted-foreground" />
        <p className="mt-3 text-[14px] font-medium">Claro</p>
        <p className="mt-1 text-[12.5px] text-muted-foreground">Mesma grelha, fundo claro.</p>
      </button>
    </section>
  )
}
