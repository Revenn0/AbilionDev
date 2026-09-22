import {
  canAccess,
  sanitizeAccessProfiles,
  type AccessProfile,
  type Permission,
} from "./platform"
import type { UserRole } from "./types"

export const DEFAULT_OPERATOR_PROFILES: AccessProfile[] = [
  "bot_editor",
  "crm_editor",
  "creative_manager",
]

export const PROFILE_LABEL: Record<AccessProfile, string> = {
  administrator: "Administrador",
  bot_editor: "Editor de bots",
  crm_editor: "Editor de CRM",
  creative_manager: "Gestor de criativos",
  viewer: "Leitura",
  publisher: "Publicador",
}

export function profilesForUser(
  user?: { role?: UserRole | string; profiles?: AccessProfile[] | unknown } | null
): AccessProfile[] {
  if (!user) return ["viewer"]
  if (user.role === "owner") return ["administrator"]
  const assigned = sanitizeAccessProfiles(user.profiles)
  return assigned.length ? assigned : DEFAULT_OPERATOR_PROFILES
}

export function userCan(
  user: { role?: UserRole | string; profiles?: AccessProfile[] | unknown } | null | undefined,
  permission: Permission
) {
  return canAccess(profilesForUser(user), permission)
}

export function navAllowed(
  href: string,
  user: { role?: UserRole | string; profiles?: AccessProfile[] | unknown } | null | undefined
) {
  if (href === "/utilizadores") return userCan(user, "users.write")
  if (href === "/registos") return userCan(user, "audit.read")
  return userCan(user, "bots.read")
}
