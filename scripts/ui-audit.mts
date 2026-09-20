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
  const description = await page.$eval("meta[name=description]", (el) => el.getAttribute("content") || "")
  assert(description.includes("Abilion"), "meta description")
  assert(await page.$(".skip-link"), "skip-link no login")
  assert(await page.$("#conteudo"), "landmark #conteudo no login")
  assert(await page.$("#email"), "campo e-mail")
  assert(await page.$('label[for="email"]'), "label do e-mail")
  assert(await page.$('a[href="/privacidade"]'), "login liga privacidade")
  await page.keyboard.press("Tab")
  const skipFocused = await page.evaluate(() => document.activeElement?.classList.contains("skip-link"))
  assert(skipFocused, "primeiro Tab foca o skip-link")
  await page.focus("#email")
  await page.keyboard.press("Tab")
  const afterEmail = await page.evaluate(() => document.activeElement?.id || document.activeElement?.getAttribute("aria-label") || "")
  assert(afterEmail === "password" || afterEmail === "Mostrar senha", "Tab do e-mail segue no campo da senha")

  await open(page, "/login?next=/leads")
  await waitAuthPage(page)
  const forgotHref = await page.$eval('a[href*="forgot"]', (el) => el.getAttribute("href") || "")
  assert(forgotHref.includes("next="), "login com next leva o next ao forgot")

  await open(page, "/forgot")
  await waitAuthPage(page)
  assert(page.url().includes("/forgot"), "forgot público sem sessão")
  assert(await page.$("#email"), "forgot tem e-mail")
  assert(
    (await page.evaluate(() => document.body.innerText)).includes("não há e-mail") ||
      (await page.evaluate(() => document.body.innerText)).includes("Configurações"),
    "forgot explica que produção não envia e-mail"
  )
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
  assert(await page.$('a[href="/privacidade"]'), "landing liga privacidade")
  const landingCopy = await page.evaluate(() => document.body.innerText)
  assert(
    Boolean(await page.$("[data-abilion-cta]")) ||
      landingCopy.includes("ainda não está ligado") ||
      landingCopy.includes("A carregar o botão") ||
      landingCopy.includes("Não consegui falar"),
    "landing tem CTA ou empty state"
  )

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

  await open(page, "/configuracoes")
  await page.waitForSelector("#bot-user", { timeout: 8_000 })
  await page.focus("#settings-tab-bot")
  await page.keyboard.press("ArrowRight")
  await page.waitForFunction(
    () => document.body.innerText.includes("Conta do operador") || location.search.includes("tab=conta"),
    { timeout: 5_000 }
  )
  await open(page, "/configuracoes")
  await page.waitForSelector("#bot-user", { timeout: 8_000 })
  await page.click("#bot-user", { clickCount: 3 })
  await page.keyboard.press("Backspace")
  await page.type("#bot-user", "ab")
  await clickNamed(page, "Vincular Telegram")
  await page.waitForSelector("#bot-user-error", { timeout: 4_000 })

  await open(page, "/pagina-inexistente")
  await page.waitForFunction(
    () => document.body.innerText.includes("não encontrada") || document.body.innerText.includes("404"),
    { timeout: 8_000 }
  )
  await open(page, "/fluxo/funil/nao-existe")
  await page.waitForFunction(() => document.body.innerText.includes("Funil não encontrado"), { timeout: 10_000 })

  await open(page, "/leads")
  await clickNamed(page, "Nova captura")
  await page.waitForSelector("#lead-name", { timeout: 5_000 })
  await page.click('button[type="submit"]')
  await page.waitForSelector("#lead-name-error", { timeout: 3_000 })
  assert(await page.$("#lead-contact-error"), "captura mostra os dois erros")
  const auditName = `Lead Auditoria ${Date.now()}`
  await page.type("#lead-name", auditName)
  await page.type("#lead-contact", `@auditoria${Date.now().toString().slice(-6)}`)
  await page.click('button[type="submit"]')
  await page.waitForFunction(() => !document.querySelector("#lead-name"), { timeout: 5_000 })
  await page.waitForSelector("#lead-search", { timeout: 5_000 })
  await page.click("#lead-search", { clickCount: 3 })
  await page.type("#lead-search", auditName)
  await page.waitForFunction(
    (name) => [...document.querySelectorAll("button")].some((el) => (el.textContent || "").includes(name)),
    { timeout: 5_000 },
    auditName
  )
  await clickNamed(page, auditName)
  await page.waitForSelector("#lead-memory", { timeout: 5_000 })
  const closeBackdrop = await page.evaluate(() => Boolean(document.querySelector("[aria-label='Fechar ficha do lead']")))
  assert(closeBackdrop, "fundo da ficha do lead fecha com teclado")
  await page.click("#lead-memory", { clickCount: 3 })
  await page.type("#lead-memory", "memoria isolada")
  const closed = await page.evaluate(() => {
    const el = document.querySelector<HTMLButtonElement>("[data-lead-close]")
    el?.click()
    return Boolean(el)
  })
  assert(closed, "botão Fechar do lead")
  await page.waitForFunction(() => !document.querySelector("#lead-memory"), { timeout: 5_000 })
  await clickNamed(page, auditName)
  await page.waitForSelector("#lead-memory", { timeout: 5_000 })
  const remembered = await page.$eval("#lead-memory", (el) => (el as HTMLTextAreaElement).value)
  assert(remembered.includes("memoria isolada"), "memória do lead sobrevive ao Fechar")
  await page.waitForFunction(
    () => [...document.querySelectorAll("button")].some((el) => (el.textContent || "").includes("Excluir lead")),
    { timeout: 5_000 }
  )
  page.once("dialog", (dialog) => dialog.accept())
  await clickNamed(page, "Excluir lead")
  await page.waitForFunction(
    (name) => ![...document.querySelectorAll("button")].some((el) => (el.textContent || "").includes(name)),
    { timeout: 5_000 },
    auditName
  )

  await open(page, "/fluxo")
  await clickNamed(page, "Novo funil")
  await page.waitForFunction(() => location.pathname.includes("/fluxo/funil/"), { timeout: 8_000 })
  await page.waitForFunction(
    () => [...document.querySelectorAll("button")].some((el) => (el.textContent || "").includes("Publicar")),
    { timeout: 8_000 }
  )
  const landingBlock = await page.evaluateHandle(() =>
    [...document.querySelectorAll("[role='button']")].find((el) => (el.textContent || "").includes("Landing"))
  )
  const landingEl = landingBlock.asElement()
  assert(landingEl, "paleta tem Landing clicável")
  await landingEl!.click()
  await page.waitForFunction(
    () => [...document.querySelectorAll("input")].some((el) => (el as HTMLInputElement).value === "Landing"),
    { timeout: 5_000 }
  )
  const labelledTitle = await page.evaluate(() =>
    [...document.querySelectorAll("label[for]")].some((label) => {
      const id = label.getAttribute("for")
      const input = id ? document.getElementById(id) : null
      return Boolean(input && (input as HTMLInputElement).value === "Landing")
    })
  )
  assert(labelledTitle, "inspector associa o título ao input")
  await clickNamed(page, "Voltar")
  await page.waitForFunction(() => location.pathname === "/fluxo" || location.pathname.endsWith("/fluxo"), { timeout: 8_000 })
  await page.waitForFunction(
    () =>
      [...document.querySelectorAll("article")].some(
        (el) => (el.textContent || "").includes("Novo funil") && [...el.querySelectorAll("a")].some((item) => (item.textContent || "").includes("Abrir"))
      ),
    { timeout: 8_000 }
  )
  const reopened = await page.evaluate(() => {
    const article = [...document.querySelectorAll("article")].find((el) => (el.textContent || "").includes("Novo funil"))
    const open = article ? [...article.querySelectorAll("a")].find((item) => (item.textContent || "").includes("Abrir")) : null
    if (!open) return false
    ;(open as HTMLElement).click()
    return true
  })
  assert(reopened, "reabri o funil novo")
  await page.waitForFunction(() => location.pathname.includes("/fluxo/funil/"), { timeout: 8_000 })
  await page.waitForFunction(
    () => [...document.querySelectorAll(".react-flow__node span")].some((el) => (el.textContent || "").trim() === "Landing"),
    { timeout: 8_000 }
  )
  const persistedLanding = await page.evaluate(() => {
    const node = [...document.querySelectorAll(".react-flow__node")].find((el) =>
      [...el.querySelectorAll("span")].some((span) => (span.textContent || "").trim() === "Landing")
    )
    if (node) (node as HTMLElement).click()
    return Boolean(node)
  })
  assert(persistedLanding, "bloco Landing persistiu depois de Voltar")
  const zoomLabel = await page.evaluate(() => Boolean(document.querySelector("[aria-label='Aproximar']")))
  assert(zoomLabel, "controlos do quadro têm nome acessível")
  await page.waitForFunction(
    () => [...document.querySelectorAll("input")].some((el) => (el as HTMLInputElement).value === "Landing"),
    { timeout: 5_000 }
  )
  const editorPath = new URL(page.url()).pathname

  await open(page, "/configuracoes?tab=plugins")
  await page.waitForFunction(() => document.body.innerText.includes("Exportar CSV"), { timeout: 8_000 })
  const pluginsCopy = await page.evaluate(() => document.body.innerText)
  assert(pluginsCopy.includes("Exportar CSV"), "plugins exporta CSV")
  assert(!pluginsCopy.includes("Ligar Relatórios") && !pluginsCopy.includes("Ligar Webhooks"), "plugins sem interruptor morto")

  await open(page, "/configuracoes")
  await clickNamed(page, "Notificações")
  await page.waitForFunction(() => document.body.innerText.includes("Ainda não disparam"), { timeout: 8_000 })
  const notifyCopy = await page.evaluate(() => document.body.innerText)
  assert(notifyCopy.includes("Ainda não disparam"), "notificações sem interruptor morto")
  assert(notifyCopy.includes("Em breve"), "notificações em breve")

  await open(page, "/conversas")
  await page.waitForSelector("h1", { timeout: 10_000 })
  const canSimulate = await page.evaluate(() => document.body.innerText.includes("Simular conversa"))
  if (canSimulate) {
    await clickNamed(page, "Simular conversa")
    await page.waitForFunction(() => document.body.innerText.includes("Simular lead"), { timeout: 8_000 })
    const draftOpen = await page.evaluate(() => {
      const el = document.querySelector("#chat-draft") as HTMLInputElement | null
      return Boolean(el && !el.disabled)
    })
    assert(draftOpen, "simular conversa deixa a caixa do lead aberta")
  } else {
    const inboxCopy = await page.evaluate(() => document.body.innerText)
    assert(
      inboxCopy.includes("Simular lead") ||
        inboxCopy.includes("Nada neste recorte") ||
        inboxCopy.includes("Escreve como o lead") ||
        inboxCopy.includes("A carregar as conversas"),
      "conversas vazias, filtro vazio ou simulação explícita"
    )
  }

  for (const viewport of VIEWPORTS) {
    await page.setViewport({ width: viewport.width, height: viewport.height })
    for (const route of ["/", "/analytics", "/leads", "/conversas", "/telegram", "/configuracoes", "/fluxo", editorPath, "/l", "/privacidade"] as const) {
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
