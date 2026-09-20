import { useRef, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { Code2, Pencil, Plus, Trash2, Upload, Workflow } from "lucide-react"
import { ImportFunnelDialog } from "@/components/sales/import-dialog"
import { Button } from "@/components/ui/button"
import { PageChrome, StatusPill } from "@/components/layout/chrome"
import { HydratePanel } from "@/components/layout/hydrate-panel"
import { SyncBanner } from "@/components/layout/sync-banner"
import { FunnelPreview } from "@/components/sales/preview"
import { RenameFunnelDialog } from "@/components/sales/rename-dialog"
import { canCreateFunnel, canDeleteFunnel } from "@/lib/crm"
import { addPageScript, funnelHasInstallableBoard } from "@/lib/page-script"
import { useStore } from "@/lib/store"
import { emptySalesFunnel } from "@/lib/templates"
import { timeAgo } from "@/lib/format"
import type { SalesFunnel } from "@/lib/types"
import { toast } from "sonner"

export function FluxoPage() {
  const { state, createFunnel, saveFunnel, deleteFunnel, flushCrmNow, saveSettings, crmSync } = useStore()
  const navigate = useNavigate()
  const funnels = state.funnels
  const [renaming, setRenaming] = useState<SalesFunnel | null>(null)
  const [importing, setImporting] = useState(false)
  const creating = useRef(false)

  const createSales = () => {
    if (creating.current) return
    const gate = canCreateFunnel(funnels)
    if (!gate.ok) {
      toast.error(gate.reason)
      return
    }
    creating.current = true
    const funnel = emptySalesFunnel("Novo funil")
    createFunnel(funnel)
    navigate(`/fluxo/funil/${funnel.id}`)
    void flushCrmNow()
      .then((result) => {
        if (result.ok && result.queued) toast.message("Funil criado. A gravar no Worker…")
        else if (result.ok) toast.success("Funil criado.")
        else toast.error(result.error || "Não gravei o funil no Worker.")
      })
      .finally(() => {
        creating.current = false
      })
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="page-shell">
        <SyncBanner
          items={[{ ok: crmSync !== "error", message: "Não consegui ler os funis do Worker. O quadro local pode estar desactualizado." }]}
        />
        <PageChrome icon={Workflow} title="Funil">
          <Button type="button" variant="outline" className="h-8 rounded-full px-3.5" onClick={() => setImporting(true)}>
            <Upload /> Importar
          </Button>
          <Button type="button" className="h-8 rounded-full px-3.5" onClick={createSales}>
            <Plus /> Novo funil
          </Button>
        </PageChrome>

        <div className="grid gap-3 md:grid-cols-2">
          {funnels.length === 0 && crmSync === "idle" ? (
            <HydratePanel className="surface md:col-span-2">A carregar os funis…</HydratePanel>
          ) : funnels.length === 0 ? (
            <div className="surface px-6 py-16 text-center md:col-span-2">
              <p className="text-[14px] font-medium">Nenhum funil</p>
              <p className="mx-auto mt-1 max-w-md text-[13.5px] text-muted-foreground">
                O quadro publicado é o que a Sté fala. Boas-vindas, minicurso, Superbet e remarketing editam-se aqui. O rascunho grava sozinho.
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                <Button type="button" variant="outline" className="rounded-full" onClick={() => setImporting(true)}>
                  <Upload /> Importar
                </Button>
                <Button type="button" className="rounded-full" onClick={createSales}>
                  <Plus /> Novo funil
                </Button>
              </div>
            </div>
          ) : null}
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
                    <StatusPill tone={funnel.status === "active" && funnel.production ? "success" : "muted"}>
                      {funnel.status === "active" && funnel.production ? "Publicado" : "Rascunho"}
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
                  {funnelHasInstallableBoard(funnel) ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="rounded-full"
                      onClick={() => {
                        const made = addPageScript(state.settings.pageScripts, { name: funnel.name, funnelId: funnel.id })
                        if (!made.ok) {
                          toast.error(made.error)
                          return
                        }
                        saveSettings({ pageScripts: made.scripts })
                        void flushCrmNow().then((result) => {
                          if (result.ok) toast.success("Script desta página criado. Cola o snippet no Pixel.")
                          else toast.error(result.error || "Não gravei o script no Worker.")
                        })
                        navigate("/telegram#pixel")
                      }}
                    >
                      <Code2 />
                      Script
                    </Button>
                  ) : null}
                  <Button
                    type="button"
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
                      void deleteFunnel(funnel.id).then((ok) => {
                        if (ok) toast.success("Funil removido.")
                        else toast.error("Não removi o funil no Worker.")
                      })
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

      <ImportFunnelDialog
        open={importing}
        onOpenChange={setImporting}
        onImported={(funnel) => {
          createFunnel(funnel)
          toast.success("Funil importado como rascunho.")
          navigate(`/fluxo/funil/${funnel.id}`)
        }}
      />
      <RenameFunnelDialog
        open={Boolean(renaming)}
        name={renaming?.name ?? ""}
        onOpenChange={(open) => {
          if (!open) setRenaming(null)
        }}
        onSave={(name) => {
          if (!renaming) return
          saveFunnel({ ...renaming, name, updatedAt: new Date().toISOString() })
          void flushCrmNow().then((result) => {
            if (result.ok && result.queued) toast.message("Nome no painel. A gravar no Worker…")
            else if (result.ok) toast.success("Nome actualizado.")
            else toast.error(result.error || "Não gravei o nome no Worker.")
          })
        }}
      />
    </div>
  )
}
