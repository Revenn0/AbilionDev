/**
 * Modelo aditivo de grupos do CRM.
 *
 * Este módulo não depende do tipo Lead atual para permitir uma migração gradual:
 * qualquer objeto com `id`, `category` e/ou `groupIds` pode ser usado.
 */

export const LEAD_GROUP_FILTER_ALL = "all" as const
export const LEAD_GROUP_FILTER_UNGROUPED = "ungrouped" as const
export const LEAD_GROUP_NAME_MAX_LENGTH = 80
export const LEAD_GROUP_ID_MAX_LENGTH = 128

export type LeadGroupV2 = {
  id: string
  name: string
  order: number
  url?: string
}

export type LeadGroupFilter = typeof LEAD_GROUP_FILTER_ALL | typeof LEAD_GROUP_FILTER_UNGROUPED | string

export type GroupableLead = {
  id: string
  category?: unknown
  groupIds?: unknown
}

export type GroupedLead<T extends GroupableLead = GroupableLead> = T & {
  groupIds: string[]
}

export type LeadGroupCounts = {
  all: number
  ungrouped: number
  byGroupId: Record<string, number>
}

export type LeadGroupFilterItem = {
  id: LeadGroupFilter
  label: string
  count: number
  group?: LeadGroupV2
}

export type LeadGroupErrorCode =
  | "blank_name"
  | "name_too_long"
  | "duplicate_name"
  | "blank_id"
  | "id_too_long"
  | "duplicate_id"
  | "reserved_id"
  | "group_not_found"
  | "lead_not_found"
  | "invalid_order"
  | "already_associated"
  | "not_associated"

export type LeadGroupFailure = {
  ok: false
  code: LeadGroupErrorCode
  error: string
}

export type LeadGroupValidation =
  | {
      ok: true
      name: string
      key: string
    }
  | LeadGroupFailure

export type LeadGroupMutationSuccess = {
  ok: true
  groups: LeadGroupV2[]
  group: LeadGroupV2
}

export type LeadGroupMutationResult = LeadGroupMutationSuccess | LeadGroupFailure

export type LeadGroupMembershipChange =
  | { type: "add"; leadId: string; groupId: string }
  | { type: "remove"; leadId: string; groupId: string }
  | { type: "move"; leadId: string; fromGroupId: string; toGroupId: string }

export type LeadGroupMembershipResult<T extends GroupableLead> =
  | {
      ok: true
      leads: Array<GroupedLead<T>>
      changedLeadIds: string[]
    }
  | LeadGroupFailure

export type DeleteLeadGroupResult<T extends GroupableLead> =
  | {
      ok: true
      groups: LeadGroupV2[]
      leads: Array<GroupedLead<T>>
      deletedGroup: LeadGroupV2
      removedAssociations: number
    }
  | LeadGroupFailure

export type CategoryMigrationIssue = {
  leadId: string
  category: string
  code: "invalid_category"
  error: string
}

export type CategoryMigrationResult<T extends GroupableLead> = {
  groups: LeadGroupV2[]
  leads: Array<GroupedLead<T>>
  createdGroupCount: number
  migratedLeadCount: number
  issues: CategoryMigrationIssue[]
}

const RESERVED_FILTER_IDS = new Set<string>([LEAD_GROUP_FILTER_ALL, LEAD_GROUP_FILTER_UNGROUPED])

function caseKey(value: string) {
  return value.normalize("NFKC").toLocaleLowerCase("pt-BR")
}

function normalizedId(value: unknown) {
  return typeof value === "string" ? value.normalize("NFKC").trim() : ""
}

function normalizedUrl(value: unknown) {
  return typeof value === "string" ? value.trim().slice(0, 2048) : ""
}

function finiteOrder(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : fallback
}

function stableHash(value: string) {
  let hash = 0xcbf29ce484222325n
  for (const character of value) {
    hash ^= BigInt(character.codePointAt(0) ?? 0)
    hash = BigInt.asUintN(64, hash * 0x100000001b3n)
  }
  return hash.toString(36)
}

function generatedGroupId(name: string) {
  const key = caseKey(name)
  const slug = key
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
  return `group:${slug || "crm"}:${stableHash(key)}`
}

function availableGeneratedGroupId(name: string, groups: readonly LeadGroupV2[]) {
  const base = generatedGroupId(name)
  if (!groupById(groups, base)) return base
  let suffix = 2
  while (groupById(groups, `${base.slice(0, LEAD_GROUP_ID_MAX_LENGTH - String(suffix).length - 1)}-${suffix}`)) {
    suffix += 1
  }
  return `${base.slice(0, LEAD_GROUP_ID_MAX_LENGTH - String(suffix).length - 1)}-${suffix}`
}

function groupById(groups: readonly LeadGroupV2[], id: string) {
  const key = caseKey(normalizedId(id))
  return groups.find((group) => caseKey(group.id) === key)
}

function canonicalGroupId(groups: readonly LeadGroupV2[], id: string) {
  return groupById(groups, id)?.id
}

function resultFailure(code: LeadGroupErrorCode, error: string): LeadGroupFailure {
  return { ok: false, code, error }
}

/**
 * Normaliza Unicode e espaços sem alterar maiúsculas escolhidas pelo utilizador.
 * A validação de unicidade usa uma chave case-insensitive separada.
 */
export function normalizeLeadGroupName(value: unknown) {
  if (typeof value !== "string") return ""
  return value.normalize("NFKC").replace(/\s+/g, " ").trim()
}

export const normalizeGroupName = normalizeLeadGroupName

export function leadGroupNameKey(value: unknown) {
  return caseKey(normalizeLeadGroupName(value))
}

export function validateLeadGroupName(
  value: unknown,
  groups: readonly LeadGroupV2[] = [],
  excludeGroupId?: string
): LeadGroupValidation {
  const name = normalizeLeadGroupName(value)
  if (!name) return resultFailure("blank_name", "Dá um nome ao grupo.")
  if (name.length > LEAD_GROUP_NAME_MAX_LENGTH) {
    return resultFailure(
      "name_too_long",
      `O nome do grupo pode ter no máximo ${LEAD_GROUP_NAME_MAX_LENGTH} caracteres.`
    )
  }

  const key = caseKey(name)
  const excluded = excludeGroupId ? caseKey(normalizedId(excludeGroupId)) : ""
  const duplicate = groups.some((group) => caseKey(group.id) !== excluded && caseKey(group.name) === key)
  if (duplicate) return resultFailure("duplicate_name", "Já existe um grupo com este nome.")
  return { ok: true, name, key }
}

export const validateGroupName = validateLeadGroupName

export function validateLeadGroupId(value: unknown, groups: readonly LeadGroupV2[] = [], excludeGroupId?: string) {
  const id = normalizedId(value)
  if (!id) return resultFailure("blank_id", "O grupo precisa de um identificador.")
  if (id.length > LEAD_GROUP_ID_MAX_LENGTH) {
    return resultFailure(
      "id_too_long",
      `O identificador do grupo pode ter no máximo ${LEAD_GROUP_ID_MAX_LENGTH} caracteres.`
    )
  }
  if (RESERVED_FILTER_IDS.has(caseKey(id))) {
    return resultFailure("reserved_id", "Este identificador está reservado para os filtros do CRM.")
  }
  const key = caseKey(id)
  const excluded = excludeGroupId ? caseKey(normalizedId(excludeGroupId)) : ""
  if (groups.some((group) => caseKey(group.id) !== excluded && caseKey(group.id) === key)) {
    return resultFailure("duplicate_id", "Já existe um grupo com este identificador.")
  }
  return { ok: true as const, id }
}

/**
 * Converte dados persistidos de versões anteriores em V2. Entradas inválidas,
 * IDs repetidos e nomes repetidos (ignorando caixa) são descartados.
 */
export function normalizeLeadGroups(raw: unknown): LeadGroupV2[] {
  if (!Array.isArray(raw)) return []

  const candidates: Array<LeadGroupV2 & { sourceIndex: number }> = []
  const names = new Set<string>()
  const ids = new Set<string>()

  raw.forEach((value, sourceIndex) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return
    const row = value as Record<string, unknown>
    const name = normalizeLeadGroupName(row.name)
    if (!name || name.length > LEAD_GROUP_NAME_MAX_LENGTH) return

    const id = normalizedId(row.id) || generatedGroupId(name)
    if (!id || id.length > LEAD_GROUP_ID_MAX_LENGTH) return

    const nameKey = caseKey(name)
    const idKey = caseKey(id)
    if (RESERVED_FILTER_IDS.has(idKey) || names.has(nameKey) || ids.has(idKey)) return
    names.add(nameKey)
    ids.add(idKey)

    const url = normalizedUrl(row.url)
    candidates.push({
      id,
      name,
      order: finiteOrder(row.order, sourceIndex),
      ...(url ? { url } : {}),
      sourceIndex,
    })
  })

  return candidates
    .sort((left, right) => left.order - right.order || left.sourceIndex - right.sourceIndex)
    .map(({ sourceIndex: _sourceIndex, ...group }, order) => ({ ...group, order }))
}

export const migrateLeadGroupsV2 = normalizeLeadGroups

/**
 * Mantém a primeira ocorrência de cada ID. Quando `groups` é informado,
 * IDs conhecidos são devolvidos com a caixa canónica do grupo.
 */
export function normalizeLeadGroupIds(value: unknown, groups?: readonly LeadGroupV2[]) {
  const source = Array.isArray(value) ? value : typeof value === "string" ? [value] : []
  const out: string[] = []
  const seen = new Set<string>()

  for (const item of source) {
    const rawId = normalizedId(item)
    if (!rawId) continue
    const id = groups ? canonicalGroupId(groups, rawId) : rawId
    if (!id) continue
    const key = caseKey(id)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(id)
  }
  return out
}

/**
 * Canonicaliza IDs conhecidos sem apagar associações que podem pertencer a
 * grupos ainda não carregados neste cliente.
 */
export function normalizeLeadGroupIdsPreservingUnknown(
  value: unknown,
  groups: readonly LeadGroupV2[]
) {
  const source = Array.isArray(value) ? value : typeof value === "string" ? [value] : []
  const out: string[] = []
  const seen = new Set<string>()
  for (const item of source) {
    const rawId = normalizedId(item)
    if (!rawId) continue
    const id = canonicalGroupId(groups, rawId) ?? rawId
    const key = caseKey(id)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(id)
  }
  return out
}

export function createLeadGroup(
  current: readonly LeadGroupV2[],
  input: string | { name: string; id?: string; url?: string }
): LeadGroupMutationResult {
  const groups = normalizeLeadGroups(current)
  const request = typeof input === "string" ? { name: input } : input
  const checkedName = validateLeadGroupName(request.name, groups)
  if (!checkedName.ok) return checkedName

  const candidateId = normalizedId(request.id) || availableGeneratedGroupId(checkedName.name, groups)
  const checkedId = validateLeadGroupId(candidateId, groups)
  if (!checkedId.ok) return checkedId

  const url = normalizedUrl(request.url)
  const group: LeadGroupV2 = {
    id: checkedId.id,
    name: checkedName.name,
    order: groups.length,
    ...(url ? { url } : {}),
  }
  return { ok: true, groups: [...groups, group], group }
}

export function renameLeadGroup(
  current: readonly LeadGroupV2[],
  groupId: string,
  nextName: string
): LeadGroupMutationResult {
  const groups = normalizeLeadGroups(current)
  const group = groupById(groups, groupId)
  if (!group) return resultFailure("group_not_found", "O grupo não existe.")

  const checked = validateLeadGroupName(nextName, groups, group.id)
  if (!checked.ok) return checked
  if (group.name === checked.name) return { ok: true, groups, group }

  const renamed = { ...group, name: checked.name }
  return {
    ok: true,
    groups: groups.map((item) => (item.id === group.id ? renamed : item)),
    group: renamed,
  }
}

/**
 * Reordena apenas quando `orderedIds` é uma permutação exata dos grupos atuais.
 * Assim uma lista stale nunca apaga grupos silenciosamente.
 */
export function reorderLeadGroups(
  current: readonly LeadGroupV2[],
  orderedIds: readonly string[]
): { ok: true; groups: LeadGroupV2[] } | LeadGroupFailure {
  const groups = normalizeLeadGroups(current)
  if (orderedIds.length !== groups.length) {
    return resultFailure("invalid_order", "A nova ordem precisa de incluir todos os grupos uma vez.")
  }

  const ordered: LeadGroupV2[] = []
  const seen = new Set<string>()
  for (const requestedId of orderedIds) {
    const group = groupById(groups, requestedId)
    if (!group || seen.has(caseKey(group.id))) {
      return resultFailure("invalid_order", "A nova ordem contém grupos desconhecidos ou repetidos.")
    }
    seen.add(caseKey(group.id))
    ordered.push(group)
  }

  return { ok: true, groups: ordered.map((group, order) => ({ ...group, order })) }
}

export function reorderLeadGroup(
  current: readonly LeadGroupV2[],
  groupId: string,
  toIndex: number
): { ok: true; groups: LeadGroupV2[] } | LeadGroupFailure {
  const groups = normalizeLeadGroups(current)
  const group = groupById(groups, groupId)
  if (!group) return resultFailure("group_not_found", "O grupo não existe.")
  if (!Number.isInteger(toIndex) || toIndex < 0 || toIndex >= groups.length) {
    return resultFailure("invalid_order", "A posição do grupo é inválida.")
  }

  const without = groups.filter((item) => item.id !== group.id)
  without.splice(toIndex, 0, group)
  return { ok: true, groups: without.map((item, order) => ({ ...item, order })) }
}

function normalizedLeads<T extends GroupableLead>(
  leads: readonly T[],
  groups?: readonly LeadGroupV2[]
): Array<GroupedLead<T>> {
  return leads.map((lead) => ({
    ...lead,
    groupIds: groups
      ? normalizeLeadGroupIdsPreservingUnknown(lead.groupIds, groups)
      : normalizeLeadGroupIds(lead.groupIds),
  }))
}

/**
 * Aplica todo o lote ou nada. A validação e a simulação terminam antes de
 * qualquer cópia ser devolvida, evitando estados parcialmente atualizados.
 */
export function applyLeadGroupMembershipsAtomically<T extends GroupableLead>(
  leadsInput: readonly T[],
  groupsInput: readonly LeadGroupV2[],
  changes: readonly LeadGroupMembershipChange[]
): LeadGroupMembershipResult<T> {
  const groups = normalizeLeadGroups(groupsInput)
  const leads = normalizedLeads(leadsInput, groups)
  const memberships = new Map(leads.map((lead) => [lead.id, [...lead.groupIds]]))
  const changed = new Set<string>()

  for (const change of changes) {
    const ids = memberships.get(change.leadId)
    if (!ids) return resultFailure("lead_not_found", "O lead não existe.")

    if (change.type === "add") {
      const group = groupById(groups, change.groupId)
      if (!group) return resultFailure("group_not_found", "O grupo de destino não existe.")
      if (ids.some((id) => caseKey(id) === caseKey(group.id))) {
        return resultFailure("already_associated", "O lead já pertence a este grupo.")
      }
      ids.push(group.id)
      changed.add(change.leadId)
      continue
    }

    if (change.type === "remove") {
      const group = groupById(groups, change.groupId)
      if (!group) return resultFailure("group_not_found", "O grupo não existe.")
      const index = ids.findIndex((id) => caseKey(id) === caseKey(group.id))
      if (index < 0) return resultFailure("not_associated", "O lead não pertence a este grupo.")
      ids.splice(index, 1)
      changed.add(change.leadId)
      continue
    }

    const source = groupById(groups, change.fromGroupId)
    const destination = groupById(groups, change.toGroupId)
    if (!source || !destination) return resultFailure("group_not_found", "O grupo de origem ou destino não existe.")

    const sourceIndex = ids.findIndex((id) => caseKey(id) === caseKey(source.id))
    if (sourceIndex < 0) return resultFailure("not_associated", "O lead não pertence ao grupo de origem.")
    if (source.id === destination.id) continue
    if (ids.some((id) => caseKey(id) === caseKey(destination.id))) {
      return resultFailure("already_associated", "O lead já pertence ao grupo de destino.")
    }
    ids.splice(sourceIndex, 1, destination.id)
    changed.add(change.leadId)
  }

  const next = leads.map((lead) => {
    const groupIds = memberships.get(lead.id) ?? lead.groupIds
    return changed.has(lead.id) ? { ...lead, groupIds } : lead
  })
  return { ok: true, leads: next, changedLeadIds: [...changed] }
}

export function addLeadToGroup<T extends GroupableLead>(
  leads: readonly T[],
  groups: readonly LeadGroupV2[],
  leadId: string,
  groupId: string
) {
  return applyLeadGroupMembershipsAtomically(leads, groups, [{ type: "add", leadId, groupId }])
}

export function removeLeadFromGroup<T extends GroupableLead>(
  leads: readonly T[],
  groups: readonly LeadGroupV2[],
  leadId: string,
  groupId: string
) {
  return applyLeadGroupMembershipsAtomically(leads, groups, [{ type: "remove", leadId, groupId }])
}

export function moveLeadToGroup<T extends GroupableLead>(
  leads: readonly T[],
  groups: readonly LeadGroupV2[],
  leadId: string,
  fromGroupId: string,
  toGroupId: string
) {
  return applyLeadGroupMembershipsAtomically(leads, groups, [
    { type: "move", leadId, fromGroupId, toGroupId },
  ])
}

export const moveLeadBetweenGroups = moveLeadToGroup

/**
 * Excluir um grupo nunca exclui leads: remove o grupo e apenas as respetivas
 * associações. Outras associações (inclusive ainda desconhecidas localmente)
 * são preservadas.
 */
export function deleteLeadGroup<T extends GroupableLead>(
  groupsInput: readonly LeadGroupV2[],
  leadsInput: readonly T[],
  groupId: string
): DeleteLeadGroupResult<T> {
  const groups = normalizeLeadGroups(groupsInput)
  const deletedGroup = groupById(groups, groupId)
  if (!deletedGroup) return resultFailure("group_not_found", "O grupo não existe.")

  let removedAssociations = 0
  const leads = normalizedLeads(leadsInput).map((lead) => {
    const groupIds = lead.groupIds.filter((id) => {
      const remove = caseKey(id) === caseKey(deletedGroup.id)
      if (remove) removedAssociations += 1
      return !remove
    })
    return groupIds.length === lead.groupIds.length ? lead : { ...lead, groupIds }
  })
  const remaining = groups
    .filter((group) => group.id !== deletedGroup.id)
    .map((group, order) => ({ ...group, order }))

  return { ok: true, groups: remaining, leads, deletedGroup, removedAssociations }
}

export const removeLeadGroup = deleteLeadGroup

/**
 * Migração idempotente de `category` para `groupIds`.
 *
 * `category` é mantida para compatibilidade de leitura durante o rollout.
 * Categorias iguais com caixa diferente apontam para o mesmo grupo.
 */
export function migrateCategoriesToLeadGroups<T extends GroupableLead>(
  leadsInput: readonly T[],
  groupsInput: readonly LeadGroupV2[] = []
): CategoryMigrationResult<T> {
  let groups = normalizeLeadGroups(groupsInput)
  const byName = new Map(groups.map((group) => [caseKey(group.name), group]))
  const issues: CategoryMigrationIssue[] = []
  let createdGroupCount = 0
  let migratedLeadCount = 0

  const leads = leadsInput.map((lead) => {
    const currentIds = normalizeLeadGroupIdsPreservingUnknown(lead.groupIds, groups)
    const category = normalizeLeadGroupName(lead.category)
    if (!category) return { ...lead, groupIds: currentIds }

    const validation = validateLeadGroupName(category)
    if (!validation.ok) {
      issues.push({ leadId: lead.id, category, code: "invalid_category", error: validation.error })
      return { ...lead, groupIds: currentIds }
    }

    let group = byName.get(validation.key)
    if (!group) {
      const created = createLeadGroup(groups, category)
      if (!created.ok) {
        issues.push({ leadId: lead.id, category, code: "invalid_category", error: created.error })
        return { ...lead, groupIds: currentIds }
      }
      group = created.group
      groups = created.groups
      byName.set(validation.key, group)
      createdGroupCount += 1
    }

    const hasGroup = currentIds.some((id) => caseKey(id) === caseKey(group.id))
    if (hasGroup) return { ...lead, groupIds: currentIds }
    migratedLeadCount += 1
    return { ...lead, groupIds: [...currentIds, group.id] }
  })

  return { groups, leads, createdGroupCount, migratedLeadCount, issues }
}

export const migrateCategoryToGroupIds = migrateCategoriesToLeadGroups

function knownMemberships(lead: GroupableLead, groups?: readonly LeadGroupV2[]) {
  return normalizeLeadGroupIds(lead.groupIds, groups)
}

export function leadMatchesGroupFilter(
  lead: GroupableLead,
  filter: LeadGroupFilter,
  groups?: readonly LeadGroupV2[]
) {
  if (filter === LEAD_GROUP_FILTER_ALL) return true
  const memberships = knownMemberships(lead, groups)
  if (filter === LEAD_GROUP_FILTER_UNGROUPED) return memberships.length === 0
  const canonical = groups ? canonicalGroupId(groups, filter) : normalizedId(filter)
  if (!canonical) return false
  return memberships.some((id) => caseKey(id) === caseKey(canonical))
}

export function filterLeadsByGroup<T extends GroupableLead>(
  leads: readonly T[],
  filter: LeadGroupFilter,
  groups?: readonly LeadGroupV2[]
) {
  return leads.filter((lead) => leadMatchesGroupFilter(lead, filter, groups))
}

export function getLeadGroupCounts(
  leads: readonly GroupableLead[],
  groupsInput: readonly LeadGroupV2[] = []
): LeadGroupCounts {
  const groups = normalizeLeadGroups(groupsInput)
  const byGroupId: Record<string, number> = Object.fromEntries(groups.map((group) => [group.id, 0]))
  let ungrouped = 0

  for (const lead of leads) {
    const memberships = groups.length
      ? normalizeLeadGroupIds(lead.groupIds, groups)
      : normalizeLeadGroupIds(lead.groupIds)
    if (!memberships.length) ungrouped += 1
    for (const id of memberships) {
      if (Object.hasOwn(byGroupId, id)) byGroupId[id] = (byGroupId[id] ?? 0) + 1
    }
  }

  return { all: leads.length, ungrouped, byGroupId }
}

export function countLeadsByGroup(
  leads: readonly GroupableLead[],
  filter: LeadGroupFilter,
  groups?: readonly LeadGroupV2[]
): number {
  if (filter === LEAD_GROUP_FILTER_ALL) return leads.length
  if (filter === LEAD_GROUP_FILTER_UNGROUPED) return getLeadGroupCounts(leads, groups).ungrouped
  return filterLeadsByGroup(leads, filter, groups).length
}

export function isDisposableTestLead(lead: {
  testRunId?: unknown
  tags?: unknown
  campaign?: unknown
}) {
  if (typeof lead.testRunId === "string" && lead.testRunId.trim()) return true
  const tags = Array.isArray(lead.tags) ? lead.tags : []
  if (tags.some((tag) => typeof tag === "string" && /^(teste|test|sandbox)$/i.test(tag.trim()))) return true
  return typeof lead.campaign === "string" && /\b(teste|test|sandbox)\b/i.test(lead.campaign)
}

export function anonymizeLeadRecord<T extends { id: string }>(
  lead: T
): T & { name: string; contact: string; anonymized: true } {
  return {
    ...lead,
    name: "Contacto removido",
    contact: `removed:${lead.id}`,
    memory: "",
    messages: [],
    facts: {},
    telegramChatId: undefined,
    anonymized: true,
  }
}

export function buildLeadGroupFilters(
  groupsInput: readonly LeadGroupV2[],
  counts: LeadGroupCounts
): LeadGroupFilterItem[] {
  const groups = normalizeLeadGroups(groupsInput)
  return [
    { id: LEAD_GROUP_FILTER_ALL, label: "Todos", count: counts.all },
    { id: LEAD_GROUP_FILTER_UNGROUPED, label: "Sem grupo", count: counts.ungrouped },
    ...groups.map((group) => ({
      id: group.id,
      label: group.name,
      count: counts.byGroupId[group.id] ?? 0,
      group,
    })),
  ]
}
