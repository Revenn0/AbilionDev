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

const STUDIO = new Set(["/analytics", "/fluxo", "/leads", "/conversas", "/telegram", "/utilizadores", "/configuracoes"])

/** /Leads e /FLUXO/funil/AbC: o React é case-sensitive; o id do funil mantém-se. */
export function foldStudioPath(pathname: string): string | null {
  const raw = pathname.trim()
  if (!raw.startsWith("/")) return null
  const trimmed = raw.length > 1 && raw.endsWith("/") ? raw.replace(/\/+$/, "") || "/" : raw
  const lower = trimmed.toLowerCase()
  if (STUDIO.has(lower)) return trimmed === lower ? null : lower
  if (lower.startsWith("/fluxo/funil/")) {
    const marker = "/funil/"
    const id = trimmed.slice(lower.indexOf(marker) + marker.length)
    if (!id || id.includes("/") || id.includes("..")) return null
    const dest = `/fluxo/funil/${id}`
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
  return "/"
}

export function withSafeNext(path: string, raw?: string | null) {
  const next = safeAppPath(raw)
  if (!next || next === "/") return path
  return `${path}${path.includes("?") ? "&" : "?"}next=${encodeURIComponent(next)}`
}
