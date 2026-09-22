import { useCallback, useEffect, useMemo, useState } from "react"
import { ScrollText } from "lucide-react"
import { PageChrome, StatusPill } from "@/components/layout/chrome"
import { PlatformFeedback } from "@/components/platform/platform-feedback"
import { Button } from "@/components/ui/button"
import { getPlatformOverviewRequest, type PlatformOverview } from "@/lib/platform-api"
import { timeAgo } from "@/lib/format"
import { maskAuditValue } from "@/lib/platform"
import { cn } from "@/lib/utils"

type LoadState = "loading" | "ready" | "error"

function auditLabel(action: string) {
  return action.replace(/[._]/g, " ")
}

export function LogsPage() {
  const [overview, setOverview] = useState<PlatformOverview | null>(null)
  const [state, setState] = useState<LoadState>("loading")
  const [error, setError] = useState("")
  const [tab, setTab] = useState<"diagnostics" | "audit">("diagnostics")

  const load = useCallback(async () => {
    setState("loading")
    setError("")
    try {
      setOverview(await getPlatformOverviewRequest())
      setState("ready")
    } catch (caught) {
      setOverview(null)
      setError(caught instanceof Error ? caught.message : "Não li os registos.")
      setState("error")
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const diagnostics = useMemo(
    () => [...(overview?.diagnostics ?? [])].sort((left, right) => right.at.localeCompare(left.at)),
    [overview]
  )
  const audit = useMemo(
    () => [...(overview?.audit ?? [])].sort((left, right) => right.at.localeCompare(left.at)),
    [overview]
  )
  const errors = diagnostics.filter((item) => item.level === "error").length

  return (
    <div className="h-full overflow-y-auto">
      <div className="page-shell">
        <PageChrome icon={ScrollText} title="Registos">
          <StatusPill tone={errors ? "danger" : "muted"}>{errors ? `${errors} erros` : "Sem erros"}</StatusPill>
          <Button type="button" variant="outline" className="h-8 rounded-full" onClick={() => void load()}>
            Actualizar
          </Button>
        </PageChrome>
        <p className="max-w-3xl text-[13px] leading-relaxed text-muted-foreground">
          Aqui ficam os avisos da operação e o histórico de alterações. Tokens e senhas nunca aparecem por completo.
        </p>

        {state === "loading" ? (
          <PlatformFeedback state="loading" title="A carregar os registos…" />
        ) : state === "error" ? (
          <PlatformFeedback state="error" title="Não li os registos" detail={error} onRetry={() => void load()} />
        ) : (
          <section className="surface overflow-hidden">
            <div className="flex gap-3 border-b border-border px-5 py-3 text-[13px]">
              <button
                type="button"
                aria-pressed={tab === "diagnostics"}
                onClick={() => setTab("diagnostics")}
                className={cn(
                  "min-h-8 pb-1",
                  tab === "diagnostics" ? "border-b-2 border-foreground font-medium" : "text-muted-foreground"
                )}
              >
                Avisos {diagnostics.length}
              </button>
              <button
                type="button"
                aria-pressed={tab === "audit"}
                onClick={() => setTab("audit")}
                className={cn(
                  "min-h-8 pb-1",
                  tab === "audit" ? "border-b-2 border-foreground font-medium" : "text-muted-foreground"
                )}
              >
                Alterações {audit.length}
              </button>
            </div>
            {tab === "diagnostics" ? (
              diagnostics.length === 0 ? (
                <p className="px-5 py-12 text-center text-[13px] text-muted-foreground">Nenhum aviso recente.</p>
              ) : (
                <ul className="divide-y">
                  {diagnostics.map((item) => (
                    <li key={item.id} className="px-5 py-3.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusPill tone={item.level === "error" ? "danger" : item.level === "warning" ? "warn" : "muted"}>
                          {item.level === "error" ? "Erro" : item.level === "warning" ? "Aviso" : "Info"}
                        </StatusPill>
                        <p className="text-[13.5px] font-medium">{item.message}</p>
                      </div>
                      {item.recommendation ? (
                        <p className="mt-1 text-[12.5px] text-muted-foreground">{item.recommendation}</p>
                      ) : null}
                      <p className="mt-1 text-[12px] text-muted-foreground">{timeAgo(item.at)}</p>
                    </li>
                  ))}
                </ul>
              )
            ) : audit.length === 0 ? (
              <p className="px-5 py-12 text-center text-[13px] text-muted-foreground">Ainda não há alterações registadas.</p>
            ) : (
              <ul className="divide-y">
                {audit.map((item) => {
                  const before = item.before ? maskAuditValue(item.before) : undefined
                  const after = item.after ? maskAuditValue(item.after) : undefined
                  return (
                    <li key={item.id} className="px-5 py-3.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusPill tone={item.result === "failure" ? "danger" : "success"}>
                          {item.result === "failure" ? "Falhou" : "Feito"}
                        </StatusPill>
                        <p className="text-[13.5px] font-medium">{auditLabel(item.action)}</p>
                      </div>
                      <p className="mt-1 text-[12.5px] text-muted-foreground">
                        {item.entityType} · {item.entityId}
                        {item.message ? ` · ${item.message}` : ""}
                      </p>
                      {before || after ? (
                        <p className="mt-1 text-[12px] text-muted-foreground">
                          {before ? `antes: ${JSON.stringify(before).slice(0, 160)}` : ""}
                          {before && after ? " → " : ""}
                          {after ? `depois: ${JSON.stringify(after).slice(0, 160)}` : ""}
                        </p>
                      ) : null}
                      <p className="mt-1 text-[12px] text-muted-foreground">{timeAgo(item.at)}</p>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        )}
      </div>
    </div>
  )
}
