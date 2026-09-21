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

const ROUTES = ["/", "/analytics", "/fluxo", "/leads", "/conversas", "/telegram", "/utilizadores", "/configuracoes"] as const

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

async function fillField(page: Page, selector: string, value: string) {
  await page.waitForSelector(selector, { timeout: 5_000 })
  await page.$eval(selector, (el) => {
    const input = el as HTMLTextAreaElement | HTMLInputElement
    input.focus()
    if ("select" in input) input.select()
  })
  await page.keyboard.type(value, { delay: 15 })
  await page.waitForFunction(
    (sel, expected) => (document.querySelector(sel) as HTMLTextAreaElement | HTMLInputElement | null)?.value === expected,
    { timeout: 8_000 },
    selector,
    value
  )
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

async function createAuditFunnel(page: Page) {
  await page.waitForFunction(
    () => document.querySelectorAll("article").length > 0 || document.body.innerText.includes("Nenhum funil"),
    { timeout: 10_000 }
  )
  for (let attempt = 0; attempt < 8; attempt++) {
    const ready = await page.evaluate(() => {
      const marked = document.querySelector<HTMLButtonElement>("[data-new-funnel]")
      if (marked) return !marked.disabled
      return [...document.querySelectorAll("button")].some(
        (el) => (el.textContent || "").includes("Novo funil") && !(el as HTMLButtonElement).disabled
      )
    })
    if (ready) {
      const clicked = await page.evaluate(() => {
        const marked = document.querySelector<HTMLButtonElement>("[data-new-funnel]")
        const fallback = [...document.querySelectorAll("button")].find((el) => (el.textContent || "").includes("Novo funil"))
        const btn = marked ?? fallback
        btn?.click()
        return Boolean(btn)
      })
      assert(clicked, "não achei Novo funil")
      await page.waitForFunction(() => location.pathname.includes("/fluxo/funil/"), { timeout: 8_000 })
      return
    }
    const count = await page.$$eval("article", (els) => els.length)
    page.once("dialog", (dialog) => dialog.accept())
    const deleted = await page.evaluate(() => {
      const trash = [...document.querySelectorAll<HTMLButtonElement>('[aria-label="Excluir funil"]')].find((el) => !el.disabled)
      trash?.click()
      return Boolean(trash)
    })
    assert(deleted, "estúdio cheio e sem funil que se possa apagar")
    await page.waitForFunction((prev) => document.querySelectorAll("article").length < prev, { timeout: 8_000 }, count)
  }
  throw new Error("não criei o funil de auditoria")
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

  await open(page, "/Login")
  await waitAuthPage(page)
  assert(page.url().toLowerCase().includes("/login"), "/Login é o HTML público")
  assert(await page.$('form[action="/api/auth/login"]'), "/Login é o formulário do Worker")

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
  assert(await page.$('[data-toggle-password="password"]'), "login do Worker tem Mostrar senha")
  const authJs = await page.evaluate(() => [...document.scripts].some((item) => (item.src || "").includes("/auth.js")))
  assert(authJs, "login carrega /auth.js")
  await page.keyboard.press("Tab")
  const skipFocused = await page.evaluate(() => document.activeElement?.classList.contains("skip-link"))
  assert(skipFocused, "primeiro Tab foca o skip-link")
  await page.focus("#email")
  await page.keyboard.press("Tab")
  const afterEmail = await page.evaluate(() => document.activeElement?.id || document.activeElement?.getAttribute("aria-label") || "")
  assert(afterEmail === "password" || afterEmail === "Mostrar senha", "Tab do e-mail segue no campo da senha")
  await page.click('[data-toggle-password="password"]')
  assert((await page.$eval("#password", (el) => (el as HTMLInputElement).type)) === "text", "Mostrar senha revela o campo")
  await page.click('[data-toggle-password="password"]')
  assert((await page.$eval("#password", (el) => (el as HTMLInputElement).type)) === "password", "Ocultar senha volta a esconder")

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
  const forgotBlocked = await page.$eval("#email", (el) => {
    const input = el as HTMLInputElement
    return !input.validity.valid
  })
  if (!forgotBlocked) await page.waitForSelector("#forgot-error", { timeout: 3_000 })
  assert(forgotBlocked || (await page.$("#forgot-error")), "forgot vazio mostra erro")

  await open(page, "/reset")
  await waitAuthPage(page)
  assert(page.url().includes("/reset"), "reset público sem sessão")
  const copy = await page.evaluate(() => document.body.innerText)
  assert(copy.includes("incompleto") || copy.includes("Gerar outro"), "reset sem token tem empty state")

  await open(page, "/privacidade")
  assert((await page.evaluate(() => document.body.innerText)).includes("privacidade"), "página de privacidade")

  await open(page, "/L")
  assert((await page.content()).includes("/t.js"), "/L traz o pixel no primeiro HTML")
  assert(await page.$(".skip-link"), "landing tem skip-link")

  await open(page, "/l")
  assert(await page.$("main#conteudo"), "landing tem o alvo do skip-link")
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
  assert(!(await page.$("[data-session-error]")), "sessão confirmada não mostra falha")

  await page.setOfflineMode(true)
  await page.waitForFunction(() => document.body.innerText.includes("Sem rede"), { timeout: 4_000 })
  await page.setOfflineMode(false)

  for (const route of ROUTES) {
    await open(page, route)
    assert(!page.url().includes("/login"), `${route} ficou autenticada`)
    await page.waitForSelector("h1", { timeout: 10_000 })
    assert(await page.$("main#conteudo"), `${route} tem o alvo do skip-link no main`)
  }

  await open(page, "/Leads")
  await page.waitForFunction(() => location.pathname === "/leads", { timeout: 10_000 })
  assert(page.url().includes("/leads"), "/Leads redirecciona para o CRM")
  await page.waitForSelector("h1", { timeout: 10_000 })
  assert(!(await page.$eval("h1", (el) => (el.textContent || "").includes("não encontrada"))), "/Leads não cai no 404")

  await open(page, "/")
  assert(
    Boolean(await page.$('a[href="/telegram#pixel"]')),
    "dashboard aponta para o snippet do ads"
  )
  await page.click('a[href="/telegram#pixel"]')
  await page.waitForSelector("#pixel", { timeout: 8_000 })
  assert(page.url().includes("/telegram#pixel") || page.url().includes("/telegram"), "Pixel Ads abre o Telegram")
  const pixelInView = await page.$eval("#pixel", (el) => {
    const box = el.getBoundingClientRect()
    return box.top < window.innerHeight && box.bottom > 0
  })
  assert(pixelInView, "Pixel Ads do dashboard faz scroll até #pixel")

  await open(page, "/telegram")
  await page.waitForSelector("#pixel", { timeout: 8_000 })
  const pixelCopy = await page.$eval("#pixel", (el) => el.textContent || "")
  assert(pixelCopy.includes("Manual") || pixelCopy.includes("scripts de página") || pixelCopy.includes("Instalar"), "pixel mostra o manual de instalação")
  assert(Boolean(await page.$("#page-script-name")), "pixel deixa criar script de outra página")
  assert(
    (await page.$eval("#page-script-name", (el) => (el as HTMLInputElement).disabled)) === false,
    "pixel com settings confirmadas deixa preencher o nome do script"
  )
  assert(pixelCopy.includes("www.abilion.lol/t.js"), "telegram mostra o snippet de produção")
  assert(pixelCopy.includes("data-abilion-cta"), "telegram pede o atributo no botão")
  const telegramCopy = await page.evaluate(() => document.body.innerText)
  assert(telegramCopy.includes("www.abilion.lol/l"), "telegram manda o anúncio para a landing")
  assert(!/Anúncio Facebook[:·\s]+https:\/\/t\.me/i.test(telegramCopy), "telegram não cola t.me como destino do ads")
  await open(page, "/configuracoes")
  await page.waitForSelector("#pixel", { timeout: 8_000 })
  assert(
    ((await page.$eval("#pixel", (el) => el.textContent || "")) || "").includes("www.abilion.lol/t.js"),
    "configurações mostra o snippet de produção"
  )
  const settingsCopy = await page.evaluate(() => document.body.innerText)
  assert(settingsCopy.includes("www.abilion.lol/l"), "configurações aponta o anúncio para a landing")
  assert(!/Anúncio Facebook[:·\s]+https:\/\/t\.me/i.test(settingsCopy), "configurações não cola t.me como destino do ads")

  const cookies = await page.cookies()
  await page.deleteCookie(...cookies.filter((item) => item.name === "abilion_session"))
  await page.evaluate(() => window.dispatchEvent(new Event("focus")))
  await page.waitForFunction(() => location.pathname.includes("/login"), { timeout: 8_000 })
  assert(page.url().includes("/login"), "cookie apagado volta ao login")
  await page.waitForSelector('form[action="/api/auth/login"]', { timeout: 8_000 })
  assert(await page.$('form[action="/api/auth/login"]'), "cookie apagado abre o login do Worker")
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

  await open(page, "/utilizadores")
  await page.waitForSelector("#user-password", { timeout: 8_000 })
  await page.waitForFunction(
    () =>
      !document.body.innerText.includes("A carregar as contas") && !document.body.innerText.includes("A carregar tokens"),
    { timeout: 8_000 }
  )
  const showInitial = await page.$("[aria-label='Mostrar senha inicial']")
  assert(showInitial, "criar conta mostra a senha")
  await showInitial!.click()
  const revealed = await page.$eval("#user-password", (el) => (el as HTMLInputElement).type)
  assert(revealed === "text", "toggle revela a senha inicial")

  await open(page, "/pagina-inexistente")
  await page.waitForFunction(
    () => document.body.innerText.includes("não encontrada") || document.body.innerText.includes("404"),
    { timeout: 8_000 }
  )
  await open(page, "/fluxo/funil/nao-existe")
  await page.waitForFunction(() => document.body.innerText.includes("Funil não encontrado"), { timeout: 10_000 })

  await open(page, "/leads")
  await clickNamed(page, "Importar lista")
  await page.waitForSelector("#lead-import-text", { timeout: 5_000 })
  assert(Boolean(await page.$("#lead-import-group")), "import deixa mandar a lista para o grupo")
  await page.keyboard.press("Escape")
  await page.waitForFunction(() => !document.querySelector("#lead-import-text"), { timeout: 5_000 })
  await clickNamed(page, "Nova captura")
  await page.waitForSelector("#lead-name", { timeout: 5_000 })
  assert(Boolean(await page.$("#lead-category")), "captura deixa escolher categoria")
  assert(Boolean(await page.$("#lead-category-new")), "captura deixa criar categoria")
  assert(
    (await page.$eval("#lead-category-new", (el) => (el as HTMLInputElement).disabled)) === false,
    "captura com settings confirmadas deixa criar categoria"
  )
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
  await page.waitForSelector(`[data-lead-name="${auditName}"]`, { timeout: 5_000 })
  await page.click(`[data-lead-name="${auditName}"]`)
  await page.waitForSelector("#lead-memory", { timeout: 5_000 })
  const closeBackdrop = await page.evaluate(() => Boolean(document.querySelector("[aria-label='Fechar ficha do lead']")))
  assert(closeBackdrop, "fundo da ficha do lead fecha com teclado")
  await fillField(page, "#lead-memory", "memoria isolada")
  await page.waitForFunction(
    () => (document.querySelector("#lead-memory") as HTMLTextAreaElement | null)?.value.includes("memoria isolada"),
    { timeout: 5_000 }
  )
  const closed = await page.evaluate(() => {
    const el = document.querySelector<HTMLButtonElement>("[data-lead-close]")
    el?.click()
    return Boolean(el)
  })
  assert(closed, "botão Fechar do lead")
  await page.waitForFunction(() => !document.querySelector("#lead-memory"), { timeout: 5_000 })
  await page.waitForSelector(`[data-lead-name="${auditName}"]`, { timeout: 5_000 })
  await page.click(`[data-lead-name="${auditName}"]`)
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
  await createAuditFunnel(page)
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
  const newFunnelGate = await page.$eval("[data-new-funnel]", (el) => ({
    disabled: (el as HTMLButtonElement).disabled,
    title: (el as HTMLButtonElement).title || "",
  }))
  assert(
    !newFunnelGate.disabled || newFunnelGate.title.includes("máximo"),
    "fluxo com CRM confirmado não bloqueia criar por lista oca"
  )
  const funnelScript = await page.$("[data-funnel-script]")
  if (funnelScript) {
    assert(
      (await funnelScript.evaluate((el) => (el as HTMLButtonElement).disabled)) === false,
      "fluxo com settings confirmadas deixa criar script do quadro"
    )
  }
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
  await clickNamed(page, "Voltar")
  await page.waitForFunction(() => location.pathname === "/fluxo" || location.pathname.endsWith("/fluxo"), { timeout: 8_000 })
  page.once("dialog", (dialog) => dialog.accept())
  await page.evaluate(() => {
    const article = [...document.querySelectorAll("article")].find(
      (el) => (el.textContent || "").includes("Novo funil") && (el.textContent || "").includes("Rascunho")
    )
    article?.querySelector<HTMLButtonElement>('[aria-label="Excluir funil"]')?.click()
  })

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
    for (const route of ["/", "/analytics", "/leads", "/conversas", "/telegram", "/utilizadores", "/configuracoes", "/fluxo", editorPath, "/l", "/privacidade"] as const) {
      await open(page, route)
      const box = await overflow(page)
      assert(!box.overflow, `overflow ${viewport.name}px em ${route} (${box.scrollWidth}>${box.clientWidth})`)
    }
  }

  await page.setViewport({ width: 1440, height: 900 })
  await open(page, "/")
  await page.waitForSelector('button[aria-label="Sair"]', { timeout: 10_000, visible: true })
  await page.click('button[aria-label="Sair"]')
  await page.waitForFunction(() => location.pathname.includes("/login"), { timeout: 10_000 })
  await page.waitForSelector('form[action="/api/auth/login"]', { timeout: 8_000 })
  assert(await page.$('form[action="/api/auth/login"]'), "Sair abre o login do Worker")

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
