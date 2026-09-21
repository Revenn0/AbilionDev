const ALLOWED = new Set([
  "/",
  "/analytics",
  "/fluxo",
  "/leads",
  "/conversas",
  "/telegram",
  "/utilizadores",
  "/configuracoes",
  "/privacidade",
])

/** Landing, login, reset e t.js: /Login e /L/ não caem no SPA. */
export function foldPublicPath(pathname: string) {
  const raw = pathname.trim()
  if (!raw.startsWith("/")) return ""
  let next = raw.toLowerCase()
  if (next.length > 1 && next.endsWith("/")) next = next.replace(/\/+$/, "")
  return next || "/"
}

export function safeAppPath(raw: string | null | undefined) {
  if (!raw) return "/"
  const value = raw.trim()
  if (!value.startsWith("/")) return "/"
  if (value.startsWith("//") || value.startsWith("/\\")) return "/"
  if (value.includes("://") || value.includes("\\")) return "/"
  if (value.length > 180) return "/"
  const [path, query] = value.split("?")
  const pathname = path || "/"
  if (ALLOWED.has(pathname)) return query ? `${pathname}?${query}` : pathname
  if (pathname.startsWith("/fluxo/funil/")) {
    const id = pathname.slice("/fluxo/funil/".length)
    if (id && !id.includes("/") && !id.includes("..")) return pathname
  }
  return "/"
}

export function withSafeNext(path: string, raw?: string | null) {
  const next = safeAppPath(raw)
  if (!next || next === "/") return path
  return `${path}${path.includes("?") ? "&" : "?"}next=${encodeURIComponent(next)}`
}
