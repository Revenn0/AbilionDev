/**
 * Smoke test de um ambiente no ar.
 *
 *   npx tsx scripts/smoke.mts https://staging.abilion.lol --env staging --sha <commit>
 *
 * Bate nas rotas públicas, confere headers de segurança e, com `--sha`,
 * espera até o `/api/health` reportar esse commit (propagação do deploy).
 * Sai com código 1 se algo falhar — o deploy e o CI usam este exit code.
 */

type Check = { name: string; ok: boolean; detail?: string }

const args = process.argv.slice(2)
const base = (args.find((item) => /^https?:\/\//.test(item)) || "").replace(/\/$/, "")
const flag = (name: string) => {
  const index = args.indexOf(name)
  return index >= 0 ? (args[index + 1] || "").trim() : ""
}
const expectedSha = flag("--sha").toLowerCase()
const expectedEnv = flag("--env")
const timeoutMs = Number(flag("--timeout") || 120_000)

if (!base) {
  console.error("uso: npx tsx scripts/smoke.mts <https://host> [--env staging|production] [--sha <commit>] [--timeout ms]")
  process.exit(2)
}

const checks: Check[] = []
const record = (name: string, ok: boolean, detail?: string) => {
  checks.push({ name, ok, detail })
  console.log(`${ok ? "ok " : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`)
}

async function get(path: string, init?: RequestInit) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 15_000)
  try {
    return await fetch(`${base}${path}`, { ...init, redirect: "manual", signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

async function waitForRelease() {
  const started = Date.now()
  let last: { env?: string; version?: string; ok?: boolean } = {}
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await get("/api/health")
      if (res.status === 200) {
        last = (await res.json()) as typeof last
        const shaOk = !expectedSha || (last.version || "").startsWith(expectedSha) || expectedSha.startsWith(last.version || "\u0000")
        const envOk = !expectedEnv || last.env === expectedEnv
        if (last.ok && shaOk && envOk) return last
      }
    } catch {
      /* ainda a propagar */
    }
    await new Promise((resolve) => setTimeout(resolve, 3000))
  }
  return last
}

const health = await waitForRelease()
record("GET /api/health responde ok", health.ok === true, JSON.stringify(health))
if (expectedEnv) record(`health diz env=${expectedEnv}`, health.env === expectedEnv, `env=${health.env ?? "—"}`)
if (expectedSha) {
  const version = health.version || ""
  record(`health diz version=${expectedSha}`, version.startsWith(expectedSha) || expectedSha.startsWith(version || "\u0000"), `version=${version || "—"}`)
}

try {
  const home = await get("/")
  record("GET / responde 200", home.status === 200, `status ${home.status}`)
  record("GET / manda CSP", Boolean(home.headers.get("content-security-policy")))
  record("GET / manda X-Frame-Options ou frame-ancestors", Boolean(home.headers.get("x-frame-options")) || (home.headers.get("content-security-policy") || "").includes("frame-ancestors"))

  const login = await get("/login")
  record("GET /login responde 200", login.status === 200, `status ${login.status}`)

  const landing = await get("/l")
  const landingHtml = landing.status === 200 ? await landing.text() : ""
  record("GET /l responde 200 com o pixel", landing.status === 200 && landingHtml.includes("/t.js"), `status ${landing.status}`)

  const tracker = await get("/t.js")
  const trackerJs = tracker.status === 200 ? await tracker.text() : ""
  record("GET /t.js responde 200", tracker.status === 200 && trackerJs.includes("/api/track"), `status ${tracker.status}`)

  const install = await get("/api/install")
  const installBody = install.status === 200 ? ((await install.json()) as { ok?: boolean; steps?: unknown[] }) : {}
  record("GET /api/install é o manual", install.status === 200 && installBody.ok === true && (installBody.steps?.length ?? 0) >= 5, `status ${install.status}`)

  const mcp = await get("/mcp")
  record("GET /mcp responde 200", mcp.status === 200, `status ${mcp.status}`)

  const crm = await get("/api/crm")
  record("GET /api/crm sem sessão é 401", crm.status === 401, `status ${crm.status}`)

  const leads = await get("/api/leads")
  record("GET /api/leads sem sessão é 401", leads.status === 401, `status ${leads.status}`)

  const cron = await get("/api/cron")
  record("GET /api/cron sem secret é 401", cron.status === 401, `status ${cron.status}`)

  const hook = await get("/api/telegram", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" })
  record("POST /api/telegram sem secret não é 200", hook.status === 401 || hook.status === 503, `status ${hook.status}`)
} catch (error) {
  record("rede", false, error instanceof Error ? error.message : String(error))
}

const failed = checks.filter((item) => !item.ok)
console.log(`\n${checks.length - failed.length}/${checks.length} verificações ok em ${base}`)
if (failed.length) {
  console.error(`smoke falhou: ${failed.map((item) => item.name).join("; ")}`)
  process.exit(1)
}
console.log("smoke ok")
