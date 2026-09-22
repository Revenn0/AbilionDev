import { useCallback, useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { Archive, Bot as BotIcon, Copy, Pause, Play, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { PageChrome, StatusPill } from "@/components/layout/chrome"
import { ConfirmActionDialog, PlatformFeedback } from "@/components/platform/platform-feedback"
import { environmentLabel } from "@/components/platform/platform-format"
import { BotStatusPill, IntegrationStatusPill } from "@/components/platform/platform-status"
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
  archiveBotRequest,
  createBotRequest,
  deleteBotRequest,
  duplicateBotRequest,
  listBotsRequest,
  patchBotRequest,
  type BotsCatalog,
} from "@/lib/platform-api"
import { useAccess } from "@/lib/use-access"
import { botIsRecent, type BotDefinition } from "@/lib/platform"

type ConfirmState = {
  kind: "archive" | "delete"
  bot: BotDefinition
}

export function BotsPage() {
  const { can } = useAccess()
  const [catalog, setCatalog] = useState<BotsCatalog | null>(null)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [confirm, setConfirm] = useState<ConfirmState | null>(null)
  const [busyKey, setBusyKey] = useState("")
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [locale, setLocale] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      setCatalog(await listBotsRequest())
    } catch (caught) {
      setCatalog(null)
      setError(caught instanceof Error ? caught.message : "Não foi possível carregar os bots.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const integrationByBot = useMemo(() => {
    const byBot = new Map<string, BotsCatalog["integrations"][number]>()
    for (const integration of catalog?.integrations ?? []) byBot.set(integration.botId, integration)
    return byBot
  }, [catalog])

  const errorsByBot = useMemo(() => {
    const byBot = new Map<string, number>()
    for (const diagnostic of catalog?.diagnostics ?? []) {
      if (diagnostic.level !== "error" || !diagnostic.botId) continue
      byBot.set(diagnostic.botId, (byBot.get(diagnostic.botId) ?? 0) + 1)
    }
    for (const integration of catalog?.integrations ?? []) {
      if (!integration.lastError) continue
      byBot.set(integration.botId, (byBot.get(integration.botId) ?? 0) + 1)
    }
    return byBot
  }, [catalog])

  const runAction = async (key: string, action: () => Promise<unknown>, success: string) => {
    if (busyKey) return false
    setBusyKey(key)
    try {
      await action()
      toast.success(success)
      await load()
      return true
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Não foi possível concluir a operação.")
      return false
    } finally {
      setBusyKey("")
    }
  }

  const resetCreateForm = () => {
    setName("")
    setDescription("")
    setLocale("")
  }

  const creating = busyKey === "create"

  return (
    <div className="h-full overflow-y-auto">
      <div className="page-shell">
        <PageChrome icon={BotIcon} title="Bots">
          {can("bots.write") ? (
            <Button
              type="button"
              className="rounded-full"
              disabled={loading || Boolean(error) || Boolean(busyKey)}
              onClick={() => setCreateOpen(true)}
            >
              <Plus />
              Criar bot
            </Button>
          ) : null}
        </PageChrome>
        <p className="max-w-3xl text-[13px] leading-relaxed text-muted-foreground">
          Gere cada bot, a respetiva integração e o ambiente onde opera. Credenciais nunca aparecem nesta lista.
        </p>

        {loading ? (
          <PlatformFeedback state="loading" title="A carregar os bots…" />
        ) : error ? (
          <PlatformFeedback
            state="error"
            title="Não foi possível carregar os bots"
            detail={error}
            onRetry={() => void load()}
          />
        ) : !catalog?.bots.length ? (
          <PlatformFeedback
            state="empty"
            title="Ainda não há bots"
            detail="Cria o primeiro bot para começar a configurar a integração, o fluxo, o cérebro e a voz."
          />
        ) : (
          <section className="surface overflow-hidden" aria-label="Lista de bots">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1080px] text-left">
                <thead className="border-b bg-muted/30 text-[11.5px] font-medium text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Nome</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3">Responsável</th>
                    <th className="px-4 py-3">Ambiente</th>
                    <th className="px-4 py-3">Integração</th>
                    <th className="px-4 py-3">Novo</th>
                    <th className="px-4 py-3">Erros</th>
                    <th className="px-4 py-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {catalog.bots.map((bot) => {
                    const integration =
                      (bot.integrationId
                        ? catalog.integrations.find((item) => item.id === bot.integrationId)
                        : undefined) ?? integrationByBot.get(bot.id)
                    const errorCount = errorsByBot.get(bot.id) ?? 0
                    const duplicateBusy = busyKey === `duplicate:${bot.id}`
                    const statusBusy = busyKey === `status:${bot.id}`
                    return (
                      <tr key={bot.id} className="align-top">
                        <td className="px-4 py-3.5">
                          <Link
                            to={`/bots/${encodeURIComponent(bot.id)}`}
                            className="text-[13.5px] font-medium underline-offset-3 hover:underline"
                          >
                            {bot.name}
                          </Link>
                          {bot.description ? (
                            <p className="mt-1 max-w-60 truncate text-[11.5px] text-muted-foreground">
                              {bot.description}
                            </p>
                          ) : null}
                        </td>
                        <td className="px-4 py-3.5">
                          <BotStatusPill status={bot.status} />
                        </td>
                        <td className="px-4 py-3.5 text-[12.5px]">
                          {bot.ownerId || <span className="text-muted-foreground">Não atribuído</span>}
                        </td>
                        <td className="px-4 py-3.5 text-[12.5px]">
                          {integration ? (
                            environmentLabel(integration.environment)
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5">
                          {integration ? (
                            <div className="space-y-1.5">
                              <IntegrationStatusPill status={integration.status} />
                              <p className="max-w-48 truncate text-[11.5px] text-muted-foreground">
                                {integration.externalUsername || "Telegram"}
                              </p>
                            </div>
                          ) : (
                            <StatusPill>Não ligada</StatusPill>
                          )}
                        </td>
                        <td className="px-4 py-3.5">
                          {botIsRecent(bot) ? <StatusPill tone="success">Novo</StatusPill> : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="px-4 py-3.5">
                          {errorCount ? (
                            <StatusPill tone="danger">
                              {errorCount} {errorCount === 1 ? "erro" : "erros"}
                            </StatusPill>
                          ) : (
                            <span className="text-[12.5px] text-muted-foreground">Sem erros</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              disabled={Boolean(busyKey)}
                              onClick={() =>
                                void runAction(
                                  `duplicate:${bot.id}`,
                                  () => duplicateBotRequest(bot.id),
                                  "Bot duplicado."
                                )
                              }
                            >
                              <Copy />
                              {duplicateBusy ? "A duplicar…" : "Duplicar"}
                            </Button>
                            {bot.status === "active" || bot.status === "paused" ? (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                disabled={Boolean(busyKey)}
                                onClick={() =>
                                  void runAction(
                                    `status:${bot.id}`,
                                    () =>
                                      patchBotRequest({
                                        id: bot.id,
                                        status: bot.status === "paused" ? "active" : "paused",
                                      }),
                                    bot.status === "paused" ? "Bot retomado." : "Bot pausado."
                                  )
                                }
                              >
                                {bot.status === "paused" ? <Play /> : <Pause />}
                                {statusBusy
                                  ? bot.status === "paused"
                                    ? "A retomar…"
                                    : "A pausar…"
                                  : bot.status === "paused"
                                    ? "Retomar"
                                    : "Pausar"}
                              </Button>
                            ) : null}
                            <Button
                              type="button"
                              variant={bot.status === "archived" ? "destructive" : "ghost"}
                              size="sm"
                              disabled={Boolean(busyKey)}
                              onClick={() =>
                                setConfirm({
                                  kind: bot.status === "archived" ? "delete" : "archive",
                                  bot,
                                })
                              }
                            >
                              {bot.status === "archived" ? <Trash2 /> : <Archive />}
                              {bot.status === "archived" ? "Excluir" : "Arquivar"}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>

      <Dialog
        open={createOpen}
        onOpenChange={(next) => {
          if (creating) return
          setCreateOpen(next)
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Criar bot</DialogTitle>
            <DialogDescription>
              Cria a definição inicial. A integração e as credenciais podem ser ligadas depois no detalhe do bot.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault()
              if (creating) return
              void runAction(
                "create",
                () =>
                  createBotRequest({
                    name: name.trim(),
                    description: description.trim(),
                    locale: locale.trim(),
                  }),
                "Bot criado."
              ).then((ok) => {
                if (ok) {
                  setCreateOpen(false)
                  resetCreateForm()
                }
              })
            }}
          >
            <fieldset disabled={creating} className="space-y-4 border-0 p-0">
              <div className="space-y-1.5">
                <Label htmlFor="new-bot-name">Nome</Label>
                <Input
                  id="new-bot-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  maxLength={80}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="new-bot-description">Descrição</Label>
                <Input
                  id="new-bot-description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  maxLength={240}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="new-bot-locale">Idioma</Label>
                <Input
                  id="new-bot-locale"
                  value={locale}
                  onChange={(event) => setLocale(event.target.value)}
                  placeholder="Ex.: pt-BR"
                  maxLength={16}
                  required
                />
              </div>
            </fieldset>
            <DialogFooter>
              <Button type="button" variant="outline" disabled={creating} onClick={() => setCreateOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={creating || !name.trim() || !locale.trim()}>
                {creating ? "A criar…" : "Criar bot"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmActionDialog
        open={confirm !== null}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={confirm?.kind === "delete" ? "Excluir bot definitivamente?" : "Arquivar bot?"}
        description={
          confirm?.kind === "delete"
            ? `“${confirm.bot.name}” será excluído definitivamente. Esta ação não pode ser desfeita.`
            : `“${confirm?.bot.name ?? ""}” deixará de operar e ficará arquivado.`
        }
        confirmLabel={confirm?.kind === "delete" ? "Excluir bot" : "Arquivar bot"}
        destructive
        busy={Boolean(confirm && busyKey === `${confirm.kind}:${confirm.bot.id}`)}
        onConfirm={() => {
          if (!confirm) return
          const current = confirm
          void runAction(
            `${current.kind}:${current.bot.id}`,
            () =>
              current.kind === "delete"
                ? deleteBotRequest(current.bot.id)
                : archiveBotRequest(current.bot.id),
            current.kind === "delete" ? "Bot excluído." : "Bot arquivado."
          ).then((ok) => {
            if (ok) setConfirm(null)
          })
        }}
      />
    </div>
  )
}
