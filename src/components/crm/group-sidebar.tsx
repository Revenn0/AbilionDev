import { useId, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react"
import { ArrowDown, ArrowUp, Check, Pencil, Plus, Trash2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  LEAD_GROUP_FILTER_ALL,
  LEAD_GROUP_FILTER_UNGROUPED,
  buildLeadGroupFilters,
  normalizeLeadGroups,
  validateLeadGroupName,
  type LeadGroupCounts,
  type LeadGroupFilter,
  type LeadGroupV2,
} from "@/lib/lead-groups"
import { cn } from "@/lib/utils"

export type GroupSidebarActionResult =
  | void
  | boolean
  | {
      ok: boolean
      error?: string
    }

type GroupSidebarCallback = GroupSidebarActionResult | Promise<GroupSidebarActionResult>

export type GroupSidebarProps = {
  groups: readonly LeadGroupV2[]
  counts: LeadGroupCounts
  selected?: LeadGroupFilter
  selectedFilter?: LeadGroupFilter
  onSelect?: (filter: LeadGroupFilter) => void
  onCreate?: (name: string) => GroupSidebarCallback
  onRename?: (groupId: string, name: string) => GroupSidebarCallback
  onReorder?: (orderedGroupIds: string[]) => GroupSidebarCallback
  onDelete?: (groupId: string) => GroupSidebarCallback
  disabled?: boolean
  className?: string
  title?: string
}

function actionError(result: GroupSidebarActionResult) {
  if (result === false) return "Não foi possível concluir esta ação."
  if (result && typeof result === "object" && !result.ok) {
    return result.error?.trim() || "Não foi possível concluir esta ação."
  }
  return ""
}

function countLabel(count: number) {
  return `${count} ${count === 1 ? "lead" : "leads"}`
}

export function GroupSidebar({
  groups: rawGroups,
  counts,
  selected,
  selectedFilter,
  onSelect,
  onCreate,
  onRename,
  onReorder,
  onDelete,
  disabled = false,
  className,
  title = "Grupos",
}: GroupSidebarProps) {
  const groups = useMemo(() => normalizeLeadGroups(rawGroups), [rawGroups])
  const filters = useMemo(() => buildLeadGroupFilters(groups, counts), [counts, groups])
  const activeFilter = selectedFilter ?? selected ?? LEAD_GROUP_FILTER_ALL
  const createId = useId()
  const renameId = useId()
  const [draft, setDraft] = useState("")
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameDraft, setRenameDraft] = useState("")
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const [error, setError] = useState("")
  const renameInput = useRef<HTMLInputElement>(null)

  const run = async (
    actionId: string,
    callback: () => GroupSidebarCallback,
    onSuccess?: () => void
  ) => {
    if (disabled || busyAction) return
    setBusyAction(actionId)
    setError("")
    try {
      const result = await callback()
      const nextError = actionError(result)
      if (nextError) {
        setError(nextError)
        return
      }
      onSuccess?.()
    } catch (reason) {
      setError(reason instanceof Error && reason.message.trim() ? reason.message : "Não foi possível concluir esta ação.")
    } finally {
      setBusyAction(null)
    }
  }

  const submitCreate = (event: FormEvent) => {
    event.preventDefault()
    if (!onCreate) return
    const checked = validateLeadGroupName(draft, groups)
    if (!checked.ok) {
      setError(checked.error)
      return
    }
    void run("create", () => onCreate(checked.name), () => setDraft(""))
  }

  const beginRename = (group: LeadGroupV2) => {
    if (disabled || busyAction) return
    setError("")
    setRenamingId(group.id)
    setRenameDraft(group.name)
    window.setTimeout(() => {
      renameInput.current?.focus()
      renameInput.current?.select()
    }, 0)
  }

  const cancelRename = () => {
    setRenamingId(null)
    setRenameDraft("")
    setError("")
  }

  const submitRename = (event: FormEvent, group: LeadGroupV2) => {
    event.preventDefault()
    if (!onRename) return
    const checked = validateLeadGroupName(renameDraft, groups, group.id)
    if (!checked.ok) {
      setError(checked.error)
      return
    }
    void run(`rename:${group.id}`, () => onRename(group.id, checked.name), cancelRename)
  }

  const move = (groupIndex: number, offset: -1 | 1) => {
    if (!onReorder) return
    const target = groupIndex + offset
    if (target < 0 || target >= groups.length) return
    const ids = groups.map((group) => group.id)
    const current = ids[groupIndex]
    const adjacent = ids[target]
    if (!current || !adjacent) return
    ids[groupIndex] = adjacent
    ids[target] = current
    void run(`reorder:${current}`, () => onReorder(ids))
  }

  const isActive = (filter: LeadGroupFilter) => activeFilter === filter
  const hasActions = Boolean(onRename || onReorder || onDelete)

  return (
    <aside
      aria-label={title}
      aria-busy={busyAction ? true : undefined}
      className={cn("flex min-h-0 w-full flex-col border-r border-border bg-card", className)}
    >
      <div className="flex items-center justify-between gap-2 px-3 py-3">
        <h2 className="truncate text-[13px] font-semibold">{title}</h2>
        <span className="sr-only" aria-live="polite">
          {busyAction ? "A guardar alterações." : ""}
        </span>
      </div>

      <nav aria-label="Filtros de grupos" className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        <ul className="space-y-0.5">
          {filters.map((filter, index) => {
            const groupIndex = index - 2
            const group = filter.group
            const active = isActive(filter.id)
            const renaming = Boolean(group && renamingId === group.id)

            return (
              <li key={filter.id}>
                {renaming && group ? (
                  <form
                    className="rounded-lg border border-border bg-background p-1.5"
                    onSubmit={(event) => submitRename(event, group)}
                  >
                    <label htmlFor={`${renameId}-${group.id}`} className="sr-only">
                      Novo nome de {group.name}
                    </label>
                    <div className="flex items-center gap-1">
                      <Input
                        ref={renameInput}
                        id={`${renameId}-${group.id}`}
                        value={renameDraft}
                        maxLength={80}
                        disabled={disabled || Boolean(busyAction)}
                        aria-invalid={Boolean(error)}
                        onChange={(event) => {
                          setRenameDraft(event.target.value)
                          setError("")
                        }}
                        onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
                          if (event.key === "Escape") {
                            event.preventDefault()
                            cancelRename()
                          }
                        }}
                      />
                      <Button
                        type="submit"
                        size="icon-sm"
                        variant="ghost"
                        disabled={disabled || Boolean(busyAction)}
                        aria-label={`Guardar novo nome de ${group.name}`}
                      >
                        <Check />
                      </Button>
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        disabled={disabled || Boolean(busyAction)}
                        aria-label="Cancelar alteração do nome"
                        onClick={cancelRename}
                      >
                        <X />
                      </Button>
                    </div>
                  </form>
                ) : (
                  <div
                    className={cn(
                      "group flex min-h-9 items-center rounded-lg",
                      active ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                    )}
                  >
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 items-center gap-2 self-stretch rounded-lg px-2.5 text-left text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      aria-pressed={active}
                      aria-current={active ? "true" : undefined}
                      disabled={disabled}
                      onClick={() => onSelect?.(filter.id)}
                    >
                      <span className="min-w-0 flex-1 truncate">{filter.label}</span>
                      <span
                        className="min-w-6 rounded-full bg-background/80 px-1.5 py-0.5 text-center text-[11px] tabular-nums"
                        aria-label={countLabel(filter.count)}
                      >
                        {filter.count}
                      </span>
                    </button>

                    {group && hasActions ? (
                      <div
                        className="flex shrink-0 items-center pr-1 opacity-100 sm:opacity-0 sm:transition-opacity sm:group-focus-within:opacity-100 sm:group-hover:opacity-100"
                        aria-label={`Ações de ${group.name}`}
                      >
                        {onReorder ? (
                          <>
                            <Button
                              type="button"
                              size="icon-xs"
                              variant="ghost"
                              disabled={disabled || Boolean(busyAction) || groupIndex <= 0}
                              aria-label={`Mover ${group.name} para cima`}
                              onClick={() => move(groupIndex, -1)}
                            >
                              <ArrowUp />
                            </Button>
                            <Button
                              type="button"
                              size="icon-xs"
                              variant="ghost"
                              disabled={disabled || Boolean(busyAction) || groupIndex >= groups.length - 1}
                              aria-label={`Mover ${group.name} para baixo`}
                              onClick={() => move(groupIndex, 1)}
                            >
                              <ArrowDown />
                            </Button>
                          </>
                        ) : null}
                        {onRename ? (
                          <Button
                            type="button"
                            size="icon-xs"
                            variant="ghost"
                            disabled={disabled || Boolean(busyAction)}
                            aria-label={`Renomear ${group.name}`}
                            onClick={() => beginRename(group)}
                          >
                            <Pencil />
                          </Button>
                        ) : null}
                        {onDelete ? (
                          <Button
                            type="button"
                            size="icon-xs"
                            variant="ghost"
                            className="text-destructive hover:text-destructive"
                            disabled={disabled || Boolean(busyAction)}
                            aria-label={`Excluir ${group.name}; os leads serão mantidos`}
                            title="Excluir grupo; os leads serão mantidos"
                            onClick={() => void run(`delete:${group.id}`, () => onDelete(group.id))}
                          >
                            <Trash2 />
                          </Button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      </nav>

      {error ? (
        <p className="mx-3 mb-2 text-[12px] text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      {onCreate ? (
        <form className="border-t border-border p-2.5" onSubmit={submitCreate}>
          <label htmlFor={createId} className="sr-only">
            Nome do novo grupo
          </label>
          <div className="flex gap-1.5">
            <Input
              id={createId}
              value={draft}
              maxLength={80}
              placeholder="Novo grupo"
              disabled={disabled || Boolean(busyAction)}
              aria-invalid={Boolean(error)}
              onChange={(event) => {
                setDraft(event.target.value)
                setError("")
              }}
            />
            <Button
              type="submit"
              size="icon"
              variant="outline"
              disabled={disabled || Boolean(busyAction) || !draft.trim()}
              aria-label="Criar grupo"
            >
              <Plus />
            </Button>
          </div>
        </form>
      ) : null}
    </aside>
  )
}

export default GroupSidebar
