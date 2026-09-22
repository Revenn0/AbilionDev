import { useCallback, useEffect, useMemo, useState } from "react"
import { Link, useLocation, useParams } from "react-router-dom"
import {
  AlertTriangle,
  ArrowLeft,
  AudioLines,
  Bot as BotIcon,
  BrainCircuit,
  Cable,
  RefreshCw,
  RotateCcw,
  Workflow,
} from "lucide-react"
import { toast } from "sonner"
import { PageChrome, StatusPill } from "@/components/layout/chrome"
import { ConfirmActionDialog, PlatformFeedback } from "@/components/platform/platform-feedback"
import { environmentLabel, formatPlatformDate } from "@/components/platform/platform-format"
import {
  BotStatusPill,
  IntegrationStatusPill,
  VersionStatusPill,
} from "@/components/platform/platform-status"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  listBotsRequest,
  listBrainVersionsRequest,
  reconnectBotRequest,
  resetBotIntegrationRequest,
  switchBotIntegrationRequest,
  type BotsCatalog,
  type BrainCatalog,
} from "@/lib/platform-api"
import type { BotDefinition, BotIntegration } from "@/lib/platform"

type DetailState = {
  bot: BotDefinition
  integration?: BotIntegration
  brain: BrainCatalog
  catalog: BotsCatalog
}

function useRequestedBotId() {
  const params = useParams()
  const location = useLocation()
  return params.botId || params.id || new URLSearchParams(location.search).get("botId") || ""
}

export function BotDetailPage() {
  const botId = useRequestedBotId()
  const [detail, setDetail] = useState<DetailState | null>(null)
  const [loading, setLoading] = useState(Boolean(botId))
  const [error, setError] = useState("")
  const [notFound, setNotFound] = useState(false)
  const [busy, setBusy] = useState("")
  const [switchOpen, setSwitchOpen] = useState(false)
  const [resetOpen, setResetOpen] = useState(false)
  const [token, setToken] = useState("")

  const load = useCallback(async () => {
    if (!botId) return
    setLoading(true)
    setError("")
    setNotFound(false)
    try {
      const [catalog, brain] = await Promise.all([
        listBotsRequest(botId),
        listBrainVersionsRequest(botId),
      ])
      const bot = catalog.bots.find((item) => item.id === botId)
      if (!bot) {
        setDetail(null)
        setNotFound(true)
        return
      }
      const integration =
        (bot.integrationId
          ? catalog.integrations.find((item) => item.id === bot.integrationId)
          : undefined) ?? catalog.integrations.find((item) => item.botId === bot.id)
      setDetail({ bot, integration, brain, catalog })
    } catch (caught) {
      setDetail(null)
      setError(caught instanceof Error ? caught.message : "Não foi possível carregar o bot.")
    } finally {
      setLoading(false)
    }
  }, [botId])

  useEffect(() => {
    void load()
  }, [load])

  const activeBrain = useMemo(() => {
    if (!detail) return undefined
    const activeId = detail.bot.activeBrainVersionId || detail.brain.activeVersionId
    return detail.brain.versions.find((item) => item.id === activeId)
  }, [detail])

  const errors = useMemo(() => {
    if (!detail) return []
    return detail.catalog.diagnostics.filter(
      (item) =>
        item.level === "error" &&
        (item.botId === detail.bot.id ||
          (detail.integration && item.integrationId === detail.integration.id))
    )
  }, [detail])

  const runAction = async (key: string, action: () => Promise<unknown>, success: string) => {
    if (busy) return false
    setBusy(key)
    try {
      await action()
      toast.success(success)
      await load()
      return true
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Não foi possível concluir a operação.")
      return false
    } finally {
      setBusy("")
    }
  }

  const openSwitch = () => {
    setToken("")
    setSwitchOpen(true)
  }

  if (!botId) {
    return (
      <div className="h-full overflow-y-auto">
        <div className="page-shell">
          <PlatformFeedback
            state="error"
            title="Endereço do bot incompleto"
            detail="Abre o detalhe a partir da lista de bots."
          />
        </div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="page-shell">
        <PageChrome icon={BotIcon} title={detail?.bot.name || "Detalhe do bot"}>
          <Button asChild variant="outline" className="rounded-full">
            <Link to="/bots">
              <ArrowLeft />
              Bots
            </Link>
          </Button>
          {detail ? <BotStatusPill status={detail.bot.status} /> : null}
        </PageChrome>

        {loading ? (
          <PlatformFeedback state="loading" title="A carregar o bot…" />
        ) : error ? (
          <PlatformFeedback
            state="error"
            title="Não foi possível carregar o bot"
            detail={error}
            onRetry={() => void load()}
          />
        ) : notFound || !detail ? (
          <PlatformFeedback
            state="empty"
            title="Bot não encontrado"
            detail="O bot pode ter sido excluído ou o endereço está incorreto."
          />
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="max-w-3xl text-[13px] leading-relaxed text-muted-foreground">
                {detail.bot.description || "Sem descrição."}
              </p>
              <p className="text-[11.5px] text-muted-foreground">
                Atualizado em {formatPlatformDate(detail.bot.updatedAt)}
              </p>
            </div>

            <section className="grid gap-3 xl:grid-cols-2" aria-label="Configuração do bot">
              <article className="surface p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Cable className="size-4 text-muted-foreground" />
                    <div>
                      <h2 className="text-[14px] font-medium">Integração</h2>
                      <p className="mt-0.5 text-[12px] text-muted-foreground">Canal e ligação externa</p>
                    </div>
                  </div>
                  {detail.integration ? (
                    <IntegrationStatusPill status={detail.integration.status} />
                  ) : (
                    <StatusPill>Não ligada</StatusPill>
                  )}
                </div>
                {detail.integration ? (
                  <dl className="mt-5 space-y-3 text-[12.5px]">
                    <InfoRow label="Canal" value="Telegram" />
                    <InfoRow label="Ambiente" value={environmentLabel(detail.integration.environment)} />
                    <InfoRow label="Utilizador" value={detail.integration.externalUsername || "—"} />
                    <InfoRow
                      label="Webhook"
                      value={detail.integration.webhookOk ? "Confirmado" : "Não confirmado"}
                    />
                    <InfoRow label="Credencial" value={detail.integration.tokenHint || "Sem credencial confirmada"} />
                    <InfoRow label="Última verificação" value={formatPlatformDate(detail.integration.lastVerifiedAt)} />
                  </dl>
                ) : (
                  <p className="mt-5 text-[12.5px] leading-relaxed text-muted-foreground">
                    Este bot ainda não tem uma integração associada.
                  </p>
                )}
                {detail.integration?.lastError ? (
                  <p role="alert" className="mt-4 rounded-xl bg-destructive/5 px-3 py-2.5 text-[12px] text-destructive">
                    {detail.integration.lastError}
                  </p>
                ) : null}
                <div className="mt-5 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-full"
                    disabled={!detail.integration || Boolean(busy)}
                    onClick={() =>
                      void runAction(
                        "reconnect",
                        () => reconnectBotRequest(detail.bot.id, detail.integration?.id),
                        "Integração reconectada."
                      )
                    }
                  >
                    <RefreshCw className={busy === "reconnect" ? "animate-spin" : ""} />
                    {busy === "reconnect" ? "A reconectar…" : "Reconectar"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-full"
                    disabled={Boolean(busy)}
                    onClick={openSwitch}
                  >
                    <Cable />
                    Trocar integração
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    className="rounded-full"
                    disabled={!detail.integration || Boolean(busy)}
                    onClick={() => setResetOpen(true)}
                  >
                    <RotateCcw />
                    Resetar
                  </Button>
                </div>
              </article>

              <article className="surface p-5">
                <div className="flex items-center gap-2">
                  <Workflow className="size-4 text-muted-foreground" />
                  <div>
                    <h2 className="text-[14px] font-medium">Fluxo</h2>
                    <p className="mt-0.5 text-[12px] text-muted-foreground">Funil predefinido deste bot</p>
                  </div>
                </div>
                {detail.bot.defaultFunnelId ? (
                  <>
                    <p className="mt-5 break-all text-[13px] font-medium">{detail.bot.defaultFunnelId}</p>
                    <Button asChild variant="outline" className="mt-4 rounded-full">
                      <Link to={`/fluxo/funil/${encodeURIComponent(detail.bot.defaultFunnelId)}`}>
                        Abrir fluxo
                      </Link>
                    </Button>
                  </>
                ) : (
                  <p className="mt-5 text-[12.5px] text-muted-foreground">Nenhum fluxo associado.</p>
                )}
              </article>

              <article className="surface p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <BrainCircuit className="size-4 text-muted-foreground" />
                    <div>
                      <h2 className="text-[14px] font-medium">Cérebro</h2>
                      <p className="mt-0.5 text-[12px] text-muted-foreground">Versão ativa e instruções</p>
                    </div>
                  </div>
                  {activeBrain ? <VersionStatusPill status={activeBrain.status} /> : null}
                </div>
                {activeBrain ? (
                  <div className="mt-5">
                    <p className="text-[13px] font-medium">
                      v{activeBrain.version} · {activeBrain.name}
                    </p>
                    <p className="mt-1 text-[12px] text-muted-foreground">
                      {activeBrain.language} · {activeBrain.tone}
                    </p>
                  </div>
                ) : detail.bot.activeBrainVersionId ? (
                  <p className="mt-5 break-all text-[12.5px] text-muted-foreground">
                    Versão ativa: {detail.bot.activeBrainVersionId}
                  </p>
                ) : (
                  <p className="mt-5 text-[12.5px] text-muted-foreground">Nenhuma versão ativa.</p>
                )}
                <Button asChild variant="outline" className="mt-4 rounded-full">
                  <Link to={`/bots/${encodeURIComponent(detail.bot.id)}/brain`}>Gerir cérebro</Link>
                </Button>
              </article>

              <article className="surface p-5">
                <div className="flex items-center gap-2">
                  <AudioLines className="size-4 text-muted-foreground" />
                  <div>
                    <h2 className="text-[14px] font-medium">Voz</h2>
                    <p className="mt-0.5 text-[12px] text-muted-foreground">Perfil e trabalhos de áudio</p>
                  </div>
                </div>
                <p className="mt-5 break-all text-[13px] font-medium">
                  {detail.bot.voiceProfileId || activeBrain?.voiceProfileId || "Sem perfil de voz"}
                </p>
                <Button asChild variant="outline" className="mt-4 rounded-full">
                  <Link to={`/bots/${encodeURIComponent(detail.bot.id)}/audio`}>Ver trabalhos de áudio</Link>
                </Button>
              </article>
            </section>

            <section className="surface overflow-hidden" aria-label="Erros recentes">
              <div className="flex items-center gap-2 border-b px-5 py-4">
                <AlertTriangle className="size-4 text-muted-foreground" />
                <h2 className="text-[14px] font-medium">Erros recentes</h2>
              </div>
              {errors.length ? (
                <ul className="divide-y">
                  {errors.map((item) => (
                    <li key={item.id} className="px-5 py-3.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-[12.5px] font-medium">{item.code}</p>
                        <time className="text-[11.5px] text-muted-foreground">{formatPlatformDate(item.at)}</time>
                      </div>
                      <p className="mt-1 text-[12.5px] text-destructive">{item.message}</p>
                      {item.recommendation ? (
                        <p className="mt-1 text-[12px] text-muted-foreground">{item.recommendation}</p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-5 py-6 text-[12.5px] text-muted-foreground">Sem erros registados para este bot.</p>
              )}
            </section>
          </>
        )}
      </div>

      <Dialog
        open={switchOpen}
        onOpenChange={(next) => {
          if (busy === "switch") return
          setSwitchOpen(next)
          if (!next) setToken("")
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Trocar integração</DialogTitle>
            <DialogDescription>
              A credencial é enviada diretamente para a plataforma e não volta a ser mostrada.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault()
              if (!detail || !token.trim() || busy) return
              const credential = token
              setToken("")
              void runAction(
                "switch",
                () =>
                  switchBotIntegrationRequest({
                    botId: detail.bot.id,
                    integrationId: detail.integration?.id,
                    token: credential,
                  }),
                "Integração trocada."
              ).then((ok) => {
                if (ok) setSwitchOpen(false)
              })
            }}
          >
            <fieldset disabled={busy === "switch"} className="space-y-4 border-0 p-0">
              <div className="space-y-1.5">
                <Label htmlFor="switch-token">Token do bot</Label>
                <Input
                  id="switch-token"
                  type="password"
                  value={token}
                  onChange={(event) => setToken(event.target.value)}
                  autoComplete="off"
                  required
                />
                <p className="text-[11.5px] text-muted-foreground">
                  O token completo não é devolvido pela API nem aparece no detalhe.
                </p>
              </div>
            </fieldset>
            <DialogFooter>
              <Button type="button" variant="outline" disabled={busy === "switch"} onClick={() => setSwitchOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={busy === "switch" || !token.trim()}>
                {busy === "switch" ? "A trocar…" : "Trocar integração"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmActionDialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        title="Resetar integração?"
        description="A ligação atual será removida deste bot. Será necessário informar uma nova credencial para voltar a ligar."
        confirmLabel="Resetar integração"
        destructive
        busy={busy === "reset"}
        onConfirm={() => {
          if (!detail) return
          void runAction(
            "reset",
            () => resetBotIntegrationRequest(detail.bot.id, detail.integration?.id),
            "Integração resetada."
          ).then((ok) => {
            if (ok) setResetOpen(false)
          })
        }}
      />
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="break-all text-right font-medium">{value}</dd>
    </div>
  )
}
