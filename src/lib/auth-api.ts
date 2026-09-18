import type { User } from "@/lib/types"

async function parse<T>(res: Promise<Response>): Promise<T> {
  const response = await res
  const data = (await response.json().catch(() => ({}))) as T & { error?: string }
  if (!response.ok) throw new Error(data.error || "Não foi possível autenticar.")
  return data
}

export function loginRequest(email: string, password: string) {
  return parse<{ user: User }>(
    fetch("/api/auth/login", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    })
  )
}

export function logoutRequest() {
  return fetch("/api/auth/logout", { method: "POST", credentials: "include" })
}

export function meRequest() {
  return parse<{ user: User | null }>(fetch("/api/auth/me", { credentials: "include", cache: "no-store" }))
}

export function forgotPasswordRequest(email: string) {
  return parse<{ ok: boolean; resetPath?: string }>(
    fetch("/api/auth/forgot", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    })
  )
}

export function resetPasswordRequest(token: string, password: string) {
  return parse<{ ok: boolean }>(
    fetch("/api/auth/reset", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    })
  )
}
