import { adsDeepLink } from "./telegram-start.ts"
import { ADS_ORIGIN, PIXEL_VERSION, pixelPageHtml } from "./tracker-script.ts"
import type { PageScript, SalesFunnel } from "./types.ts"

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
export const PAGE_SCRIPT_ID = /^[a-f0-9]{8}$/

export const PAGE_INSTALL_STEPS = [
  {
    title: "Publica o funil desta página",
    body: "A Sté fala o quadro publicado daquele funil. Sem production, o script recusa. Um funil já publicado continua válido mesmo que outro esteja activo.",
  },
  {
    title: "Cria um script para a landing",
    body: "Em Telegram ou Configurações → Pixel, ou via MCP (abilion_create_page_script). Dá um nome, escolhe o funil e, se quiseres, a URL da página. Máximo 20 scripts.",
  },
  {
    title: "Cola o snippet na página",
    body: "O <script src=\"https://www.abilion.lol/t.js?v=2&s=ID\"> vai no <head> ou antes de </body>. O botão/link do Telegram leva data-abilion-cta. Sem página própria, aponta o anúncio para /l?s=ID.",
  },
  {
    title: "O anúncio aponta para a landing",
    body: "Não mandes o Facebook directo para t.me — o pixel não vê a visita. O script grava view/clique e reescreve o start para fb_sID_vid no pointerdown e no clique.",
  },
  {
    title: "Confere o /start",
    body: "O href deve ficar t.me/BOT?start=fb_sID_xxxxxx. O webhook fecha o mesmo visitante e abre o funil deste script. Sem ?s=, usa o funil publicado.",
  },
] as const

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

export function addPageScript(
  current: PageScript[],
  input: { name: string; funnelId: string; pageUrl?: string }
): { ok: true; scripts: PageScript[]; script: PageScript } | { ok: false; error: string } {
  const name = input.name.trim().slice(0, 80)
  const funnelId = input.funnelId.trim().slice(0, 80)
  if (!name) return { ok: false, error: "Dá um nome ao script desta página." }
  if (!funnelId) return { ok: false, error: "Escolhe o funil desta landing." }
  const live = migratePageScripts(current)
  if (live.length >= PAGE_SCRIPT_CAP) return { ok: false, error: `O estúdio aceita no máximo ${PAGE_SCRIPT_CAP} scripts de página.` }
  const now = new Date().toISOString()
  let id = newPageScriptId()
  const used = new Set(live.map((item) => item.id))
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
    landing: input.script ? `${ADS_ORIGIN}/l?s=${input.script.id}` : `${ADS_ORIGIN}/l`,
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
