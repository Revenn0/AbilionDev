import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { Pencil, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PageHeading } from "@/components/page-heading"
import { FunnelPreview } from "@/components/sales/preview"
import { RenameFunnelDialog } from "@/components/sales/rename-dialog"
import { useStore } from "@/lib/store"
import { emptySalesFunnel } from "@/lib/templates"
import { timeAgo } from "@/lib/format"
import type { SalesFunnel } from "@/lib/types"
import { toast } from "sonner"

export function FluxoPage() {
  const { state, createFunnel, saveFunnel, deleteFunnel } = useStore()
  const navigate = useNavigate()
  const funnels = state.funnels
  const [renaming, setRenaming] = useState<SalesFunnel | null>(null)

  const createSales = () => {
    const funnel = emptySalesFunnel("Novo funil")
    createFunnel(funnel)
    toast.success("Funil criado.")
    navigate(`/fluxo/funil/${funnel.id}`)
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="page-shell">
        <PageHeading title="Funil" hint="Quadro visual de tráfego, páginas e mensagens.">
          <Button className="h-10 rounded-lg px-4" onClick={createSales}>
            <Plus /> Novo funil
          </Button>
        </PageHeading>

        <div className="grid gap-4 md:grid-cols-2">
          {funnels.length === 0 && (
            <div className="surface px-6 py-14 text-center md:col-span-2">
              <p className="text-[14px] font-medium">Nenhum funil</p>
              <p className="mx-auto mt-1 max-w-md text-[13.5px] text-muted-foreground">
                Cria o primeiro quadro: fonte de tráfego, divisor e página de vendas.
              </p>
              <Button className="mt-5 rounded-lg" onClick={createSales}>
                <Plus /> Novo funil
              </Button>
            </div>
          )}
          {funnels.map((funnel) => (
            <article key={funnel.id} className="surface overflow-hidden">
              <Link to={`/fluxo/funil/${funnel.id}`} className="block border-b border-border" aria-label={`Abrir ${funnel.name}`}>
                <FunnelPreview funnel={funnel} />
              </Link>
              <div className="flex items-start justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="truncate font-medium">{funnel.name}</p>
                  <p className="mt-1 text-[12.5px] text-muted-foreground">
                    {funnel.status === "active" ? "Publicado" : "Rascunho"} · {timeAgo(funnel.updatedAt)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-lg"
                    onClick={() => setRenaming(funnel)}
                  >
                    <Pencil />
                    Renomear
                  </Button>
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
            </article>
          ))}
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
