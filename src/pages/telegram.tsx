import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { Send } from "lucide-react"
import { PageChrome, StatusPill } from "@/components/layout/chrome"
import { Button } from "@/components/ui/button"
import { useStore } from "@/lib/store"
import { workerUrl } from "@/lib/channel"
import { adsDeepLink } from "@/lib/telegram-start"
import { burstFacebookLeads, burstStats } from "@/lib/burst"
import { toast } from "sonner"

export function TelegramPage() {
  const { state, createLeads } = useStore()
  const { settings, leads } = state
  const tokenOn = Boolean(settings.telegramBotToken.trim())
  const inGroup = leads.filter((lead) => lead.channel === "telegram" && (lead.origin === "group_join" || lead.stage === "group")).length
  const facebookToday = leads.filter((lead) => {
    if (lead.origin !== "facebook") return false
    const day = new Date()
    day.setHours(0, 0, 0, 0)
    return new Date(lead.createdAt).getTime() >= day.getTime()
  }).length
  const hook = `${workerUrl()}/api/telegram`
  const ads = adsDeepLink(settings.telegramBotUsername)
  const [health, setHealth] = useState<"off" | "ok" | "down">("off")

  useEffect(() => {
    const ctrl = new AbortController()
    const timer = window.setTimeout(() => ctrl.abort(), 1500)
    fetch(`${workerUrl()}/api/health`, { signal: ctrl.signal })
      .then((res) => (res.ok ? setHealth("ok") : setHealth("down")))
      .catch(() => setHealth("down"))
    return () => {
      window.clearTimeout(timer)
      ctrl.abort()
    }
  }, [])

  return (
    <div className="h-full overflow-y-auto">
      <div className="page-shell">
        <PageChrome icon={Send} title="Telegram">
          <Button
            type="button"
            variant="outline"
            className="h-8 rounded-full px-3.5"
            onClick={() => {
              const batch = burstFacebookLeads(state.funnels, 100)
              createLeads(batch)
              const stats = burstStats(batch)
              toast.success(
                `${stats.facebook} /start Facebook. ${stats.talking} responderam. ${stats.blocked} encerrados. A Sté segue o prompt.`
              )
            }}
          >
            Simular 100 /start
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
              <StatusPill tone={settings.telegramBotUsername || tokenOn ? "success" : "muted"}>
                {settings.telegramBotUsername || tokenOn ? "Configurado" : "Ainda sem bot"}
              </StatusPill>
              <StatusPill tone={health === "ok" ? "success" : "muted"}>{health === "ok" ? "Worker ok" : "Worker por ligar"}</StatusPill>
            </div>
          </article>
          <article className="surface p-5">
            <p className="text-[12.5px] text-muted-foreground">Sté no Telegram</p>
            <p className="mt-2 text-[18px] font-medium">Prompt interno</p>
            <p className="mt-2 text-[12.5px] text-muted-foreground">A Sté fala pelo prompt, não pelo nó do funil.</p>
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
          <p className="text-[14px] font-medium">Canal no Telegram</p>
          <p className="mt-2 max-w-2xl text-[13.5px] leading-relaxed text-muted-foreground">
            /start no privado: a Sté manda uma frase e espera. O funil não manda mensagem. Join no grupo só cria o lead da
            campanha Telegram. Token de produção vai em <code className="text-foreground">wrangler secret</code>, nunca no
            git.
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
