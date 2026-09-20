export const VISITOR_STORAGE_KEY = "abilion_vid"
export const ADS_ORIGIN = "https://www.abilion.lol"
export const PIXEL_VERSION = 2

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

export function pixelInstallLines(scriptId = "") {
  const id = scriptId.trim().toLowerCase()
  const tagged = /^[a-f0-9]{8}$/.test(id)
  const src = tagged ? `${ADS_ORIGIN}/t.js?v=${PIXEL_VERSION}&s=${id}` : `${ADS_ORIGIN}/t.js?v=${PIXEL_VERSION}`
  return [
    "Abilion pixel — manual de instalação",
    ...PAGE_INSTALL_STEPS.map((step, index) => `${index + 1}. ${step.title}: ${step.body}`),
    `Snippet: <script src="${src}" data-cta="[data-abilion-cta]">`,
    'Botão Telegram: <a href="https://t.me/BOT?start=fb" data-abilion-cta>',
    `Manual JSON: ${ADS_ORIGIN}/api/install${tagged ? `?s=${id}` : ""}`,
    "MCP: abilion_page_install_manual · abilion_create_page_script",
  ]
}

export function pixelSnippet(origin: string, scriptId = "") {
  const base = origin.replace(/\/$/, "")
  const id = scriptId.trim().toLowerCase()
  const tagged = /^[a-f0-9]{8}$/.test(id)
  const src = tagged ? `${base}/t.js?v=${PIXEL_VERSION}&s=${id}` : `${base}/t.js?v=${PIXEL_VERSION}`
  const extra = tagged ? ` data-abilion-script="${id}"` : ""
  const comment = `<!--\n${pixelInstallLines(id).join("\n")}\n-->`
  return `${comment}\n<script src="${src}" data-cta="[data-abilion-cta]"${extra}></script>`
}

export function pixelPageHtml(origin: string, telegramHref = "", scriptId = "") {
  const script = pixelSnippet(origin, scriptId)
  if (!/^https:\/\/t\.me\/[A-Za-z0-9_]{5,32}\?start=[A-Za-z0-9_\-:.]+$/.test(telegramHref)) return script
  return `${script}\n<a href="${telegramHref}" data-abilion-cta>Falar no Telegram</a>`
}

export function readVisitorId() {
  try {
    let id = localStorage.getItem(VISITOR_STORAGE_KEY)
    if (!id || !/^[a-f0-9]{6,16}$/i.test(id)) {
      const bytes = new Uint8Array(5)
      crypto.getRandomValues(bytes)
      id = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")
      localStorage.setItem(VISITOR_STORAGE_KEY, id)
    }
    return id.toLowerCase()
  } catch {
    return Math.random().toString(16).slice(2, 12)
  }
}

export function isTelegramAdsHref(href: string, base = "https://abilion.lol") {
  try {
    const url = new URL(href, base)
    const host = url.hostname.replace(/^www\./, "")
    if (host !== "t.me" && host !== "telegram.me") return false
    const path = url.pathname.replace(/^\//, "")
    if (!path || path.startsWith("+") || /^joinchat\//i.test(path) || /^s\//i.test(path)) return false
    return true
  } catch {
    return false
  }
}

export const TRACKER_JS = `/*
 * ${pixelInstallLines().join("\n * ")}
 */
(() => {
  const script = document.currentScript || document.querySelector('script[src*="/t.js"]');
  if (!script || !script.src) return;
  const parsed = new URL(script.src);
  const origin = parsed.origin;
  const scriptId = (parsed.searchParams.get("s") || script.getAttribute("data-abilion-script") || "").toLowerCase();
  const tagged = /^[a-f0-9]{8}$/.test(scriptId);
  const ctaSel = script.getAttribute("data-cta") || "[data-abilion-cta]";
  const KEY = "abilion_vid";
  const vid = () => {
    try {
      let id = localStorage.getItem(KEY);
      if (!id || !/^[a-f0-9]{6,16}$/i.test(id)) {
        const bytes = new Uint8Array(5);
        crypto.getRandomValues(bytes);
        id = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
        localStorage.setItem(KEY, id);
      }
      return id;
    } catch {
      return Math.random().toString(16).slice(2, 12);
    }
  };
  const send = (kind, extra) => {
    const url = new URL(location.href);
    const body = JSON.stringify({
      kind,
      visitorId: vid(),
      path: location.pathname + location.search,
      referrer: document.referrer,
      fbclid: url.searchParams.get("fbclid") || undefined,
      utmSource: url.searchParams.get("utm_source") || undefined,
      utmCampaign: tagged ? ("Facebook · " + scriptId) : (url.searchParams.get("utm_campaign") || undefined),
      scriptId: tagged ? scriptId : undefined,
      language: navigator.language,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      href: extra && extra.href,
    });
    const endpoint = origin + "/api/track";
    try {
      fetch(endpoint, { method: "POST", body, mode: "no-cors", keepalive: true, headers: { "content-type": "text/plain" } });
    } catch (_) {}
  };
  const adsHref = (raw) => {
    try {
      const href = new URL(raw || "", location.href);
      const host = href.hostname.replace(/^www\\./, "");
      if (host !== "t.me" && host !== "telegram.me") return false;
      const path = href.pathname.replace(/^\\//, "");
      if (!path || path.charAt(0) === "+" || /^joinchat\\//i.test(path) || /^s\\//i.test(path)) return false;
      return true;
    } catch (_) {
      return false;
    }
  };
  const rewrite = (anchor) => {
    try {
      const raw = anchor.getAttribute("href") || "";
      if (!anchor.matches(ctaSel) && !adsHref(raw)) return;
      const href = new URL(raw, location.href);
      href.searchParams.set("start", (tagged ? "fb_s" + scriptId + "_" : "fb_") + vid());
      anchor.setAttribute("href", href.toString());
    } catch (_) {}
  };
  send("view");
  const bind = () => {
    document.querySelectorAll("a[href*='t.me'], " + ctaSel).forEach(rewrite);
  };
  bind();
  const onPointer = (event) => {
    const anchor = event.target && event.target.closest ? event.target.closest("a") : null;
    if (!anchor) return;
    if (!anchor.matches(ctaSel) && !adsHref(anchor.href || "")) return;
    rewrite(anchor);
  };
  const onClick = (event) => {
    const anchor = event.target && event.target.closest ? event.target.closest("a") : null;
    if (!anchor) return;
    if (!anchor.matches(ctaSel) && !adsHref(anchor.href || "")) return;
    rewrite(anchor);
    send("click", { href: anchor.href });
  };
  document.addEventListener("pointerdown", onPointer, true);
  document.addEventListener("auxclick", onClick, true);
  document.addEventListener("click", onClick, true);
  setInterval(function () { send("beat"); }, 30000);
})();
`
