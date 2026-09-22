import { useCallback, useEffect, useMemo, useState } from "react"
import { Link, useLocation, useParams } from "react-router-dom"
import { ArrowLeft, AudioLines, RefreshCw, RotateCcw } from "lucide-react"
import { toast } from "sonner"
import { PageChrome } from "@/components/layout/chrome"
import { PlatformFeedback } from "@/components/platform/platform-feedback"
import { formatPlatformDate } from "@/components/platform/platform-format"
import { AudioStatusPill } from "@/components/platform/platform-status"
import { Button } from "@/components/ui/button"
import {
  listAudioJobsRequest,
  retryAudioJobRequest,
  type AudioCatalog,
} from "@/lib/platform-api"

function useRequestedBotId() {
  const params = useParams()
  const location = useLocation()
  return params.botId || params.id || new URLSearchParams(location.search).get("botId") || ""
}

export function AudioPage() {
  const botId = useRequestedBotId()
  const [catalog, setCatalog] = useState<AudioCatalog | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [busyJobId, setBusyJobId] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      setCatalog(await listAudioJobsRequest(botId || undefined))
    } catch (caught) {
      setCatalog(null)
      setError(caught instanceof Error ? caught.message : "Não foi possível carregar os trabalhos de áudio.")
    } finally {
      setLoading(false)
    }
  }, [botId])

  useEffect(() => {
    void load()
  }, [load])

  const jobs = useMemo(
    () =>
      [...(catalog?.jobs ?? [])].sort((left, right) =>
        right.updatedAt.localeCompare(left.updatedAt)
      ),
    [catalog]
  )

  const assets = useMemo(
    () => new Map((catalog?.assets ?? []).map((asset) => [asset.id, asset])),
    [catalog]
  )

  const retry = async (jobId: string) => {
    if (busyJobId) return
    setBusyJobId(jobId)
    try {
      await retryAudioJobRequest(jobId)
      toast.success("Nova tentativa pedida.")
      await load()
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Não foi possível repetir o trabalho.")
    } finally {
      setBusyJobId("")
    }
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="page-shell">
        <PageChrome icon={AudioLines} title="Áudio">
          <Button asChild variant="outline" className="rounded-full">
            <Link to={botId ? `/bots/${encodeURIComponent(botId)}` : "/bots"}>
              <ArrowLeft />
              {botId ? "Voltar ao bot" : "Bots"}
            </Link>
          </Button>
          <Button
            type="button"
            variant="outline"
            className="rounded-full"
            disabled={loading || Boolean(busyJobId)}
            onClick={() => void load()}
          >
            <RefreshCw className={loading ? "animate-spin" : ""} />
            Atualizar
          </Button>
        </PageChrome>
        <p className="max-w-3xl text-[13px] leading-relaxed text-muted-foreground">
          Acompanha geração, envio e falhas dos trabalhos de áudio. Uma nova tentativa reutiliza o trabalho registado.
        </p>

        {loading ? (
          <PlatformFeedback state="loading" title="A carregar os trabalhos de áudio…" />
        ) : error ? (
          <PlatformFeedback
            state="error"
            title="Não foi possível carregar o áudio"
            detail={error}
            onRetry={() => void load()}
          />
        ) : !jobs.length ? (
          <PlatformFeedback
            state="empty"
            title="Ainda não há trabalhos de áudio"
            detail={
              botId
                ? "Este bot ainda não gerou nem enviou áudio."
                : "A plataforma ainda não registou trabalhos de áudio."
            }
          />
        ) : (
          <section className="surface overflow-hidden" aria-label="Trabalhos de áudio">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left">
                <thead className="border-b bg-muted/30 text-[11.5px] font-medium text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Trabalho</th>
                    {!botId ? <th className="px-4 py-3">Bot</th> : null}
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3">Progresso</th>
                    <th className="px-4 py-3">Tentativas</th>
                    <th className="px-4 py-3">Atualizado</th>
                    <th className="px-4 py-3 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {jobs.map((job) => {
                    const asset = assets.get(job.assetId)
                    const retrying = busyJobId === job.id
                    const progress = Number.isFinite(job.progress)
                      ? Math.max(0, Math.min(100, job.progress))
                      : undefined
                    return (
                      <tr key={job.id} className="align-top">
                        <td className="max-w-sm px-4 py-3.5">
                          <p className="break-all text-[12.5px] font-medium">{job.id}</p>
                          <p className="mt-1 break-all text-[11.5px] text-muted-foreground">
                            Recurso: {job.assetId}
                          </p>
                          {asset?.text ? (
                            <p className="mt-1 line-clamp-2 text-[11.5px] leading-relaxed text-muted-foreground">
                              {asset.text}
                            </p>
                          ) : null}
                        </td>
                        {!botId ? (
                          <td className="px-4 py-3.5 text-[12.5px]">
                            <Link
                              to={`/bots/${encodeURIComponent(job.botId)}/audio`}
                              className="break-all underline-offset-3 hover:underline"
                            >
                              {job.botId}
                            </Link>
                          </td>
                        ) : null}
                        <td className="px-4 py-3.5">
                          <AudioStatusPill status={job.status} />
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="w-32">
                            <div className="flex items-center justify-between gap-2 text-[11.5px]">
                              <span className="text-muted-foreground">Processado</span>
                              <span className="tabular-nums">{progress === undefined ? "—" : `${progress}%`}</span>
                            </div>
                            {progress === undefined ? null : (
                              <progress
                                className="mt-1 h-1.5 w-full accent-primary"
                                max={100}
                                value={progress}
                                aria-label={`Progresso: ${progress}%`}
                              />
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-[12.5px] tabular-nums">{job.attempts}</td>
                        <td className="px-4 py-3.5 text-[11.5px] text-muted-foreground">
                          {formatPlatformDate(job.updatedAt)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {job.status === "error" ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="rounded-full"
                              disabled={Boolean(busyJobId)}
                              onClick={() => void retry(job.id)}
                            >
                              <RotateCcw className={retrying ? "animate-spin" : ""} />
                              {retrying ? "A repetir…" : "Tentar novamente"}
                            </Button>
                          ) : (
                            <span className="text-[11.5px] text-muted-foreground">—</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {jobs.some((job) => job.status === "error") ? (
              <div className="border-t bg-muted/20">
                <h2 className="px-4 pt-4 text-[13.5px] font-medium">Erros</h2>
                <ul className="divide-y">
                  {jobs
                    .filter((job) => job.status === "error")
                    .map((job) => (
                      <li key={job.id} className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <AudioStatusPill status={job.status} />
                          <p className="break-all text-[12px] font-medium">{job.id}</p>
                          {job.errorCode ? (
                            <code className="rounded bg-muted px-1.5 py-0.5 text-[11px]">{job.errorCode}</code>
                          ) : null}
                        </div>
                        <p role="alert" className="mt-1.5 text-[12.5px] text-destructive">
                          {job.errorMessage || "A plataforma não devolveu uma mensagem de erro."}
                        </p>
                        {job.recommendation ? (
                          <p className="mt-1 text-[12px] text-muted-foreground">{job.recommendation}</p>
                        ) : null}
                      </li>
                    ))}
                </ul>
              </div>
            ) : null}
          </section>
        )}
      </div>
    </div>
  )
}
