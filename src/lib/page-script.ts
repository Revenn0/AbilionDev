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

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

/** HTML da /l no Worker: t.js + CTA no primeiro byte, sem esperar o SPA. */
export function adsLandingDocument(input: { botUsername?: string; scriptId?: string } = {}) {
  const scriptId = PAGE_SCRIPT_ID.test((input.scriptId || "").trim().toLowerCase())
    ? (input.scriptId || "").trim().toLowerCase()
    : ""
  const href = adsDeepLink(input.botUsername || "", adsStartToken(scriptId || undefined))
  const src = scriptId ? `/t.js?v=${PIXEL_VERSION}&s=${scriptId}` : `/t.js?v=${PIXEL_VERSION}`
  const scriptAttr = scriptId ? ` data-abilion-script="${scriptId}"` : ""
  const startHint = scriptId ? `fb_s${scriptId}_vid` : "fb_vid"
  const title = "Sté, a Mãe do Aviator, te chama no Telegram."
  const description =
    "Entra, recebe as 3 mensagens de boas-vindas e o minicurso. O pixel desta página grava a visita, o clique e o estado — depois o /start fecha o mesmo visitante no CRM."
  const canonical = adsLandingUrl(scriptId)
  const cta = href
    ? `<a data-abilion-cta href="${escapeHtml(href)}" class="cta">Falar com a Sté no Telegram</a>`
    : `<p role="status" class="muted">O Telegram desta campanha ainda não está ligado. Volta daqui a pouco.</p>`
  const hint = href
    ? `O botão vira <code>t.me/...?start=${startHint}</code>. Sem cadastro nesta página.`
    : "Sem cadastro nesta página. O clique só abre quando o bot estiver ligado."
  return `<!doctype html>
<html lang="pt">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}">
<link rel="canonical" href="${escapeHtml(canonical)}">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:url" content="${escapeHtml(canonical)}">
<meta property="og:type" content="website">
<!-- Abilion pixel — o anúncio aponta para esta página, não para t.me. -->
<script src="${src}" data-cta="[data-abilion-cta]" data-abilion-pixel="1"${scriptAttr}></script>
<style>
  html,body{margin:0;background:#0b0d12;color:#f4f4f5;font-family:ui-sans-serif,system-ui,sans-serif}
  main{box-sizing:border-box;min-height:100vh;max-width:36rem;margin:0 auto;padding:2rem 1.25rem;display:flex;flex-direction:column}
  .kicker{margin:0;font-size:12px;font-weight:600;letter-spacing:.18em;text-transform:uppercase;color:#38bdf8}
  h1{margin:12px 0 0;font-size:clamp(28px,6vw,42px);line-height:1.05;letter-spacing:-.04em}
  .lead{margin:16px 0 0;font-size:16px;line-height:1.6;color:#a1a1aa}
  ul{margin:24px 0 0;padding:0 0 0 1.1rem;color:#d4d4d8;font-size:14px;line-height:1.6}
  .cta{display:inline-flex;align-items:center;justify-content:center;height:48px;margin-top:32px;padding:0 24px;border-radius:999px;background:#38bdf8;color:#082f49;font-size:15px;font-weight:600;text-decoration:none}
  .cta:focus-visible{outline:2px solid #e0f2fe;outline-offset:2px}
  .muted{margin:32px 0 0;font-size:14px;color:#a1a1aa}
  .hint{margin:16px 0 0;font-size:12px;color:#a1a1aa}
  footer{margin-top:auto;padding-top:64px;font-size:11px;color:#a1a1aa}
  footer a{color:inherit}
  .skip-link{position:absolute;left:.75rem;top:-3.5rem;z-index:100;border-radius:999px;background:#f4f4f5;color:#0b0d12;padding:.45rem .9rem;font-size:13px;font-weight:500}
  .skip-link:focus{top:.75rem;outline:2px solid #38bdf8;outline-offset:2px}
</style>
</head>
<body>
<a href="#conteudo" class="skip-link">Ir para o conteúdo</a>
<main id="conteudo" tabindex="-1">
<p class="kicker">Minicurso gratuito</p>
<h1>${escapeHtml(title)}</h1>
<p class="lead">${escapeHtml(description)}</p>
<ul>
<li>Como parar de operar no escuro</li>
<li>Cadastro Superbet com o bônus certo</li>
<li>Grupo Premium só se fizer sentido</li>
</ul>
${cta}
<p class="hint">${hint}</p>
<footer>Abilion · landing do pixel · <a href="/privacidade">Privacidade</a></footer>
</main>
</body>
</html>`
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
