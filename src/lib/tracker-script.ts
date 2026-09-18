export const TRACKER_JS = `(() => {
  const script = document.currentScript;
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
  const rewrite = (anchor) => {
    try {
      const href = new URL(anchor.getAttribute("href") || "", location.href);
      if (!/t\\.me\\//i.test(href.href) && !anchor.matches(ctaSel)) return;
      href.searchParams.set("start", "fb_" + vid());
      anchor.setAttribute("href", href.toString());
    } catch (_) {}
  };
  send("view");
  const bind = () => {
    document.querySelectorAll("a[href*='t.me'], " + ctaSel).forEach(rewrite);
  };
  bind();
  document.addEventListener("click", (event) => {
    const anchor = event.target && event.target.closest ? event.target.closest("a") : null;
    if (!anchor) return;
    if (anchor.matches(ctaSel) || /t\\.me\\//i.test(anchor.href || "")) {
      rewrite(anchor);
      send("click", { href: anchor.href });
    }
  }, true);
  setInterval(function () { send("beat"); }, 30000);
})();
`
