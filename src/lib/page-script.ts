import { adsDeepLink } from "./telegram-start.ts"
import { ADS_ORIGIN, PAGE_INSTALL_STEPS, PIXEL_VERSION, pixelPageHtml } from "./tracker-script.ts"
import type { PageScript, SalesFunnel } from "./types.ts"

export { PAGE_INSTALL_STEPS }

function pageUrlOf(value: string) {
  const next = value.trim()
  if (!next) return ""
  try {
    const url = new URL(next)
    if (url.protocol !== "http:" && url.protocol !== "https:") return ""
    if (url.username || url.password) return ""
    return url.toString()
  } catch {
    return ""
  }
}

export const PAGE_SCRIPT_CAP = 20
export const PAGE_SCRIPT_REMOVED_CAP = 40
export const PAGE_SCRIPT_ID = /^[a-f0-9]{8}$/

export function newPageScriptId() {
  return Array.from(crypto.getRandomValues(new Uint8Array(4)), (byte) => byte.toString(16).padStart(2, "0")).join("")
}

export function sanitizePageScript(raw: unknown): PageScript | null {
  if (!raw || typeof raw !== "object") return null
  const row = raw as Partial<PageScript>
  const id = typeof row.id === "string" ? row.id.trim().toLowerCase() : ""
  if (!PAGE_SCRIPT_ID.test(id)) return null
  const name = typeof row.name === "string" ? row.name.trim().slice(0, 80) : ""
  const funnelId = typeof row.funnelId === "string" ? row.funnelId.trim().slice(0, 80) : ""
  if (!name || !funnelId) return null
  const pageUrl = pageUrlOf(typeof row.pageUrl === "string" ? row.pageUrl : "")
  const createdAt = typeof row.createdAt === "string" && row.createdAt ? row.createdAt : new Date().toISOString()
  const updatedAt = typeof row.updatedAt === "string" && row.updatedAt ? row.updatedAt : createdAt
  return { id, name, funnelId, pageUrl: pageUrl || undefined, createdAt, updatedAt }
}

export function migratePageScripts(raw: unknown): PageScript[] {
  if (!Array.isArray(raw)) return []
  const out: PageScript[] = []
  const seen = new Set<string>()
  for (const item of raw) {
    const next = sanitizePageScript(item)
    if (!next || seen.has(next.id)) continue
    seen.add(next.id)
    out.push(next)
    if (out.length >= PAGE_SCRIPT_CAP) break
  }
  return out
}

export function mergePageScripts(...lists: Array<PageScript[] | undefined>) {
  const byId = new Map<string, PageScript>()
  for (const list of lists) {
    for (const item of list ?? []) {
      const next = sanitizePageScript(item)
      if (!next) continue
      const prev = byId.get(next.id)
      if (!prev || next.updatedAt >= prev.updatedAt) byId.set(next.id, next)
    }
  }
  return [...byId.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt)).slice(0, PAGE_SCRIPT_CAP)
}

export function migrateRemovedPageScripts(raw: unknown) {
  if (!Array.isArray(raw)) return []
  const out: string[] = []
  const seen = new Set<string>()
  for (const item of raw) {
    const id = typeof item === "string" ? item.trim().toLowerCase() : ""
    if (!PAGE_SCRIPT_ID.test(id) || seen.has(id)) continue
    seen.add(id)
    out.push(id)
    if (out.length >= PAGE_SCRIPT_REMOVED_CAP) break
  }
  return out
}

export function applyRemovedPageScripts(scripts: PageScript[], removed: Iterable<string>) {
  const drop = new Set(migrateRemovedPageScripts([...removed]))
  if (!drop.size) return scripts
  return scripts.filter((item) => !drop.has(item.id))
}

export function addPageScript(
  current: PageScript[],
  input: { name: string; funnelId: string; pageUrl?: string },
  reserved: Iterable<string> = []
): { ok: true; scripts: PageScript[]; script: PageScript } | { ok: false; error: string } {
  const name = input.name.trim().slice(0, 80)
  const funnelId = input.funnelId.trim().slice(0, 80)
  if (!name) return { ok: false, error: "Dá um nome ao script desta página." }
  if (!funnelId) return { ok: false, error: "Escolhe o funil desta landing." }
  const live = migratePageScripts(current)
  if (live.length >= PAGE_SCRIPT_CAP) return { ok: false, error: `O estúdio aceita no máximo ${PAGE_SCRIPT_CAP} scripts de página.` }
  const now = new Date().toISOString()
  let id = newPageScriptId()
  const used = new Set([...live.map((item) => item.id), ...migrateRemovedPageScripts([...reserved])])
  for (let i = 0; i < 8 && used.has(id); i++) id = newPageScriptId()
  const script: PageScript = {
    id,
    name,
    funnelId,
    pageUrl: pageUrlOf(input.pageUrl || "") || undefined,
    createdAt: now,
    updatedAt: now,
  }
  return { ok: true, scripts: [...live, script], script }
}

export function removePageScript(current: PageScript[], id: string): PageScript[] {
  const needle = id.trim().toLowerCase()
  return migratePageScripts(current).filter((item) => item.id !== needle)
}

export function adsLandingUrl(scriptId = "") {
  const id = scriptId.trim().toLowerCase()
  return PAGE_SCRIPT_ID.test(id) ? `${ADS_ORIGIN}/l?s=${id}` : `${ADS_ORIGIN}/l`
}

export function pageScriptById(scripts: PageScript[] | undefined, id: string | undefined) {
  const needle = (id || "").trim().toLowerCase()
  if (!PAGE_SCRIPT_ID.test(needle)) return undefined
  return (scripts ?? []).find((item) => item.id === needle)
}

export function funnelHasInstallableBoard(funnel?: SalesFunnel | null) {
  return Boolean(funnel?.production)
}

export function pageInstallManual(input: { botUsername?: string; script?: PageScript; funnelName?: string }) {
  const href = adsDeepLink(input.botUsername || "", adsStartToken(input.script?.id))
  const snippet = pixelPageHtml(ADS_ORIGIN, href, input.script?.id)
  return {
    ok: true as const,
    title: "Instalar o pixel da Abilion",
    steps: PAGE_INSTALL_STEPS.map((step) => ({ title: step.title, body: step.body })),
    snippet,
    landing: adsLandingUrl(input.script?.id),
    scriptSrc: input.script ? `${ADS_ORIGIN}/t.js?v=${PIXEL_VERSION}&s=${input.script.id}` : `${ADS_ORIGIN}/t.js?v=${PIXEL_VERSION}`,
    cta: "data-abilion-cta",
    start: input.script ? `fb_s${input.script.id}_{vid}` : "fb_{vid}",
    script: input.script
      ? { id: input.script.id, name: input.script.name, funnelId: input.script.funnelId, funnelName: input.funnelName, pageUrl: input.script.pageUrl }
      : undefined,
    notes: [
      "O anúncio aponta para a landing, não para t.me.",
      "Cada página/funil tem o seu script (?s=ID). Sem ID, o /start usa o funil publicado.",
      "Manual público: GET /api/install. No MCP: abilion_page_install_manual.",
    ],
  }
}

export function adsStartToken(scriptId?: string, visitorId?: string) {
  const script = (scriptId || "").trim().toLowerCase()
  const tagged = PAGE_SCRIPT_ID.test(script)
  const vid = (visitorId || "").trim().toLowerCase()
  if (tagged && vid) return `fb_s${script}_${vid}`
  if (tagged) return `fb_s${script}`
  if (vid) return `fb_${vid}`
  return "fb"
}
