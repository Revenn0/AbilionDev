/**
 * Deploy com guardas: staging recebe qualquer branch; produção só recebe `main`
 * com um commit aprovado que já esteve no ar em staging.
 *
 *   npx tsx scripts/deploy.mts staging
 *   npx tsx scripts/deploy.mts production --approved <commit>
 *
 * Flags:
 *   --approved <sha>        obrigatório em produção; tem de ser o HEAD actual
 *   --skip-staging-check    produção: não exige que staging esteja a servir esta árvore (avisa)
 *   --skip-smoke            não corre o smoke depois do deploy
 *   --url <https://host>    troca o URL usado no smoke e na leitura do staging
 *   --ci                    lê o branch de GITHUB_REF_NAME (checkout em detached HEAD)
 *
 * O commit vai para o Worker como `GIT_SHA` e sai em GET /api/health (`version`).
 */
import { execFileSync } from "node:child_process"

type Target = "staging" | "production"

const TARGETS: Record<Target, { config: string; url: string; branch: string | null; label: string }> = {
  staging: { config: "wrangler.staging.jsonc", url: "https://staging.abilion.lol", branch: null, label: "staging" },
  production: { config: "wrangler.jsonc", url: "https://www.abilion.lol", branch: "main", label: "produção" },
}
const STAGING_URL = TARGETS.staging.url

const args = process.argv.slice(2)
const target = args[0] as Target
const has = (name: string) => args.includes(name)
const flag = (name: string) => {
  const index = args.indexOf(name)
  return index >= 0 ? (args[index + 1] || "").trim() : ""
}

function fail(message: string): never {
  console.error(`\n✘ ${message}\n`)
  process.exit(1)
}

function git(...params: string[]) {
  return execFileSync("git", params, { encoding: "utf8" }).trim()
}

function run(command: string, params: string[]) {
  console.log(`\n$ ${command} ${params.join(" ")}`)
  execFileSync(command, params, { stdio: "inherit", env: process.env })
}

if (!target || !(target in TARGETS)) {
  console.error("uso: npx tsx scripts/deploy.mts <staging|production> [--approved <sha>] [--skip-smoke] [--skip-staging-check] [--url <https://host>] [--ci]")
  process.exit(2)
}

const spec = TARGETS[target]
const url = (flag("--url") || spec.url).replace(/\/$/, "")
const sha = git("rev-parse", "HEAD").toLowerCase()
const shortSha = sha.slice(0, 12)
const branch = has("--ci") && process.env.GITHUB_REF_NAME ? process.env.GITHUB_REF_NAME : git("rev-parse", "--abbrev-ref", "HEAD")
const dirty = git("status", "--porcelain")

console.log(`Ambiente: ${spec.label}\nBranch:   ${branch}\nCommit:   ${sha}\nURL:      ${url}`)

if (dirty) {
  fail("A árvore tem alterações por gravar. Faz commit (ou stash) antes de publicar — o que sobe tem de ser um commit.")
}

if (target === "production") {
  if (branch !== spec.branch) {
    fail(`Produção só sobe a partir de \`${spec.branch}\`. Estás em \`${branch}\`. Abre o PR staging → main, aprova, faz merge e publica a partir do main.`)
  }
  const approved = flag("--approved").toLowerCase()
  if (!/^[a-f0-9]{7,40}$/.test(approved)) {
    fail("Produção exige `--approved <commit>` — o hash que testaste em staging e aprovaste no PR.")
  }
  if (!sha.startsWith(approved)) {
    fail(`O commit aprovado (${approved}) não é o HEAD do main (${shortSha}). Publica exactamente o que foi aprovado.`)
  }
  if (!has("--skip-staging-check")) {
    const staging = await readRelease(STAGING_URL)
    if (!staging.version) {
      fail(`Não li a versão em staging (${STAGING_URL}/api/health). Publica em staging primeiro ou passa --skip-staging-check com consciência.`)
    }
    const stagingTree = treeOf(staging.version)
    const headTree = git("rev-parse", "HEAD^{tree}")
    if (!stagingTree) {
      fail(`Staging está a servir ${staging.version}, mas esse commit não existe neste checkout. Corre \`git fetch origin staging\` e repete.`)
    }
    if (stagingTree !== headTree) {
      fail(
        `Staging está a servir ${staging.version} e o main aponta para ${shortSha} com uma árvore diferente. Só sobe a produção o que já está em staging — publica em staging outra vez e testa.`
      )
    }
    console.log(`Staging serve ${staging.version} com a mesma árvore do main. Promoção válida.`)
  } else {
    console.warn("⚠ --skip-staging-check: a publicar em produção sem confirmar que staging serviu esta árvore.")
  }
}

run("npm", ["run", "build"])
run("npx", ["wrangler", "deploy", "--config", spec.config, "--keep-vars", "--var", `GIT_SHA:${sha}`])

if (!has("--skip-smoke")) {
  run("npx", ["tsx", "scripts/smoke.mts", url, "--env", target, "--sha", shortSha])
}

console.log(`\n✔ ${spec.label} está a servir ${shortSha} em ${url}`)
if (target === "staging") {
  console.log("Próximo passo: testa em staging, abre o PR staging → main e aprova. Produção sobe com:\n  npm run deploy:prod -- --approved " + shortSha)
}

async function readRelease(base: string): Promise<{ version?: string; env?: string }> {
  try {
    const res = await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(15_000) })
    if (!res.ok) return {}
    return (await res.json()) as { version?: string; env?: string }
  } catch {
    return {}
  }
}

function treeOf(commit: string) {
  try {
    execFileSync("git", ["cat-file", "-e", `${commit}^{commit}`], { stdio: "ignore" })
  } catch {
    try {
      execFileSync("git", ["fetch", "--quiet", "origin", "staging"], { stdio: "ignore" })
      execFileSync("git", ["cat-file", "-e", `${commit}^{commit}`], { stdio: "ignore" })
    } catch {
      return ""
    }
  }
  return git("rev-parse", `${commit}^{tree}`)
}
