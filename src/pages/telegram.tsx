import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { useHashScroll } from "@/lib/use-hash-scroll"
import { Send } from "lucide-react"
import { PageChrome, StatusPill } from "@/components/layout/chrome"
import { PageAnchors } from "@/components/layout/manual"
import { PixelSnippet } from "@/components/layout/pixel-snippet"
import { SyncBanner } from "@/components/layout/sync-banner"
import { Button } from "@/components/ui/button"
import { useStore } from "@/lib/store"
import { fetchHealth, workerUrl } from "@/lib/channel"
import { fetchRuntime, type RuntimeStatus } from "@/lib/runtime-api"
import { adsDeepLink } from "@/lib/telegram-start"
import { adsLandingUrl } from "@/lib/page-script"
import { burstFacebookLeads, burstStartsBlocked, burstStats } from "@/lib/burst"
import { catalogMetricPending, funnelsWriteBlocked, leadCatalogClipped, metricPending } from "@/lib/ops"
import { toast } from "sonner"

export function TelegramPage() {
  const { state, createLeads, crmSync, persistSync, catalogComplete, settingsSync, inboxSync } = useStore()
  const { settings, leads } = state
  const funnelsUnread = funnelsWriteBlocked(crmSync)
  const burstBlocked = burstStartsBlocked(persistSync, funnelsUnread)
  const inGroup = leads.filter((lead) => lead.channel === "telegram" && (lead.origin === "group_join" || lead.stage === "group")).length
  const facebookToday = leads.filter((lead) => {
    if (lead.origin !== "facebook") return false
    const day = new Date()
    day.setHours(0, 0, 0, 0)
    return new Date(lead.createdAt).getTime() >= day.getTime()
  }).length
  const clipped = leadCatalogClipped(persistSync, catalogComplete)
  const groupPending = catalogMetricPending(persistSync, inGroup, inboxSync === "error") || (clipped && inGroup === 0)
  const facebookPending = metricPending(persistSync, facebookToday) || (clipped && facebookToday === 0)
  const hook = `${workerUrl()}/api/telegram`
  const [health, setHealth] = useState<Awaited<ReturnType<typeof fetchHealth>> | null>(null)
  const [runtime, setRuntime] = useState<RuntimeStatus | null>(null)
  const [burstLock, setBurstLock] = useState(false)
  const botName = runtime?.telegramBotUsername || settings.telegramBotUsername
  const botUnread = health?.telegramBotUnread === true && !botName
  const ads = adsLandingUrl()
  const landingCta = adsDeepLink(botName)
  useHashScroll("pixel")

  useEffect(() => {
    let cancelled = false
    const pull = () => {
      void Promise.all([fetchHealth(), fetchRuntime()]).then(([nextHealth, nextRuntime]) => {
        if (cancelled) return
        setHealth(nextHealth)
        setRuntime(nextRuntime)
      })
    }
    pull()
    const timer = window.setInterval(pull, 15_000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [])
  const refreshStatus = () => {
    void Promise.all([fetchHealth(), fetchRuntime()]).then(([nextHealth, nextRuntime]) => {
      setHealth(nextHealth)
      setRuntime(nextRuntime)
    })
  }
  const healthReady = health !== null && runtime !== null
  const runtimeFailed = runtime !== null && runtime.ok === false

  return (
    <div className="h-full overflow-y-auto">
      <div className="page-shell">
        <SyncBanner
          items={[
            {
              ok: persistSync !== "error",
              message: "Não consegui ler os leads do Worker. Os números de joins e Facebook hoje podem estar vazios.",
            },
            {
              ok: !clipped,
              message: "A lista do Worker veio recortada. Joins e Facebook hoje não são o catálogo inteiro.",
            },
            {
              ok: crmSync !== "error",
              message: "Não consegui ler os funis do Worker. Simular 100 /start fica bloqueado — um quadro leftover no cache não conta.",
            },
            {
              ok: settingsSync !== "error",
              message: "Não confirmei as definições no Postgres. O username do bot e o pixel podem estar desactualizados.",
            },
            {
              ok: !health?.unreachable,
              message: "O Worker não respondeu. Confere se o painel está a falar com /api/health.",
            },
            {
              ok: !runtimeFailed,
              message: "Não consegui ler o runtime do Worker. O bot pode estar ligado.",
            },
          ]}
          onRetry={refreshStatus}
        />
        <PageChrome icon={Send} title="Telegram">
          <Button
            type="button"
            variant="outline"
            className="h-8 rounded-full px-3.5"
            data-burst-starts={burstBlocked ? (persistSync === "idle" || crmSync === "idle" ? "loading" : "error") : "ok"}
            disabled={burstLock || burstBlocked}
            title={
              burstBlocked
                ? persistSync !== "ok"
                  ? "Não confirmei os leads no Worker."
                  : "Não confirmei os funis no Worker."
                : undefined
            }
            onClick={() => {
              if (burstLock || burstBlocked) return
              if (!confirm("Isto cria 100 leads Facebook no CRM. Continuar?")) return
              setBurstLock(true)
              const batch = burstFacebookLeads(state.funnels, 100)
              const stats = burstStats(batch)
              void createLeads(batch)
                .then((ok) => {
                  if (ok) {
                    toast.success(
                      `${stats.facebook} /start Facebook. ${stats.talking} responderam. ${stats.blocked} encerrados. ${stats.offered} na oferta.`
                    )
                  } else {
                    toast.error("Não gravei o lote no Worker.")
                  }
                })
                .catch(() => {
                  toast.error("Não gravei o lote no Worker.")
                })
                .finally(() => {
                  setBurstLock(false)
                })
            }}
          >
            {burstLock ? "A simular…" : "Simular 100 /start"}
          </Button>
          <Button asChild className="h-8 rounded-full px-3.5">
            <Link to="/configuracoes?tab=bot">Configurar bot</Link>
          </Button>
          <Button asChild variant="outline" className="h-8 rounded-full px-3.5">
            <a href="#pixel">Pixel Ads</a>
          </Button>
        </PageChrome>

        <PageAnchors
          items={[
            { href: "#telegram-estado", label: "Estado" },
            { href: "#telegram-canal", label: "Canal" },
            { href: "#pixel", label: "Manual do pixel" },
          ]}
        />

        <section id="telegram-estado" className="grid scroll-mt-6 gap-3 md:grid-cols-4">
          <article className="surface p-5">
            <p className="text-[12.5px] text-muted-foreground">Bot</p>
            <p className="mt-2 text-[18px] font-medium">{botUnread || runtimeFailed ? "…" : botName || "Por configurar"}</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <StatusPill tone={botName || runtime?.telegram ? "success" : "muted"}>
                {!healthReady ? "A verificar…" : runtimeFailed || botUnread ? "Não confirmei o bot" : botName || runtime?.telegram ? "Configurado" : "Ainda sem bot"}
              </StatusPill>
              <StatusPill tone={runtime?.telegram ? "success" : "muted"}>
                {!healthReady ? "A verificar…" : runtime?.telegram ? "Telegram ligado" : runtimeFailed || botUnread ? "Não confirmei o token" : "À espera do token"}
              </StatusPill>
            </div>
          </article>
          <article className="surface p-5">
            <p className="text-[12.5px] text-muted-foreground">Sté no fluxo</p>
            <p className="mt-2 text-[18px] font-medium">Nó de handoff</p>
            <p className="mt-2 text-[12.5px] text-muted-foreground">O mesmo passo no Telegram 1:1.</p>
          </article>
          <article className="surface p-5">
            <p className="text-[12.5px] text-muted-foreground">Joins no grupo</p>
            <p className="mt-2 text-[18px] font-medium">{groupPending ? "…" : inGroup}</p>
            <p className="mt-2 text-[12.5px] text-muted-foreground">Join cria lead da campanha Telegram.</p>
          </article>
          <article className="surface p-5">
            <p className="text-[12.5px] text-muted-foreground">Facebook hoje</p>
            <p className="mt-2 text-[18px] font-medium">{facebookPending ? "…" : facebookToday}</p>
            <p className="mt-2 text-[12.5px] text-muted-foreground">Landing /l. O /start fecha o visitante. Pico de 500–1000/dia.</p>
          </article>
        </section>

        <section id="telegram-canal" className="surface scroll-mt-6 p-6">
          <p className="text-[14px] font-medium">Canal</p>
          <p className="mt-2 max-w-2xl text-[13.5px] leading-relaxed text-muted-foreground">
            /start no privado: a Sté manda 3 boas-vindas e espera. Join no grupo só cria o lead da campanha Telegram. O token
            grava-se em Configurações e fica no Worker, nunca no git.
          </p>
          <p className="mt-4 text-[13px]">
            Link do anúncio Facebook:{" "}
            <span className="break-all text-muted-foreground">{ads}</span>
          </p>
          <p className="mt-2 text-[13px]">
            Botão da landing:{" "}
            <span className="break-all text-muted-foreground">{landingCta || "liga o username do bot — não coloques t.me no Ads"}</span>
          </p>
          <p className="mt-2 text-[13px]">
            Webhook: <span className="break-all text-muted-foreground">{hook}</span>
          </p>
          {settings.telegramGroupUrl && (
            <p className="mt-2 text-[13px]">
              Convite do grupo: <span className="text-muted-foreground">{settings.telegramGroupUrl}</span>
            </p>
          )}
        </section>

        <PixelSnippet origin={workerUrl()} botUsername={botName} />
      </div>
    </div>
  )
}
