import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { Send } from "lucide-react"
import { PageChrome, StatusPill } from "@/components/layout/chrome"
import { SyncBanner } from "@/components/layout/sync-banner"
import { Button } from "@/components/ui/button"
import { useStore } from "@/lib/store"
import { fetchHealth, workerUrl } from "@/lib/channel"
import { adsDeepLink } from "@/lib/telegram-start"
import { burstFacebookLeads, burstStats } from "@/lib/burst"
import { toast } from "sonner"

export function TelegramPage() {
  const { state, createLeads } = useStore()
  const { settings, leads } = state
  const inGroup = leads.filter((lead) => lead.channel === "telegram" && (lead.origin === "group_join" || lead.stage === "group")).length
  const facebookToday = leads.filter((lead) => {
    if (lead.origin !== "facebook") return false
    const day = new Date()
    day.setHours(0, 0, 0, 0)
    return new Date(lead.createdAt).getTime() >= day.getTime()
  }).length
  const hook = `${workerUrl()}/api/telegram`
  const ads = adsDeepLink(settings.telegramBotUsername)
  const [health, setHealth] = useState<Awaited<ReturnType<typeof fetchHealth>>>({ ok: false })
  const [burstLock, setBurstLock] = useState(false)

  useEffect(() => {
    void fetchHealth().then(setHealth)
  }, [])

  return (
    <div className="h-full overflow-y-auto">
      <div className="page-shell">
        <SyncBanner
          items={[
            {
              ok: !health.unreachable,
              message: "O Worker não respondeu. Confere se o painel está a falar com /api/health.",
            },
          ]}
        />
        <PageChrome icon={Send} title="Telegram">
          <Button
            type="button"
            variant="outline"
            className="h-8 rounded-full px-3.5"
            disabled={burstLock}
            onClick={() => {
              if (burstLock) return
              setBurstLock(true)
              const batch = burstFacebookLeads(state.funnels, 100)
              createLeads(batch)
              const stats = burstStats(batch)
              toast.success(
                `${stats.facebook} /start Facebook. ${stats.talking} responderam. ${stats.blocked} encerrados. ${stats.offered} na oferta.`
              )
              window.setTimeout(() => setBurstLock(false), 800)
            }}
          >
            {burstLock ? "A simular…" : "Simular 100 /start"}
          </Button>
          <Button asChild className="h-8 rounded-full px-3.5">
            <Link to="/configuracoes?tab=bot">Configurar bot</Link>
          </Button>
        </PageChrome>

        <section className="grid gap-3 md:grid-cols-4">
          <article className="surface p-5">
            <p className="text-[12.5px] text-muted-foreground">Bot</p>
            <p className="mt-2 text-[18px] font-medium">{settings.telegramBotUsername || "Por configurar"}</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <StatusPill tone={settings.telegramBotUsername || health.telegram ? "success" : "muted"}>
                {settings.telegramBotUsername || health.telegram ? "Configurado" : "Ainda sem bot"}
              </StatusPill>
              <StatusPill tone={health.ok && health.telegram ? "success" : "muted"}>
                {health.ok && health.telegram ? "Telegram ligado" : "À espera do token"}
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
            <p className="mt-2 text-[18px] font-medium">{inGroup}</p>
            <p className="mt-2 text-[12.5px] text-muted-foreground">Join cria lead da campanha Telegram.</p>
          </article>
          <article className="surface p-5">
            <p className="text-[12.5px] text-muted-foreground">Facebook hoje</p>
            <p className="mt-2 text-[18px] font-medium">{facebookToday}</p>
            <p className="mt-2 text-[12.5px] text-muted-foreground">/start=fb no anúncio. Pico de 500–1000/dia.</p>
          </article>
        </section>

        <section className="surface p-6">
          <p className="text-[14px] font-medium">Canal no mesmo grafo</p>
          <p className="mt-2 max-w-2xl text-[13.5px] leading-relaxed text-muted-foreground">
            /start no privado: a Sté manda 3 boas-vindas e espera. Join no grupo só cria o lead da campanha Telegram. O token
            grava-se em Configurações e fica no Worker, nunca no git.
          </p>
          <p className="mt-4 text-[13px]">
            Link do anúncio Facebook:{" "}
            <span className="break-all text-muted-foreground">{ads || "configura o username do bot"}</span>
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
      </div>
    </div>
  )
}
