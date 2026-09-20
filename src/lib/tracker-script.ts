export const VISITOR_STORAGE_KEY = "abilion_vid"
export const ADS_ORIGIN = "https://www.abilion.lol"

export function pixelSnippet(origin: string) {
  const base = origin.replace(/\/$/, "")
  return `<script src="${base}/t.js" data-cta="[data-abilion-cta]"></script>`
}

export function pixelPageHtml(origin: string, telegramHref = "") {
  const script = pixelSnippet(origin)
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

export const TRACKER_JS = `(() => {
  const script = document.currentScript || document.querySelector('script[src*="/t.js"]');
  if (!script || !script.src) return;
  const origin = new URL(script.src).origin;
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
      utmCampaign: url.searchParams.get("utm_campaign") || undefined,
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
      href.searchParams.set("start", "fb_" + vid());
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
