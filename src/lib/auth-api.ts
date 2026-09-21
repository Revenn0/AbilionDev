import type { User } from "@/lib/types"
import { fetchWithTimeout } from "@/lib/http"
import { noteUnauthorized } from "@/lib/session"

async function parse<T>(res: Promise<Response>, expireOn401 = false): Promise<T> {
  const response = await res
  if (expireOn401) noteUnauthorized(response)
  const data = (await response.json().catch(() => ({}))) as T & { error?: string }
  if (!response.ok) throw new Error(data.error || "Não foi possível autenticar.")
  return data
}

export function loginRequest(email: string, password: string) {
  return parse<{ user: User }>(
    fetchWithTimeout("/api/auth/login", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    })
  )
}

export function logoutRequest() {
  return fetchWithTimeout("/api/auth/logout", { method: "POST", credentials: "include" })
}

export function meRequest() {
  return parse<{ user: User | null }>(
    fetchWithTimeout("/api/auth/me", { credentials: "include", cache: "no-store" }),
    true
  )
}

export function forgotPasswordRequest(email: string) {
  return parse<{ ok: boolean; resetPath?: string }>(
    fetchWithTimeout("/api/auth/forgot", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    })
  )
}

export function changeEmailRequest(currentPassword: string, email: string) {
  return parse<{ ok: boolean; user: User }>(
    fetchWithTimeout("/api/auth/email", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, email }),
    }),
    true
  )
}

export function changePasswordRequest(currentPassword: string, password: string) {
  return parse<{ ok: boolean }>(
    fetchWithTimeout("/api/auth/password", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, password }),
    }),
    true
  )
}

export function resetPasswordRequest(token: string, password: string) {
  return parse<{ ok: boolean }>(
    fetchWithTimeout("/api/auth/reset", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    })
  )
}
