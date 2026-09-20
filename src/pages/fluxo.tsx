import { useRef, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { Pencil, Plus, Trash2, Workflow } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PageChrome, StatusPill } from "@/components/layout/chrome"
import { SyncBanner } from "@/components/layout/sync-banner"
import { FunnelPreview } from "@/components/sales/preview"
import { RenameFunnelDialog } from "@/components/sales/rename-dialog"
import { canDeleteFunnel } from "@/lib/crm"
import { useStore } from "@/lib/store"
import { emptySalesFunnel } from "@/lib/templates"
import { timeAgo } from "@/lib/format"
import type { SalesFunnel } from "@/lib/types"
import { toast } from "sonner"

export function FluxoPage() {
  const { state, createFunnel, saveFunnel, deleteFunnel, crmSync } = useStore()
  const navigate = useNavigate()
  const funnels = state.funnels
  const [renaming, setRenaming] = useState<SalesFunnel | null>(null)
  const creating = useRef(false)

  const createSales = () => {
    if (creating.current) return
    creating.current = true
    const funnel = emptySalesFunnel("Novo funil")
    createFunnel(funnel)
    toast.success("Funil criado.")
    navigate(`/fluxo/funil/${funnel.id}`)
    window.setTimeout(() => {
      creating.current = false
    }, 800)
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="page-shell">
        <SyncBanner
          items={[{ ok: crmSync !== "error", message: "Não consegui ler os funis do Worker. O quadro local pode estar desactualizado." }]}
        />
        <PageChrome icon={Workflow} title="Funil">
          <Button type="button" className="h-8 rounded-full px-3.5" onClick={createSales}>
            <Plus /> Novo funil
          </Button>
        </PageChrome>

        <div className="grid gap-3 md:grid-cols-2">
          {funnels.length === 0 && (
            <div className="surface px-6 py-16 text-center md:col-span-2">
              <p className="text-[14px] font-medium">Nenhum funil</p>
              <p className="mx-auto mt-1 max-w-md text-[13.5px] text-muted-foreground">
                O quadro publicado é o que a Sté fala. Boas-vindas, minicurso, Superbet e remarketing editam-se aqui. O rascunho grava sozinho.
              </p>
              <Button type="button" className="mt-5 rounded-full" onClick={createSales}>
                <Plus /> Novo funil
              </Button>
            </div>
          )}
          {funnels.map((funnel) => {
            const gate = canDeleteFunnel(funnels, funnel.id)
            return (
            <article key={funnel.id} className="surface overflow-hidden">
              <Link to={`/fluxo/funil/${funnel.id}`} className="block" aria-label={`Abrir ${funnel.name}`}>
                <FunnelPreview funnel={funnel} />
              </Link>
              <div className="flex items-start justify-between gap-3 px-5 py-4">
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-medium">{funnel.name}</p>
                  <p className="mt-1.5 flex items-center gap-2 text-[12px] text-muted-foreground">
                    <StatusPill tone={funnel.status === "active" ? "success" : "muted"}>
                      {funnel.status === "active" ? "Publicado" : "Rascunho"}
                    </StatusPill>
                    {timeAgo(funnel.updatedAt)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button type="button" variant="ghost" size="sm" className="rounded-full" onClick={() => setRenaming(funnel)}>
                    <Pencil />
                    Renomear
                  </Button>
                  <Button asChild size="sm" className="rounded-full">
                    <Link to={`/fluxo/funil/${funnel.id}`}>Abrir</Link>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="rounded-full"
                    disabled={!gate.ok}
                    title={gate.ok ? "Excluir funil" : gate.reason}
                    aria-label={gate.ok ? "Excluir funil" : gate.reason}
                    onClick={() => {
                      if (!gate.ok) {
                        toast.error(gate.reason)
                        return
                      }
                      if (!confirm("Remover este funil? Isto não se desfaz.")) return
                      if (!deleteFunnel(funnel.id)) return
                      toast.success("Funil removido.")
                    }}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </div>
            </article>
            )
          })}
        </div>
      </div>

      <RenameFunnelDialog
        open={Boolean(renaming)}
        name={renaming?.name ?? ""}
        onOpenChange={(open) => {
          if (!open) setRenaming(null)
        }}
        onSave={(name) => {
          if (!renaming) return
          saveFunnel({ ...renaming, name, updatedAt: new Date().toISOString() })
          toast.success("Nome actualizado.")
        }}
      />
    </div>
  )
}
