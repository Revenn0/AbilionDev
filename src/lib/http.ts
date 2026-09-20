export const FETCH_TIMEOUT_MS = 12_000
export const KEEPALIVE_MAX_BYTES = 60_000

export function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit, ms = FETCH_TIMEOUT_MS) {
  return fetch(input, { ...init, signal: AbortSignal.timeout(ms) })
}

/** pagehide: keepalive só abaixo do limite do browser (~64 kb). Sem AbortSignal. */
export function fetchWrite(input: RequestInfo | URL, init?: RequestInit, opts?: { keepalive?: boolean }) {
  const body = typeof init?.body === "string" ? init.body : ""
  if (opts?.keepalive && body.length <= KEEPALIVE_MAX_BYTES) {
    return fetch(input, { ...init, keepalive: true })
  }
  return fetchWithTimeout(input, init)
}
