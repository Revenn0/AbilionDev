import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { Send } from "lucide-react"
import { PageChrome, StatusPill } from "@/components/layout/chrome"
import { Button } from "@/components/ui/button"
import { useStore } from "@/lib/store"
import { workerUrl } from "@/lib/channel"

export function TelegramPage() {
  const { state } = useStore()
  const { settings, leads } = state
  const tokenOn = Boolean(settings.telegramBotToken.trim())
  const inGroup = leads.filter((lead) => lead.channel === "telegram" && (lead.origin === "group_join" || lead.stage === "group")).length
  const hook = `${workerUrl()}/api/telegram`
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
          <Button asChild className="h-8 rounded-full px-3.5">
            <Link to="/configuracoes?tab=bot">Configurar bot</Link>
          </Button>
        </PageChrome>

        <section className="grid gap-3 md:grid-cols-3">
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
            <p className="text-[12.5px] text-muted-foreground">Sté no fluxo</p>
            <p className="mt-2 text-[18px] font-medium">Nó de handoff</p>
            <p className="mt-2 text-[12.5px] text-muted-foreground">O mesmo passo no Telegram e no WhatsApp.</p>
          </article>
          <article className="surface p-5">
            <p className="text-[12.5px] text-muted-foreground">Joins no grupo</p>
            <p className="mt-2 text-[18px] font-medium">{inGroup}</p>
            <p className="mt-2 text-[12.5px] text-muted-foreground">Join cria lead da campanha Telegram.</p>
          </article>
        </section>

        <section className="surface p-6">
          <p className="text-[14px] font-medium">Canal no mesmo grafo</p>
          <p className="mt-2 max-w-2xl text-[13.5px] leading-relaxed text-muted-foreground">
            Join cria o lead. /start entra no nó de entrada. O canvas publicado manda — não um bot com persona. Token de
            produção vai em <code className="text-foreground">wrangler secret</code>, nunca no git.
          </p>
          <p className="mt-4 text-[13px]">
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
