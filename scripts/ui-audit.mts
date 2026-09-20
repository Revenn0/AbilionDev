import puppeteer, { type Page } from "puppeteer"

const BASE = process.env.AUDIT_URL || "http://127.0.0.1:43173"
const EMAIL = process.env.AUDIT_EMAIL || "victor@abilion.com"
const PASSWORD = process.env.AUDIT_PASSWORD || "abilion"
const PUBLIC_ONLY = process.env.AUDIT_PUBLIC === "1"
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

async function open(page: Page, path: string) {
  await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded", timeout: 20_000 })
  await page.waitForFunction(() => document.readyState === "complete", { timeout: 20_000 })
}

async function waitAuthPage(page: Page) {
  await page.waitForSelector("#email, #password, a[href='/forgot']", { timeout: 10_000 })
}

async function login(page: Page) {
  await open(page, "/login")
  if (!page.url().includes("/login")) return
  await page.waitForSelector("#email", { timeout: 10_000 })
  await page.click("#email", { clickCount: 3 })
  await page.type("#email", EMAIL)
  await page.click("#password", { clickCount: 3 })
  await page.type("#password", PASSWORD)
  await page.click("button[type=submit]")
  await page.waitForFunction(() => !location.pathname.includes("/login"), { timeout: 15_000 })
  await page.waitForSelector("h1", { timeout: 10_000 })
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

async function clickNamed(page: Page, text: string) {
  await page.waitForFunction(
    (needle) => [...document.querySelectorAll("button, a")].some((el) => (el.textContent || "").includes(needle)),
    { timeout: 8_000 },
    text
  )
  const clicked = await page.evaluate((needle) => {
    const el = [...document.querySelectorAll("button, a")].find((item) => (item.textContent || "").includes(needle))
    if (!el) return false
    ;(el as HTMLElement).click()
    return true
  }, text)
  assert(clicked, `não achei "${text}"`)
}

const browser = await puppeteer.launch({
  headless: true,
  args: ["--no-sandbox", "--disable-setuid-sandbox"],
})

try {
  const context = await browser.createBrowserContext()
  const page = await context.newPage()
  const errors: string[] = []
  page.on("pageerror", (error) => errors.push(error.message))
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text())
  })

  await open(page, "/login")
  await waitAuthPage(page)
  assert(page.url().includes("/login"), "login público sem sessão")
  assert(await page.$(".skip-link"), "skip-link no login")
  assert(await page.$("#conteudo"), "landmark #conteudo no login")
  assert(await page.$("#email"), "campo e-mail")
  assert(await page.$('label[for="email"]'), "label do e-mail")

  await open(page, "/forgot")
  await waitAuthPage(page)
  assert(page.url().includes("/forgot"), "forgot público sem sessão")
  assert(await page.$("#email"), "forgot tem e-mail")
  await page.click("button[type=submit]")
  await page.waitForSelector("#forgot-error", { timeout: 3_000 })

  await open(page, "/reset")
  await waitAuthPage(page)
  assert(page.url().includes("/reset"), "reset público sem sessão")
  const copy = await page.evaluate(() => document.body.innerText)
  assert(copy.includes("incompleto") || copy.includes("Gerar outro"), "reset sem token tem empty state")

  await open(page, "/privacidade")
  assert((await page.evaluate(() => document.body.innerText)).includes("privacidade"), "página de privacidade")

  await open(page, "/l")
  assert(await page.$("[data-abilion-cta]"), "landing tem CTA")

  if (PUBLIC_ONLY) {
    for (const viewport of VIEWPORTS) {
      await page.setViewport({ width: viewport.width, height: viewport.height })
      for (const route of ["/login", "/forgot", "/reset", "/l", "/privacidade"] as const) {
        await open(page, route)
        const box = await overflow(page)
        assert(!box.overflow, `overflow ${viewport.name}px em ${route} (${box.scrollWidth}>${box.clientWidth})`)
      }
    }
    console.log("ui-audit public ok")
  } else {
  await open(page, "/login")
  await waitAuthPage(page)
  await page.click("#email", { clickCount: 3 })
  await page.type("#email", EMAIL)
  await page.click("#password", { clickCount: 3 })
  await page.type("#password", "errada1")
  await page.click("button[type=submit]")
  await page.waitForSelector("#login-error", { timeout: 8_000 })

  await login(page)

  await page.setOfflineMode(true)
  await page.waitForFunction(() => document.body.innerText.includes("Sem rede"), { timeout: 4_000 })
  await page.setOfflineMode(false)

  for (const route of ROUTES) {
    await open(page, route)
    assert(!page.url().includes("/login"), `${route} ficou autenticada`)
    await page.waitForSelector("h1", { timeout: 10_000 })
  }

  const cookies = await page.cookies()
  await page.deleteCookie(...cookies.filter((item) => item.name === "abilion_session"))
  await page.evaluate(() => window.dispatchEvent(new Event("focus")))
  await page.waitForFunction(() => location.pathname.includes("/login"), { timeout: 8_000 })
  assert(page.url().includes("/login"), "cookie apagado volta ao login")
  await login(page)

  await open(page, "/pagina-inexistente")
  const notFound = await page.evaluate(() => document.body.innerText)
  assert(notFound.includes("não encontrada") || notFound.includes("404"), "404 no painel")

  await open(page, "/leads")
  await clickNamed(page, "Nova captura")
  await page.waitForSelector("#lead-name", { timeout: 5_000 })
  await page.click('button[type="submit"]')
  await page.waitForSelector("#lead-name-error", { timeout: 3_000 })
  assert(await page.$("#lead-contact-error"), "captura mostra os dois erros")
  await page.type("#lead-name", "Lead Auditoria")
  await page.type("#lead-contact", "@auditoria")
  await page.click('button[type="submit"]')
  await page.waitForFunction(() => !document.querySelector("#lead-name"), { timeout: 5_000 })
  await page.waitForSelector("#lead-search", { timeout: 5_000 })
  await page.type("#lead-search", "Auditoria")
  await page.waitForFunction(
    () => [...document.querySelectorAll("button")].some((el) => (el.textContent || "").includes("Lead Auditoria")),
    { timeout: 5_000 }
  )
  await clickNamed(page, "Lead Auditoria")
  await page.waitForFunction(
    () => [...document.querySelectorAll("button")].some((el) => (el.textContent || "").includes("Excluir lead")),
    { timeout: 5_000 }
  )
  page.once("dialog", (dialog) => dialog.accept())
  await clickNamed(page, "Excluir lead")
  await page.waitForFunction(
    () => ![...document.querySelectorAll("button")].some((el) => (el.textContent || "").includes("Lead Auditoria")),
    { timeout: 5_000 }
  )

  await open(page, "/fluxo")
  await clickNamed(page, "Novo funil")
  await page.waitForFunction(() => location.pathname.includes("/fluxo/funil/"), { timeout: 8_000 })
  await page.waitForFunction(
    () => [...document.querySelectorAll("button")].some((el) => (el.textContent || "").includes("Publicar")),
    { timeout: 8_000 }
  )
  const editorPath = new URL(page.url()).pathname

  for (const viewport of VIEWPORTS) {
    await page.setViewport({ width: viewport.width, height: viewport.height })
    for (const route of ["/", "/leads", "/conversas", "/configuracoes", "/fluxo", editorPath] as const) {
      await open(page, route)
      const box = await overflow(page)
      assert(!box.overflow, `overflow ${viewport.name}px em ${route} (${box.scrollWidth}>${box.clientWidth})`)
    }
  }

  await page.setViewport({ width: 1440, height: 900 })
  await open(page, "/")
  const logout = await page.evaluateHandle(() => document.querySelector('button[aria-label="Sair"]'))
  const logoutEl = logout.asElement()
  assert(logoutEl, "botão Sair")
  await logoutEl!.click()
  await page.waitForFunction(() => location.pathname.includes("/login"), { timeout: 10_000 })

  await open(page, "/forgot")
  assert(page.url().includes("/forgot"), "logout → forgot sem AuthGate a empurrar")
  assert(await page.$("#email"), "forgot vazio depois do logout")
  await open(page, "/reset")
  assert(page.url().includes("/reset"), "logout → reset")

  for (const viewport of VIEWPORTS) {
    await page.setViewport({ width: viewport.width, height: viewport.height })
    for (const route of ["/login", "/forgot", "/reset"] as const) {
      await open(page, route)
      const box = await overflow(page)
      assert(!box.overflow, `overflow ${viewport.name}px em ${route} (${box.scrollWidth}>${box.clientWidth})`)
    }
  }

  const relevant = errors.filter(
    (item) =>
      !item.includes("favicon") &&
      !item.includes("net::ERR") &&
      !item.includes("Failed to load resource") &&
      !item.includes("React Router Future Flag")
  )
  assert(relevant.length === 0, `erros de consola: ${relevant.join(" | ")}`)

  console.log("ui-audit ok")
  }
} finally {
  await browser.close()
}
