import { Link } from "react-router-dom"
import { Send } from "lucide-react"
import { PageChrome, StatusPill } from "@/components/layout/chrome"
import { Button } from "@/components/ui/button"
import { useStore } from "@/lib/store"

export function TelegramPage() {
  const { state } = useStore()
  const { settings, leads } = state
  const tokenOn = Boolean(settings.telegramBotToken.trim())
  const inGroup = leads.filter((lead) => lead.channel === "telegram" && (lead.origin === "group_join" || lead.stage === "group")).length

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
            <p className="mt-2 text-[18px] font-medium">{settings.telegramBotUsername || "—"}</p>
            <div className="mt-3">
              <StatusPill tone={tokenOn ? "success" : "muted"}>{tokenOn ? "Token guardado" : "Sem token"}</StatusPill>
            </div>
          </article>
          <article className="surface p-5">
            <p className="text-[12.5px] text-muted-foreground">Sté no Telegram</p>
            <p className="mt-2 text-[18px] font-medium">{settings.steLinkedTelegram ? "Vinculada" : "Por vincular"}</p>
            <p className="mt-2 text-[12.5px] text-muted-foreground">Boas-vindas + material, o mesmo do WhatsApp.</p>
          </article>
          <article className="surface p-5">
            <p className="text-[12.5px] text-muted-foreground">Joins no grupo</p>
            <p className="mt-2 text-[18px] font-medium">{inGroup}</p>
            <p className="mt-2 text-[12.5px] text-muted-foreground">Join cria lead da campanha Telegram.</p>
          </article>
        </section>

        <section className="surface p-6">
          <p className="text-[14px] font-medium">Mapa</p>
          <p className="mt-2 max-w-2xl text-[13.5px] leading-relaxed text-muted-foreground">
            Tráfego → land → botão da campanha Telegram → bot de boas-vindas e a pessoa no grupo. Quem já falou no
            privado entra no fluxo da campanha. /start segue o mapa, não um «oi» solto. O webhook ainda não está ligado —
            o token fica só neste browser.
          </p>
          {settings.telegramGroupUrl && (
            <p className="mt-4 text-[13px]">
              Convite do grupo: <span className="text-muted-foreground">{settings.telegramGroupUrl}</span>
            </p>
          )}
        </section>
      </div>
    </div>
  )
}
