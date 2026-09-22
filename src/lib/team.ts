import type { AccessProfile } from "./platform"
import { ACCESS_PROFILES } from "./platform"
import type { UserRole } from "./types"

export const ASSIGNABLE_PROFILES = ACCESS_PROFILES.filter((item) => item !== "administrator")

export const PROFILE_HELP: Record<AccessProfile, string> = {
  administrator: "Contas, tokens, bots, CRM, criativos e auditoria.",
  bot_editor: "Edita bots, cérebro, fluxos e áudio.",
  crm_editor: "Gere leads, grupos e exportação.",
  creative_manager: "Cria e edita criativos.",
  viewer: "Só lê o estúdio.",
  publisher: "Publica fluxos e criativos.",
}

export const TEAM_FILTERS = [
  { id: "all", label: "Todas" },
  { id: "active", label: "Activas" },
  { id: "online", label: "Em sessão" },
  { id: "owners", label: "Donos" },
  { id: "operators", label: "Operadores" },
  { id: "disabled", label: "Desligadas" },
] as const

export type TeamFilter = (typeof TEAM_FILTERS)[number]["id"]

export type TeamAccount = {
  id: string
  name: string
  email: string
  role: UserRole
  disabled: boolean
  seeded: boolean
  tokenCount: number
  sessionCount?: number
  lastSeenAt?: string
}

const PASSWORD_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789"

export function generateAccountPassword(length = 12) {
  const size = Math.max(6, length)
  const bytes = new Uint8Array(size)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (byte) => PASSWORD_ALPHABET[byte % PASSWORD_ALPHABET.length]).join("")
}

export function isGeneratedAccountPassword(value: string) {
  return value.length >= 12 && /^[A-Za-z0-9]+$/.test(value)
}

export function toggleProfile(current: AccessProfile[], next: AccessProfile) {
  return current.includes(next) ? current.filter((item) => item !== next) : [...current, next]
}

export function userMatchesQuery(user: Pick<TeamAccount, "name" | "email">, query: string) {
  const needle = query.trim().toLocaleLowerCase("pt")
  if (!needle) return true
  return `${user.name} ${user.email}`.toLocaleLowerCase("pt").includes(needle)
}

export function userMatchesTeamFilter(user: TeamAccount, filter: TeamFilter) {
  if (filter === "active") return !user.disabled
  if (filter === "disabled") return user.disabled
  if (filter === "owners") return user.role === "owner"
  if (filter === "operators") return user.role === "operator"
  if (filter === "online") return !user.disabled && (user.sessionCount ?? 0) > 0
  return true
}

export function sortTeamUsers<T extends TeamAccount>(users: T[]) {
  return [...users].sort((left, right) => {
    if (left.seeded !== right.seeded) return left.seeded ? -1 : 1
    if (left.role !== right.role) return left.role === "owner" ? -1 : 1
    if (left.disabled !== right.disabled) return left.disabled ? 1 : -1
    return left.name.localeCompare(right.name, "pt")
  })
}

export function countTeamUsers(users: TeamAccount[]) {
  return {
    all: users.length,
    active: users.filter((user) => !user.disabled).length,
    disabled: users.filter((user) => user.disabled).length,
    owners: users.filter((user) => user.role === "owner").length,
    operators: users.filter((user) => user.role === "operator").length,
    online: users.filter((user) => !user.disabled && (user.sessionCount ?? 0) > 0).length,
  }
}

export function accountLocks(user: Pick<TeamAccount, "id" | "seeded" | "role">, actorId?: string) {
  const self = Boolean(actorId) && user.id === actorId
  return {
    self,
    seeded: user.seeded,
    canRename: true,
    canDisable: !self && !user.seeded,
    canChangeRole: !user.seeded,
    canChangeProfiles: !user.seeded && user.role !== "owner",
    canResetPassword: !self,
  }
}

export function filterTeamUsers<T extends TeamAccount>(users: T[], query: string, filter: TeamFilter) {
  return sortTeamUsers(users.filter((user) => userMatchesQuery(user, query) && userMatchesTeamFilter(user, filter)))
}
