import { useCallback, useEffect, useMemo, useState } from "react"
import { Link, useLocation, useParams } from "react-router-dom"
import { ArrowLeft, Beaker, BrainCircuit, Plus, RotateCcw, Save, Send } from "lucide-react"
import { toast } from "sonner"
import { PageChrome, StatusPill } from "@/components/layout/chrome"
import { ConfirmActionDialog, PlatformFeedback } from "@/components/platform/platform-feedback"
import { formatPlatformDate } from "@/components/platform/platform-format"
import { VersionStatusPill } from "@/components/platform/platform-status"
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
import { Textarea } from "@/components/ui/textarea"
import {
  createBrainVersionRequest,
  listBrainVersionsRequest,
  publishBrainVersionRequest,
  restoreBrainVersionRequest,
  saveBrainVersionRequest,
  testBrainVersionRequest,
  type BrainCatalog,
  type BrainDraftInput,
} from "@/lib/platform-api"
import type { BrainVersion } from "@/lib/platform"
import { cn } from "@/lib/utils"

type ConfirmState = "publish" | "restore" | null

function useRequestedBotId() {
  const params = useParams()
  const location = useLocation()
  return params.botId || params.id || new URLSearchParams(location.search).get("botId") || ""
}

function draftOf(version: BrainVersion): BrainDraftInput {
  return {
    name: version.name,
    identity: version.identity,
    systemPrompt: version.systemPrompt,
    behavior: version.behavior,
    globalMemory: version.globalMemory,
    language: version.language,
    tone: version.tone,
    tools: [...version.tools],
    memoryPolicy: { ...version.memoryPolicy },
    voiceProfileId: version.voiceProfileId,
    notes: version.notes,
  }
}

export function BrainPage() {
  const botId = useRequestedBotId()
  const [catalog, setCatalog] = useState<BrainCatalog | null>(null)
  const [selectedId, setSelectedId] = useState("")
  const [pendingSelectionId, setPendingSelectionId] = useState("")
  const [draft, setDraft] = useState<BrainDraftInput | null>(null)
  const [toolsInput, setToolsInput] = useState("")
  const [dirty, setDirty] = useState(false)
  const [loading, setLoading] = useState(Boolean(botId))
  const [error, setError] = useState("")
  const [busy, setBusy] = useState("")
  const [confirm, setConfirm] = useState<ConfirmState>(null)
  const [testOpen, setTestOpen] = useState(false)
  const [testMessage, setTestMessage] = useState("")
  const [testOutput, setTestOutput] = useState("")
  const [testNotice, setTestNotice] = useState("")
  const [testError, setTestError] = useState("")

  const load = useCallback(
    async (preferLatest = false) => {
      if (!botId) return
      setLoading(true)
      setError("")
      try {
        const next = await listBrainVersionsRequest(botId)
        const ordered = [...next.versions].sort((left, right) => right.version - left.version)
        const normalized = { ...next, versions: ordered }
        setCatalog(normalized)
        setSelectedId((current) => {
          if (!preferLatest && ordered.some((item) => item.id === current)) return current
          return ordered.find((item) => item.id === next.activeVersionId)?.id || ordered[0]?.id || ""
        })
      } catch (caught) {
        setCatalog(null)
        setSelectedId("")
        setDraft(null)
        setError(caught instanceof Error ? caught.message : "Não foi possível carregar as versões.")
      } finally {
        setLoading(false)
      }
    },
    [botId]
  )

  useEffect(() => {
    void load()
  }, [load])

  const selected = useMemo(
    () => catalog?.versions.find((version) => version.id === selectedId),
    [catalog, selectedId]
  )

  useEffect(() => {
    if (!selected) {
      setDraft(null)
      setToolsInput("")
      setDirty(false)
      return
    }
    setDraft(draftOf(selected))
    setToolsInput(selected.tools.join(", "))
    setDirty(false)
  }, [selected])

  const updateDraft = (next: Partial<BrainDraftInput>) => {
    setDraft((current) => (current ? { ...current, ...next } : current))
    setDirty(true)
  }

  const runAction = async (
    key: string,
    action: () => Promise<unknown>,
    success: string,
    preferLatest = false
  ) => {
    if (busy) return false
    setBusy(key)
    try {
      await action()
      toast.success(success)
      await load(preferLatest)
      return true
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Não foi possível concluir a operação.")
      return false
    } finally {
      setBusy("")
    }
  }

  const createVersion = () => {
    if (!botId || busy || error) return
    void runAction(
      "create",
      () => createBrainVersionRequest(botId, selected?.id),
      "Nova versão criada.",
      true
    )
  }

  if (!botId) {
    return (
      <div className="h-full overflow-y-auto">
        <div className="page-shell">
          <PlatformFeedback
            state="error"
            title="Endereço do cérebro incompleto"
            detail="Abre o cérebro a partir do detalhe de um bot."
          />
        </div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="page-shell">
        <PageChrome icon={BrainCircuit} title="Cérebro">
          <Button asChild variant="outline" className="rounded-full">
            <Link to={`/bots/${encodeURIComponent(botId)}`}>
              <ArrowLeft />
              Voltar ao bot
            </Link>
          </Button>
          <Button
            type="button"
            className="rounded-full"
            disabled={loading || Boolean(error) || Boolean(busy)}
            onClick={createVersion}
          >
            <Plus />
            {busy === "create" ? "A criar…" : "Nova versão"}
          </Button>
        </PageChrome>
        <p className="max-w-3xl text-[13px] leading-relaxed text-muted-foreground">
          Edita rascunhos, testa a resposta e publica uma versão de cada vez. Restaurar cria uma nova versão sem alterar o
          histórico.
        </p>

        {loading ? (
          <PlatformFeedback state="loading" title="A carregar as versões…" />
        ) : error ? (
          <PlatformFeedback
            state="error"
            title="Não foi possível carregar o cérebro"
            detail={error}
            onRetry={() => void load()}
          />
        ) : !catalog?.versions.length ? (
          <PlatformFeedback
            state="empty"
            title="Ainda não há versões"
            detail="Cria a primeira versão para definir identidade, comportamento e memória."
          />
        ) : (
          <div className="grid items-start gap-3 xl:grid-cols-[260px_minmax(0,1fr)]">
            <aside className="surface overflow-hidden" aria-label="Versões do cérebro">
              <div className="border-b px-4 py-3.5">
                <p className="text-[13.5px] font-medium">Versões</p>
                <p className="mt-0.5 text-[11.5px] text-muted-foreground">{catalog.versions.length} no histórico</p>
              </div>
              <div className="divide-y">
                {catalog.versions.map((version) => {
                  const active = version.id === catalog.activeVersionId
                  return (
                    <button
                      key={version.id}
                      type="button"
                      className={cn(
                        "w-full px-4 py-3 text-left transition-colors hover:bg-muted/60",
                        selectedId === version.id && "bg-muted"
                      )}
                      aria-pressed={selectedId === version.id}
                      onClick={() => {
                        if (version.id === selectedId) return
                        if (dirty) {
                          setPendingSelectionId(version.id)
                          return
                        }
                        setSelectedId(version.id)
                      }}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="text-[13px] font-medium">Versão {version.version}</span>
                        {active ? <StatusPill tone="success">Ativa</StatusPill> : null}
                      </span>
                      <span className="mt-1 block truncate text-[11.5px] text-muted-foreground">{version.name}</span>
                      <span className="mt-2 block">
                        <VersionStatusPill status={version.status} />
                      </span>
                    </button>
                  )
                })}
              </div>
            </aside>

            {selected && draft ? (
              <section className="surface p-5 md:p-6" aria-label={`Editar versão ${selected.version}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-[15px] font-medium">Versão {selected.version}</h2>
                      <VersionStatusPill status={selected.status} />
                      {selected.id === catalog.activeVersionId ? <StatusPill tone="success">Em uso</StatusPill> : null}
                      {dirty ? <StatusPill tone="warn">Por guardar</StatusPill> : null}
                    </div>
                    <p className="mt-1 text-[11.5px] text-muted-foreground">
                      Criada em {formatPlatformDate(selected.createdAt)}
                      {selected.restoredFromId ? ` · restaurada de ${selected.restoredFromId}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-full"
                      disabled={Boolean(busy)}
                      onClick={() => {
                        setTestOutput("")
                        setTestNotice("")
                        setTestError("")
                        setTestOpen(true)
                      }}
                    >
                      <Beaker />
                      Testar
                    </Button>
                    {selected.status === "draft" || selected.status === "testing" ? (
                      <>
                        <Button
                          type="button"
                          variant="outline"
                          className="rounded-full"
                          disabled={Boolean(busy) || !dirty}
                          onClick={() =>
                            void runAction(
                              "save",
                              () => saveBrainVersionRequest(selected.id, draft),
                              "Versão guardada."
                            )
                          }
                        >
                          <Save />
                          {busy === "save" ? "A guardar…" : "Guardar"}
                        </Button>
                        <Button
                          type="button"
                          className="rounded-full"
                          disabled={Boolean(busy)}
                          onClick={() => setConfirm("publish")}
                        >
                          <Send />
                          Publicar
                        </Button>
                      </>
                    ) : null}
                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-full"
                      disabled={Boolean(busy)}
                      onClick={() => setConfirm("restore")}
                    >
                      <RotateCcw />
                      Restaurar
                    </Button>
                  </div>
                </div>

                {selected.status !== "draft" && selected.status !== "testing" ? (
                  <p className="mt-5 rounded-xl bg-muted/60 px-3 py-2.5 text-[12px] text-muted-foreground">
                    Esta versão é imutável. Cria uma nova versão ou restaura-a para editar.
                  </p>
                ) : null}

                <fieldset
                  disabled={selected.status !== "draft" && selected.status !== "testing"}
                  className="mt-6 grid gap-5 border-0 p-0"
                >
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Nome" htmlFor="brain-name">
                      <Input
                        id="brain-name"
                        value={draft.name}
                        onChange={(event) => updateDraft({ name: event.target.value })}
                        maxLength={80}
                        required
                      />
                    </Field>
                    <Field label="Idioma" htmlFor="brain-language">
                      <Input
                        id="brain-language"
                        value={draft.language}
                        onChange={(event) => updateDraft({ language: event.target.value })}
                        maxLength={16}
                        required
                      />
                    </Field>
                  </div>
                  <Field label="Identidade" htmlFor="brain-identity">
                    <Textarea
                      id="brain-identity"
                      value={draft.identity}
                      onChange={(event) => updateDraft({ identity: event.target.value })}
                      rows={4}
                      maxLength={8_000}
                    />
                  </Field>
                  <Field label="Prompt de sistema" htmlFor="brain-system">
                    <Textarea
                      id="brain-system"
                      value={draft.systemPrompt}
                      onChange={(event) => updateDraft({ systemPrompt: event.target.value })}
                      className="min-h-40 font-mono text-[12px]"
                      maxLength={64_000}
                    />
                  </Field>
                  <Field label="Comportamento" htmlFor="brain-behavior">
                    <Textarea
                      id="brain-behavior"
                      value={draft.behavior}
                      onChange={(event) => updateDraft({ behavior: event.target.value })}
                      rows={5}
                      maxLength={16_000}
                    />
                  </Field>
                  <Field label="Memória global" htmlFor="brain-memory">
                    <Textarea
                      id="brain-memory"
                      value={draft.globalMemory}
                      onChange={(event) => updateDraft({ globalMemory: event.target.value })}
                      rows={5}
                      maxLength={64_000}
                    />
                  </Field>
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Tom" htmlFor="brain-tone">
                      <Input
                        id="brain-tone"
                        value={draft.tone}
                        onChange={(event) => updateDraft({ tone: event.target.value })}
                        maxLength={240}
                      />
                    </Field>
                    <Field label="Perfil de voz" htmlFor="brain-voice">
                      <Input
                        id="brain-voice"
                        value={draft.voiceProfileId ?? ""}
                        onChange={(event) =>
                          updateDraft({ voiceProfileId: event.target.value.trim() || undefined })
                        }
                        maxLength={80}
                      />
                    </Field>
                  </div>
                  <Field label="Ferramentas" htmlFor="brain-tools">
                    <Input
                      id="brain-tools"
                      value={toolsInput}
                      onChange={(event) => {
                        setToolsInput(event.target.value)
                        updateDraft({
                          tools: event.target.value
                            .split(",")
                            .map((item) => item.trim())
                            .filter(Boolean),
                        })
                      }}
                      placeholder="Separadas por vírgulas"
                    />
                  </Field>
                  <div>
                    <p className="text-sm font-medium">Política de memória</p>
                    <div className="mt-3 grid gap-2 sm:grid-cols-3">
                      <MemoryToggle
                        label="Ler o lead"
                        checked={draft.memoryPolicy.readLead}
                        onChange={(checked) =>
                          updateDraft({ memoryPolicy: { ...draft.memoryPolicy, readLead: checked } })
                        }
                      />
                      <MemoryToggle
                        label="Gravar no lead"
                        checked={draft.memoryPolicy.writeLead}
                        onChange={(checked) =>
                          updateDraft({ memoryPolicy: { ...draft.memoryPolicy, writeLead: checked } })
                        }
                      />
                      <MemoryToggle
                        label="Propor memória global"
                        checked={draft.memoryPolicy.proposeGlobal}
                        onChange={(checked) =>
                          updateDraft({ memoryPolicy: { ...draft.memoryPolicy, proposeGlobal: checked } })
                        }
                      />
                    </div>
                  </div>
                  <Field label="Notas da versão" htmlFor="brain-notes">
                    <Textarea
                      id="brain-notes"
                      value={draft.notes ?? ""}
                      onChange={(event) => updateDraft({ notes: event.target.value || undefined })}
                      rows={3}
                      maxLength={2_000}
                    />
                  </Field>
                </fieldset>
              </section>
            ) : (
              <PlatformFeedback state="empty" title="Seleciona uma versão" />
            )}
          </div>
        )}
      </div>

      <Dialog
        open={testOpen}
        onOpenChange={(next) => {
          if (busy === "test") return
          setTestOpen(next)
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Testar versão {selected?.version}</DialogTitle>
            <DialogDescription>
              Usa o conteúdo visível sem publicar. A plataforma pode marcar a versão como “Em teste”.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault()
              if (!selected || !draft || !testMessage.trim() || busy) return
              setBusy("test")
              setTestOutput("")
              setTestNotice("")
              setTestError("")
              void testBrainVersionRequest(selected.id, testMessage.trim(), draft)
                .then(async (result) => {
                  if (typeof result.output === "string" && result.output.trim()) {
                    setTestOutput(result.output)
                  } else if (result.brain?.status === "testing") {
                    setTestNotice("A versão foi marcada como “Em teste”; a API não devolveu uma pré-visualização.")
                  } else {
                    setTestNotice("O teste foi aceite, mas a API não devolveu uma pré-visualização.")
                  }
                  await load()
                })
                .catch((caught: unknown) => {
                  setTestError(caught instanceof Error ? caught.message : "Não foi possível testar esta versão.")
                })
                .finally(() => setBusy(""))
            }}
          >
            <Field label="Mensagem de teste" htmlFor="brain-test-message">
              <Textarea
                id="brain-test-message"
                value={testMessage}
                onChange={(event) => setTestMessage(event.target.value)}
                rows={4}
                required
              />
            </Field>
            {testError ? (
              <p role="alert" className="rounded-xl bg-destructive/5 px-3 py-2.5 text-[12.5px] text-destructive">
                {testError}
              </p>
            ) : null}
            {testNotice ? (
              <p className="rounded-xl bg-muted/60 px-3 py-2.5 text-[12.5px] text-muted-foreground" aria-live="polite">
                {testNotice}
              </p>
            ) : null}
            {testOutput ? (
              <div className="rounded-xl border bg-muted/30 p-3" aria-live="polite">
                <p className="text-[11.5px] font-medium text-muted-foreground">Resposta</p>
                <p className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed">{testOutput}</p>
              </div>
            ) : null}
            <DialogFooter>
              <Button type="button" variant="outline" disabled={busy === "test"} onClick={() => setTestOpen(false)}>
                Fechar
              </Button>
              <Button type="submit" disabled={busy === "test" || !testMessage.trim()}>
                <Beaker />
                {busy === "test" ? "A testar…" : "Executar teste"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmActionDialog
        open={confirm !== null}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={confirm === "publish" ? "Publicar esta versão?" : "Restaurar esta versão?"}
        description={
          confirm === "publish"
            ? "Esta versão passará a ser a versão ativa do bot. Alterações por guardar também serão gravadas."
            : "Será criado um novo rascunho com o conteúdo desta versão; o histórico atual será preservado."
        }
        confirmLabel={confirm === "publish" ? "Publicar versão" : "Criar versão restaurada"}
        busy={busy === confirm}
        onConfirm={() => {
          if (!selected || !draft || !confirm) return
          const action = confirm
          void runAction(
            action,
            async () => {
              if (action === "publish") {
                if (dirty) await saveBrainVersionRequest(selected.id, draft)
                await publishBrainVersionRequest(selected.id)
                return
              }
              await restoreBrainVersionRequest(botId, selected.id)
            },
            action === "publish" ? "Versão publicada." : "Versão restaurada num novo rascunho.",
            action === "restore"
          ).then((ok) => {
            if (ok) setConfirm(null)
          })
        }}
      />

      <ConfirmActionDialog
        open={Boolean(pendingSelectionId)}
        onOpenChange={(open) => {
          if (!open) setPendingSelectionId("")
        }}
        title="Descartar alterações?"
        description="As alterações ainda não guardadas desta versão serão perdidas."
        confirmLabel="Descartar e mudar"
        destructive
        onConfirm={() => {
          setSelectedId(pendingSelectionId)
          setPendingSelectionId("")
        }}
      />
    </div>
  )
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string
  htmlFor: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  )
}

function MemoryToggle({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="flex items-center gap-2 rounded-xl border px-3 py-2.5 text-[12.5px]">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="size-4 accent-primary"
      />
      {label}
    </label>
  )
}
