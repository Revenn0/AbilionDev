const ALLOWED = new Set([
  "/",
  "/analytics",
  "/fluxo",
  "/leads",
  "/conversas",
  "/telegram",
  "/configuracoes",
])

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
