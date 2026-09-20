export const FETCH_TIMEOUT_MS = 12_000

export function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit, ms = FETCH_TIMEOUT_MS) {
  return fetch(input, { ...init, signal: AbortSignal.timeout(ms) })
}
