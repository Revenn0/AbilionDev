import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { Plus, Trash2 } from "lucide-react"
import { JourneyPreview } from "@/components/funnel/preview"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PageHeading } from "@/components/page-heading"
import { useStore } from "@/lib/store"
import { conversationJourney, emptySalesFunnel } from "@/lib/templates"
import { timeAgo, uid } from "@/lib/format"
import { toast } from "sonner"
import type { CampaignOrigin, CampaignPlatform } from "@/lib/types"

export function FluxoPage() {
  const { state, createFunnel, deleteFunnel, createJourney, deleteJourney, createCampaign, saveCampaign, deleteCampaign } = useStore()
  const navigate = useNavigate()
  const [campaignName, setCampaignName] = useState("")
  const [campaignPlatform, setCampaignPlatform] = useState<CampaignPlatform>("whatsapp")
  const [campaignOrigin, setCampaignOrigin] = useState<CampaignOrigin>("pagina")
  const [campaignJourneyId, setCampaignJourneyId] = useState("")
  const [campaignInvite, setCampaignInvite] = useState("")

  const botFlows = state.journeys.filter((item) => item.status !== "template")
  const funnels = state.funnels

  const createBot = () => {
    const journey = conversationJourney("Novo fluxo do bot")
    createJourney(journey)
    toast.success("Fluxo do bot criado.")
    navigate(`/fluxo/${journey.id}`)
  }

  const createSales = () => {
    const funnel = emptySalesFunnel("Novo funil")
    createFunnel(funnel)
    toast.success("Funil criado.")
    navigate(`/fluxo/funil/${funnel.id}`)
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="page-shell space-y-10">
        <PageHeading title="Fluxo" hint="Funis visuais, fluxos do bot e campanhas no mesmo sítio.">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="h-11 rounded-lg px-4" onClick={createSales}>
              <Plus /> Novo funil
            </Button>
            <Button className="h-11 rounded-lg px-4" onClick={createBot}>
              <Plus /> Novo fluxo do bot
            </Button>
          </div>
        </PageHeading>

        <section className="space-y-3">
          <div>
            <h2 className="text-[16px] font-semibold">Funil</h2>
            <p className="text-sm text-muted-foreground">Só desenho e métricas. Não envia WhatsApp nem Telegram.</p>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            {funnels.length === 0 && (
              <div className="surface px-6 py-12 text-center md:col-span-2">
                <p className="text-[15px] font-semibold">Nenhum funil visual</p>
                <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                  O quadro de tráfego → página → receita fica aqui. O bot não segue estes nós.
                </p>
                <Button className="mt-4 rounded-lg" onClick={createSales}>
                  <Plus /> Novo funil
                </Button>
              </div>
            )}
            {funnels.map((funnel) => (
              <div key={funnel.id} className="surface overflow-hidden">
                <div className="p-5 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <Link to={`/fluxo/funil/${funnel.id}`} className="min-w-0">
                      <p className="font-semibold truncate">{funnel.name}</p>
                      <p className="mt-1 text-[12px] text-muted-foreground">
                        {funnel.status === "active" ? "Activo" : "Rascunho"} · {timeAgo(funnel.updatedAt)}
                      </p>
                    </Link>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button asChild size="sm" className="rounded-lg">
                        <Link to={`/fluxo/funil/${funnel.id}`}>Abrir</Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Excluir funil"
                        onClick={() => {
                          if (!confirm("Remover este funil? Isto não se desfaz.")) return
                          deleteFunnel(funnel.id)
                          toast.success("Funil removido.")
                        }}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <div>
            <h2 className="text-[16px] font-semibold">Fluxo do bot</h2>
            <p className="text-sm text-muted-foreground">Mapa n8n. As folhas seguem estes nós no WhatsApp e no Telegram.</p>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            {botFlows.length === 0 && (
              <div className="surface px-6 py-12 text-center md:col-span-2">
                <p className="text-[15px] font-semibold">Nenhum fluxo do bot</p>
                <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                  Cria a partir do quadro: gatilho, mensagem e pergunta.
                </p>
                <Button className="mt-4 rounded-lg" onClick={createBot}>
                  <Plus /> Novo fluxo do bot
                </Button>
              </div>
            )}
            {botFlows.map((j) => (
              <div key={j.id} className="surface overflow-hidden">
                <Link to={`/fluxo/${j.id}`}>
                  <JourneyPreview journey={j} />
                </Link>
                <div className="p-5 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <Link to={`/fluxo/${j.id}`} className="min-w-0">
                      <p className="font-semibold truncate">{j.name}</p>
                      <p className="mt-1 text-[12px] text-muted-foreground">
                        {j.production || j.status === "active" ? "Activo" : "Rascunho"} · {timeAgo(j.updatedAt)}
                      </p>
                    </Link>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button asChild size="sm" className="rounded-lg">
                        <Link to={`/fluxo/${j.id}`}>Abrir</Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Excluir fluxo"
                        onClick={() => {
                          if (!confirm("Remover este fluxo? Isto não se desfaz.")) return
                          deleteJourney(j.id)
                          toast.success("Fluxo removido.")
                        }}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <div>
            <h2 className="text-[16px] font-semibold">Campanhas</h2>
            <p className="text-sm text-muted-foreground">Liga um fluxo do bot a WhatsApp ou Telegram.</p>
          </div>
          <div className="surface p-5 grid gap-3 md:grid-cols-[1fr_160px_160px_1fr_1fr_auto] md:items-end">
            <Field label="Nome">
              <Input value={campaignName} onChange={(e) => setCampaignName(e.target.value)} placeholder="Mini-curso Telegram" />
            </Field>
            <Field label="Plataforma">
              <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={campaignPlatform} onChange={(e) => setCampaignPlatform(e.target.value as CampaignPlatform)}>
                <option value="whatsapp">WhatsApp</option>
                <option value="telegram">Telegram</option>
              </select>
            </Field>
            <Field label="Origem">
              <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={campaignOrigin} onChange={(e) => setCampaignOrigin(e.target.value as CampaignOrigin)}>
                <option value="pagina">Página</option>
                <option value="fechamento">Fechamento</option>
              </select>
            </Field>
            <Field label="Fluxo do bot">
              <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={campaignJourneyId} onChange={(e) => setCampaignJourneyId(e.target.value)}>
                <option value="">Escolher depois</option>
                {botFlows.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Convite do grupo">
              <Input
                value={campaignInvite}
                onChange={(e) => setCampaignInvite(e.target.value)}
                placeholder={campaignPlatform === "telegram" ? "https://t.me/+" : "https://chat.whatsapp.com/"}
              />
            </Field>
            <Button
              className="rounded-lg"
              onClick={() => {
                const name = campaignName.trim()
                if (!name) {
                  toast.error("Dá um nome à campanha.")
                  return
                }
                createCampaign({
                  id: uid(),
                  name,
                  platform: campaignPlatform,
                  origin: campaignOrigin,
                  journeyId: campaignJourneyId || undefined,
                  groupInviteUrl: campaignInvite.trim() || undefined,
                  status: "draft",
                })
                setCampaignName("")
                setCampaignInvite("")
                toast.success("Campanha criada.")
              }}
            >
              Criar
            </Button>
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            {state.campaigns.length === 0 && <p className="text-sm text-muted-foreground md:col-span-2">Ainda não há campanhas.</p>}
            {state.campaigns.map((campaign) => {
              const journey = state.journeys.find((item) => item.id === campaign.journeyId)
              return (
                <div key={campaign.id} className="surface p-4 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{campaign.name}</p>
                    <p className="mt-1 text-[12px] text-muted-foreground">
                      {campaign.platform === "telegram" ? "Telegram" : "WhatsApp"} · {campaign.origin === "fechamento" ? "fechamento" : "página"} ·{" "}
                      {campaign.status === "active" ? "activa" : "rascunho"}
                      {journey ? ` · ${journey.name}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      size="sm"
                      variant={campaign.status === "active" ? "outline" : "default"}
                      className="rounded-lg"
                      onClick={() => {
                        saveCampaign({ ...campaign, status: campaign.status === "active" ? "draft" : "active" })
                        toast.success(campaign.status === "active" ? "Campanha em rascunho." : "Campanha activa.")
                      }}
                    >
                      {campaign.status === "active" ? "Pausar" : "Activar"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Excluir campanha"
                      onClick={() => {
                        if (!confirm("Remover esta campanha?")) return
                        deleteCampaign(campaign.id)
                        toast.success("Campanha removida.")
                      }}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  )
}
