/**
 * Limpa o KV de staging para começar um teste do zero.
 *
 *   npx tsx scripts/staging-reset.mts          # só conta as chaves
 *   npx tsx scripts/staging-reset.mts --yes    # apaga
 *
 * Recusa correr contra o KV de produção: o id de staging está fixo aqui
 * e tem de bater com o `wrangler.staging.jsonc`.
 */
import { execFileSync } from "node:child_process"
import { readFileSync, writeFileSync } from "node:fs"

const STAGING_KV = "99b7a6f2ce764741a37a5a1330f90cf6"
const PRODUCTION_KV = "65f62e24942345e8b46904f6743575d0"

const config = readFileSync("wrangler.staging.jsonc", "utf8")
const configured = /"kv_namespaces"[\s\S]*?"id":\s*"([a-f0-9]{32})"/.exec(config)?.[1]
if (configured !== STAGING_KV || configured === PRODUCTION_KV) {
  console.error(`wrangler.staging.jsonc aponta para ${configured ?? "—"}, não para o KV de staging (${STAGING_KV}). Não limpo.`)
  process.exit(1)
}

const listed = execFileSync("npx", ["wrangler", "kv", "key", "list", "--namespace-id", STAGING_KV], { encoding: "utf8" })
const keys = (JSON.parse(listed.slice(listed.indexOf("["))) as Array<{ name: string }>).map((item) => item.name)
console.log(`${keys.length} chaves no KV de staging (${STAGING_KV}).`)
if (!keys.length) process.exit(0)
if (!process.argv.includes("--yes")) {
  console.log("Passa --yes para apagar. Produção não é tocada por este script.")
  process.exit(0)
}
const file = "/tmp/abilion-staging-keys.json"
writeFileSync(file, JSON.stringify(keys))
execFileSync("npx", ["wrangler", "kv", "bulk", "delete", file, "--namespace-id", STAGING_KV, "--force"], { stdio: "inherit" })
console.log("KV de staging limpo. O próximo login volta a definir a senha dos operadores.")
