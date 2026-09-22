/**
 * Restaura exclusivamente um backup originado no KV de staging para o mesmo
 * namespace de staging. Produção e backups de produção são recusados.
 *
 *   npx tsx scripts/kv-restore.mts .data/backups/staging-....json
 *   npx tsx scripts/kv-restore.mts .data/backups/staging-....json --yes
 */
import { execFileSync } from "node:child_process"
import { readFileSync, unlinkSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"
import { parseBackupEnvelope } from "./kv-backup-lib.mts"

const STAGING_KV = "99b7a6f2ce764741a37a5a1330f90cf6"
const PRODUCTION_KV = "65f62e24942345e8b46904f6743575d0"
const filename = process.argv[2]
if (!filename) {
  console.error("uso: npx tsx scripts/kv-restore.mts <backup.json> [--yes]")
  process.exit(2)
}

const config = readFileSync("wrangler.staging.jsonc", "utf8")
const configured = /"kv_namespaces"[\s\S]*?"id":\s*"([a-f0-9]{32})"/.exec(config)?.[1]
if (configured !== STAGING_KV || configured === PRODUCTION_KV) {
  console.error("O destino não é o KV isolado de staging. Restauração recusada.")
  process.exit(1)
}

const backup = parseBackupEnvelope(JSON.parse(readFileSync(resolve(filename), "utf8")))
if (backup.source !== "staging" || backup.namespaceId !== STAGING_KV) {
  console.error("Só backups do mesmo namespace de staging podem ser restaurados. PII de produção não entra em staging.")
  process.exit(1)
}

console.log(`Restauração validada: ${backup.items.length} chaves operacionais para staging.`)
if (!process.argv.includes("--yes")) {
  console.log("Modo de verificação. Repete com --yes para gravar.")
  process.exit(0)
}

const batch = resolve("/tmp", `abilion-staging-restore-${Date.now()}.json`)
writeFileSync(batch, JSON.stringify(backup.items))
try {
  execFileSync(
    "npx",
    ["wrangler", "kv", "bulk", "put", batch, "--namespace-id", STAGING_KV, "--remote"],
    { stdio: "inherit" }
  )
} finally {
  try {
    unlinkSync(batch)
  } catch {
    /* o ficheiro temporário já não existe */
  }
}
console.log("Backup operacional restaurado em staging. Auth e segredos não foram alterados.")
