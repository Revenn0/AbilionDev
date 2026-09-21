/**
 * Confere (e, com --put-cron, cria) os secrets do Worker de staging.
 *
 *   npx tsx scripts/staging-secrets.mts
 *   npx tsx scripts/staging-secrets.mts --put-cron
 *
 * Não toca nos secrets de produção. Não cria o bot do Telegram —
 * isso só o @BotFather faz.
 */
import { execFileSync } from "node:child_process"
import { randomBytes } from "node:crypto"
import { readFileSync } from "node:fs"

const STAGING_WORKER = "abilion-staging"
const PRODUCTION_WORKER = "abilion"
const putCron = process.argv.includes("--put-cron")

function fail(message: string): never {
  console.error(`\n✘ ${message}\n`)
  process.exit(1)
}

const config = readFileSync("wrangler.staging.jsonc", "utf8")
if (/"name"\s*:\s*"abilion"/.test(config) && !/"name"\s*:\s*"abilion-staging"/.test(config)) {
  fail("wrangler.staging.jsonc aponta para o Worker de produção. Não mexo nos secrets.")
}
if (/"SUPABASE_URL"\s*:/.test(config)) {
  fail("wrangler.staging.jsonc tem SUPABASE_URL. Staging não aponta ao Postgres de produção.")
}

function secretList(configFile: string): string[] {
  const raw = execFileSync("npx", ["wrangler", "secret", "list", "--config", configFile], { encoding: "utf8" })
  const start = raw.indexOf("[")
  if (start < 0) return []
  return (JSON.parse(raw.slice(start)) as Array<{ name?: string }>).map((item) => item.name || "").filter(Boolean)
}

const staging = secretList("wrangler.staging.jsonc")
const production = secretList("wrangler.jsonc")

console.log(`Worker ${STAGING_WORKER}: ${staging.length ? staging.join(", ") : "(nenhum secret)"}`)
console.log(`Worker ${PRODUCTION_WORKER}: ${production.length ? production.join(", ") : "(nenhum secret)"}`)

if (putCron && !staging.includes("CRON_SECRET")) {
  const value = randomBytes(32).toString("hex")
  execFileSync("npx", ["wrangler", "secret", "put", "CRON_SECRET", "--config", "wrangler.staging.jsonc"], {
    input: value,
    stdio: ["pipe", "inherit", "inherit"],
  })
  console.log("✔ CRON_SECRET gravado no Worker de staging (não reutiliza o de produção).")
} else if (putCron) {
  console.log("CRON_SECRET já existe em staging — não reescrevo.")
}

const after = putCron ? secretList("wrangler.staging.jsonc") : staging
const leftover: string[] = []
if (!after.includes("CRON_SECRET")) leftover.push("CRON_SECRET — corre npm run staging:secrets -- --put-cron")
leftover.push("bot Telegram de staging — cria no @BotFather e vincula em staging.abilion.lol → Configurações")
leftover.push("CLOUDFLARE_API_TOKEN e CLOUDFLARE_ACCOUNT_ID no Depot, quando o app estiver ligado")

console.log("\nAinda por ti:")
for (const item of leftover) console.log(`  • ${item}`)
