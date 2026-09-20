import puppeteer, { type Page } from "puppeteer"

const BASE = process.env.AUDIT_URL || "http://127.0.0.1:43173"
const EMAIL = process.env.AUDIT_EMAIL || "victor@abilion.com"
const PASSWORD = process.env.AUDIT_PASSWORD || "abilion"
const VIEWPORTS = [
  { name: "320", width: 320, height: 720 },
  { name: "375", width: 375, height: 812 },
  { name: "768", width: 768, height: 1024 },
  { name: "1024", width: 1024, height: 768 },
  { name: "1440", width: 1440, height: 900 },
] as const

const ROUTES = ["/", "/analytics", "/fluxo", "/leads", "/conversas", "/telegram", "/configuracoes"] as const

function assert(cond: unknown, message: string) {
  if (!cond) throw new Error(message)
}

async function waitReady(page: Page) {
  await page.waitForFunction(() => document.readyState === "complete", { timeout: 20_000 })
}

async function login(page: Page) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle0" })
  await waitReady(page)
  if (page.url().includes("/login") === false) return
  await page.waitForSelector("#email", { timeout: 10_000 })
  await page.type("#email", EMAIL)
  await page.type("#password", PASSWORD)
  await Promise.all([page.waitForNavigation({ waitUntil: "networkidle0" }), page.click("button[type=submit]")])
  assert(!page.url().includes("/login"), `login falhou em ${page.url()}`)
}

async function overflow(page: Page) {
  return page.evaluate(() => {
    const doc = document.documentElement
    return {
      scrollWidth: doc.scrollWidth,
      clientWidth: doc.clientWidth,
      overflow: doc.scrollWidth > doc.clientWidth + 2,
    }
  })
}

async function consoleErrors(page: Page) {
  const errors: string[] = []
  page.on("pageerror", (error) => errors.push(error.message))
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text())
  })
  return errors
}

const browser = await puppeteer.launch({
  headless: true,
  args: ["--no-sandbox", "--disable-setuid-sandbox"],
})

try {
  const page = await browser.newPage()
  const errors = await consoleErrors(page)

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle0" })
  assert(await page.$(".skip-link"), "skip-link no login")
  assert(await page.$("#conteudo"), "landmark #conteudo no login")
  assert(await page.$("#email"), "campo e-mail")
  assert(await page.$('label[for="email"]'), "label do e-mail")

  await page.goto(`${BASE}/forgot`, { waitUntil: "networkidle0" })
  assert(page.url().includes("/forgot") || page.url().includes("/login"), "forgot acessível ou redirecciona se já logado")
  if (page.url().includes("/forgot")) {
    assert(await page.$("#email"), "forgot tem e-mail")
    await page.click("button[type=submit]")
    assert(await page.$("#forgot-error"), "forgot mostra erro sem e-mail")
  }

  await page.goto(`${BASE}/reset`, { waitUntil: "networkidle0" })
  if (page.url().includes("/reset")) {
    const copy = await page.evaluate(() => document.body.innerText)
    assert(copy.includes("incompleto") || copy.includes("Gerar outro"), "reset sem token tem empty state")
  }

  await page.goto(`${BASE}/privacidade`, { waitUntil: "networkidle0" })
  assert((await page.$("h1")) && (await page.evaluate(() => document.body.innerText)).includes("privacidade"), "página de privacidade")

  await page.goto(`${BASE}/l`, { waitUntil: "networkidle0" })
  assert(await page.$("[data-abilion-cta]"), "landing tem CTA")

  await login(page)

  for (const route of ROUTES) {
    await page.goto(`${BASE}${route}`, { waitUntil: "networkidle0" })
    await waitReady(page)
    assert(!page.url().includes("/login"), `${route} ficou autenticada`)
    const heading = await page.$("h1, [data-slot='dialog-title'], .page-title")
    assert(heading || route === "/", `${route} renderizou`)
  }

  await page.goto(`${BASE}/pagina-inexistente`, { waitUntil: "networkidle0" })
  const notFound = await page.evaluate(() => document.body.innerText)
  assert(notFound.includes("não encontrada") || notFound.includes("404"), "404 no painel")

  await page.goto(`${BASE}/leads`, { waitUntil: "networkidle0" })
  const capture = await page.evaluateHandle(() => [...document.querySelectorAll("button")].find((el) => el.textContent?.includes("Nova captura")))
  const captureEl = capture.asElement()
  assert(captureEl, "botão Nova captura")
  await captureEl!.click()
  await page.waitForSelector("#lead-name", { timeout: 5_000 })
  await page.click("button[type=submit]")
  await page.waitForSelector("#lead-name-error", { timeout: 3_000 })
  assert(await page.$("#lead-contact-error"), "captura mostra os dois erros")

  for (const viewport of VIEWPORTS) {
    await page.setViewport({ width: viewport.width, height: viewport.height })
    for (const route of ["/", "/leads", "/conversas", "/configuracoes", "/login"] as const) {
      if (route === "/login") {
        await page.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded" })
      } else {
        await page.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded" })
      }
      await waitReady(page)
      const box = await overflow(page)
      assert(!box.overflow, `overflow ${viewport.name}px em ${route} (${box.scrollWidth}>${box.clientWidth})`)
    }
  }

  await page.setViewport({ width: 1440, height: 900 })
  await page.goto(`${BASE}/`, { waitUntil: "networkidle0" })
  const logout = await page.evaluateHandle(() =>
    [...document.querySelectorAll("button")].find((el) => el.getAttribute("aria-label") === "Sair")
  )
  const logoutEl = logout.asElement()
  if (logoutEl) {
    await Promise.all([page.waitForNavigation({ waitUntil: "networkidle0" }).catch(() => undefined), logoutEl.click()])
  }
  await page.goto(`${BASE}/forgot`, { waitUntil: "networkidle0" })
  assert(page.url().includes("/forgot"), "logout → forgot sem AuthGate a empurrar")
  assert(await page.$("#email"), "forgot vazio depois do logout")
  await page.goto(`${BASE}/reset`, { waitUntil: "networkidle0" })
  assert(page.url().includes("/reset"), "logout → reset")

  const relevant = errors.filter(
    (item) =>
      !item.includes("favicon") &&
      !item.includes("net::ERR") &&
      !item.includes("Failed to load resource")
  )
  assert(relevant.length === 0, `erros de consola: ${relevant.join(" | ")}`)

  console.log("ui-audit ok")
} finally {
  await browser.close()
}
