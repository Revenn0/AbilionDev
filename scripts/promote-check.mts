/**
 * Diz se o HEAD actual está pronto para o Victor abrir o PR staging → main.
 * Não publica produção. Não abre o PR.
 *
 *   npx tsx scripts/promote-check.mts
 */
import { execFileSync } from "node:child_process"

const STAGING = "https://staging.abilion.lol"

function git(...params: string[]) {
  return execFileSync("git", params, { encoding: "utf8" }).trim()
}

function fail(message: string): never {
  console.error(`\n✘ ${message}\n`)
  process.exit(1)
}

const sha = git("rev-parse", "HEAD").toLowerCase()
const shortSha = sha.slice(0, 12)
const branch = git("rev-parse", "--abbrev-ref", "HEAD")
const dirty = git("status", "--porcelain")
const headTree = git("rev-parse", "HEAD^{tree}")

console.log(`Branch: ${branch}\nCommit: ${sha}\nÁrvore: ${headTree}`)

if (dirty) fail("A árvore tem alterações por gravar. Faz commit antes de pedir aprovação.")

let health: { ok?: boolean; env?: string; version?: string }
try {
  const res = await fetch(`${STAGING}/api/health`, { signal: AbortSignal.timeout(15_000) })
  if (!res.ok) fail(`staging /api/health respondeu ${res.status}`)
  health = (await res.json()) as typeof health
} catch (error) {
  fail(`Não li ${STAGING}/api/health: ${error instanceof Error ? error.message : String(error)}`)
}

if (!health.ok) fail(`staging /api/health não está ok: ${JSON.stringify(health)}`)
if (health.env && health.env !== "staging") fail(`staging.abilion.lol diz env=${health.env}`)
if (!health.version) fail("staging não devolve version — publica outra vez com npm run deploy:staging")

let stagingTree = ""
try {
  execFileSync("git", ["cat-file", "-e", `${health.version}^{commit}`], { stdio: "ignore" })
  stagingTree = git("rev-parse", `${health.version}^{tree}`)
} catch {
  fail(`Staging serve ${health.version}, mas esse commit não está neste checkout. git fetch origin staging`)
}

if (stagingTree !== headTree) {
  fail(
    `Staging serve ${health.version} e o HEAD é ${shortSha} com outra árvore. Publica este commit em staging, testa, e só depois pede o PR.`
  )
}

console.log(`\n✔ Staging serve a mesma árvore (${health.version}).`)
console.log("Checklist antes de abrir o PR staging → main:")
console.log("  [ ] Login, dashboard, leads, fluxo, /l e /start no bot de staging")
console.log("  [ ] GET /api/health com env=staging e este version")
console.log("  [ ] Prints no PR")
console.log(`\nDepois do merge no main:\n  npm run deploy:prod -- --approved ${shortSha}`)
