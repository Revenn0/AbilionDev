/**
 * Backup operacional do KV. Não exporta contas, sessões, tokens, throttles ou
 * locks. Valores nunca são escritos no terminal; o JSON fica em `.data/`.
 *
 *   npx tsx scripts/kv-backup.mts staging
 *   npx tsx scripts/kv-backup.mts production --yes
 */
import { execFileSync } from "node:child_process"
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"
import {
  makeBackupEnvelope,
  selectOperationalBackupKeys,
  type BackupEnvironment,
  type KvBackupItem,
} from "./kv-backup-lib.mts"

const target = process.argv[2] as BackupEnvironment
if (target !== "staging" && target !== "production") {
  console.error("uso: npx tsx scripts/kv-backup.mts <staging|production> [--yes]")
  process.exit(2)
}
if (target === "production" && !process.argv.includes("--yes")) {
  console.error("O backup de produção contém dados pessoais. Repete com --yes para confirmar a cópia local ignorada pelo git.")
  process.exit(1)
}

const configPath = target === "production" ? "wrangler.jsonc" : "wrangler.staging.jsonc"
const config = readFileSync(configPath, "utf8")
const namespaceId = /"kv_namespaces"[\s\S]*?"id":\s*"([a-f0-9]{32})"/.exec(config)?.[1] || ""
if (!namespaceId) {
  console.error(`Não encontrei o namespace KV em ${configPath}.`)
  process.exit(1)
}

function wrangler(params: string[]) {
  return execFileSync("npx", ["wrangler", ...params], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  })
}

const listed = wrangler(["kv", "key", "list", "--namespace-id", namespaceId, "--remote"])
const start = listed.indexOf("[")
if (start < 0) throw new Error("O Wrangler não devolveu a lista de chaves.")
const names = (JSON.parse(listed.slice(start)) as Array<{ name?: unknown }>)
  .map((item) => (typeof item.name === "string" ? item.name : ""))
const keys = selectOperationalBackupKeys(names)
const items: KvBackupItem[] = []
for (const key of keys) {
  const value = wrangler(["kv", "key", "get", key, "--namespace-id", namespaceId, "--remote", "--text"])
  items.push({ key, value })
}

const envelope = makeBackupEnvelope(target, namespaceId, items)
const stamp = envelope.createdAt.replace(/[:.]/g, "-")
const folder = resolve(".data", "backups")
const file = resolve(folder, `${target}-${stamp}.json`)
mkdirSync(folder, { recursive: true })
writeFileSync(file, JSON.stringify(envelope))

console.log(`Backup ${target}: ${envelope.items.length} chaves operacionais em ${file}.`)
console.log("Contas, sessões, tokens, segredos, throttles e locks não foram exportados.")
