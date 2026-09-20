import { Link, useParams } from "react-router-dom"
import { SalesCanvas } from "@/components/sales/canvas"
import { HydratePanel } from "@/components/layout/hydrate-panel"
import { SyncBanner } from "@/components/layout/sync-banner"
import { Button } from "@/components/ui/button"
import { NotFoundPage } from "@/pages/not-found"
import { useStore } from "@/lib/store"

export function FunnelEditorPage() {
  const { id } = useParams()
  const { state, saveFunnel, flushCrmNow, crmSync } = useStore()
  const funnel = state.funnels.find((item) => item.id === id)

  if (!funnel && crmSync === "idle") {
    return (
      <div className="grid h-full place-items-center bg-background" role="status" aria-live="polite">
        <p className="text-[13px] text-muted-foreground">A carregar o quadro…</p>
      </div>
    )
  }

  if (!funnel && crmSync === "error") {
    return (
      <div className="flex h-full min-h-0 flex-col">
        <SyncBanner items={[{ ok: false, message: "Não consegui ler os funis do Worker. O quadro local pode estar desactualizado." }]} />
        <HydratePanel className="flex-1">
          Não consegui ler este quadro no Worker. Volta à lista ou tenta outra vez.
        </HydratePanel>
        <div className="flex justify-center pb-10">
          <Button asChild className="rounded-full">
            <Link to="/fluxo">Voltar aos funis</Link>
          </Button>
        </div>
      </div>
    )
  }

  if (!funnel) {
    return (
      <NotFoundPage
        title="Funil não encontrado"
        hint="Este quadro não está no CRM. Pode ter sido removido ou o endereço está incompleto."
        to="/fluxo"
        action="Voltar aos funis"
      />
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <SyncBanner items={[{ ok: crmSync !== "error", message: "Não gravei o funil no Worker." }]} />
      <div className="min-h-0 flex-1">
        <SalesCanvas key={funnel.id} funnel={funnel} onSave={saveFunnel} onFlush={flushCrmNow} />
      </div>
    </div>
  )
}
