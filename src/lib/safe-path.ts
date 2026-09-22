const ALLOWED = new Set([
  "/",
  "/analytics",
  "/bots",
  "/audio",
  "/criativos",
  "/registos",
  "/fluxo",
  "/leads",
  "/conversas",
  "/telegram",
  "/utilizadores",
  "/configuracoes",
  "/conta",
  "/privacidade",
])

const WORKER_PUBLIC = new Set(["/t.js", "/l", "/login", "/forgot", "/reset", "/privacidade", "/mcp", "/api/mcp"])

/** Landing, login, reset e t.js: /Login e /L/ não caem no SPA. */
export function foldPublicPath(pathname: string) {
  const raw = pathname.trim()
  if (!raw.startsWith("/")) return ""
  let next = raw.toLowerCase()
  if (next.length > 1 && next.endsWith("/")) next = next.replace(/\/+$/, "")
  return next || "/"
}

/** Vite local: as mesmas rotas públicas do Worker, inclusive /Login e /T.js. */
export function isWorkerPublicPath(pathname: string) {
  const path = foldPublicPath(pathname)
  if (!path) return false
  return WORKER_PUBLIC.has(path) || path.startsWith("/api/")
}

const STUDIO = new Set([
  "/analytics",
  "/bots",
  "/audio",
  "/criativos",
  "/registos",
  "/fluxo",
  "/leads",
  "/conversas",
  "/telegram",
  "/utilizadores",
  "/configuracoes",
  "/conta",
])

const STUDIO_ALIASES: Record<string, string> = {
  "/settings": "/configuracoes",
  "/users": "/utilizadores",
}

/** /Leads, /settings e /FLUXO/funil/AbC: o React é case-sensitive; o id do funil mantém-se. */
export function foldStudioPath(pathname: string): string | null {
  const raw = pathname.trim()
  if (!raw.startsWith("/")) return null
  const trimmed = raw.length > 1 && raw.endsWith("/") ? raw.replace(/\/+$/, "") || "/" : raw
  const lower = trimmed.toLowerCase()
  const alias = STUDIO_ALIASES[lower]
  if (alias) return alias === trimmed ? null : alias
  if (STUDIO.has(lower)) return trimmed === lower ? null : lower
  if (lower.startsWith("/fluxo/funil/")) {
    const marker = "/funil/"
    const id = trimmed.slice(lower.indexOf(marker) + marker.length)
    if (!id || id.includes("/") || id.includes("..")) return null
    const dest = `/fluxo/funil/${id}`
    return dest === trimmed ? null : dest
  }
  if (lower.startsWith("/bots/")) {
    const segments = trimmed.split("/").filter(Boolean)
    if (segments.length < 2 || segments.length > 3 || segments[0]?.toLowerCase() !== "bots") return null
    const id = segments[1]
    const child = segments[2]?.toLowerCase()
    if (!id || id.includes("..") || (child && child !== "brain" && child !== "audio")) return null
    const dest = `/bots/${id}${child ? `/${child}` : ""}`
    return dest === trimmed ? null : dest
  }
  return null
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
  const folded = foldStudioPath(pathname) ?? pathname
  if (ALLOWED.has(folded)) return query ? `${folded}?${query}` : folded
  if (folded.startsWith("/fluxo/funil/")) {
    const id = folded.slice("/fluxo/funil/".length)
    if (id && !id.includes("/") && !id.includes("..")) return folded
  }
  if (folded.startsWith("/bots/")) {
    const segments = folded.split("/").filter(Boolean)
    const id = segments[1]
    const child = segments[2]
    if (id && !id.includes("..") && (!child || child === "brain" || child === "audio")) {
      return query ? `${folded}?${query}` : folded
    }
  }
  return "/"
}

export function withSafeNext(path: string, raw?: string | null) {
  const next = safeAppPath(raw)
  if (!next || next === "/") return path
  return `${path}${path.includes("?") ? "&" : "?"}next=${encodeURIComponent(next)}`
}
