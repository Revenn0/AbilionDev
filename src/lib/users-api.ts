import type { AccessProfile } from "@/lib/platform"
import type { User, UserRole } from "@/lib/types"
import { fetchWithTimeout } from "@/lib/http"
import { noteUnauthorized } from "@/lib/session"

export type ManagedUser = User & {
  role: UserRole
  profiles?: AccessProfile[]
  disabled: boolean
  createdAt: string
  seeded: boolean
  tokenCount: number
}

export type ApiTokenItem = {
  id: string
  name: string
  prefix: string
  createdAt: string
}

/** Criar, desligar ou gerar token: leftover depois de um GET falho não confirma a lista. */
export function usersWriteBlocked(list: unknown[] | null, error?: string) {
  return list === null || Boolean(error)
}

async function parse<T>(res: Promise<Response>): Promise<T> {
  const response = await res
  noteUnauthorized(response)
  const data = (await response.json().catch(() => ({}))) as T & { error?: string }
  if (!response.ok) throw new Error(data.error || "Não foi possível falar com o Worker.")
  return data
}

export function listUsersRequest() {
  return parse<{ ok: boolean; users: ManagedUser[]; cap: number; me: User }>(
    fetchWithTimeout("/api/users", { credentials: "include", cache: "no-store" })
  )
}

export function createUserRequest(input: {
  email: string
  name: string
  password: string
  role: UserRole
  profiles?: AccessProfile[]
}) {
  return parse<{ ok: boolean; user: ManagedUser }>(
    fetchWithTimeout("/api/users", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    })
  )
}

export function patchUserRequest(input: {
  id: string
  name?: string
  role?: UserRole
  disabled?: boolean
  profiles?: AccessProfile[]
}) {
  return parse<{ ok: boolean; user: ManagedUser }>(
    fetchWithTimeout("/api/users", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    })
  )
}

export function listTokensRequest() {
  return parse<{ ok: boolean; tokens: ApiTokenItem[]; cap: number }>(
    fetchWithTimeout("/api/tokens", { credentials: "include", cache: "no-store" })
  )
}

export function createTokenRequest(name: string) {
  return parse<{ ok: boolean; token: string; item: ApiTokenItem }>(
    fetchWithTimeout("/api/tokens", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    })
  )
}

export function revokeTokenRequest(id: string) {
  return parse<{ ok: boolean }>(
    fetchWithTimeout(`/api/tokens?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
      credentials: "include",
    })
  )
}
