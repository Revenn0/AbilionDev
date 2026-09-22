export const KV_BACKUP_FORMAT = "abilion-kv-backup-v1" as const

export type BackupEnvironment = "staging" | "production"

export type KvBackupItem = {
  key: string
  value: string
}

export type KvBackupEnvelope = {
  format: typeof KV_BACKUP_FORMAT
  source: BackupEnvironment
  namespaceId: string
  createdAt: string
  items: KvBackupItem[]
}

const EXCLUDED_KEYS = new Set([
  "snapshot",
  "runtime:secrets",
  "track:throttles",
  "crm:cron-lock",
  "tg:updates",
])

/**
 * O backup operacional não leva autenticação, tokens, throttles nem locks.
 * Tombstones, aliases, leads, funis, definições, pixel e assets de voz ficam:
 * são necessários para uma restauração que não ressuscite dados removidos.
 */
export function isOperationalBackupKey(key: string) {
  const name = key.trim()
  if (!name || EXCLUDED_KEYS.has(name)) return false
  return (
    name.startsWith("crm:") ||
    name === "track:events" ||
    name === "voice:clips" ||
    name.startsWith("voice:asset:")
  )
}

export function selectOperationalBackupKeys(keys: string[]) {
  return [...new Set(keys.map((key) => key.trim()).filter(isOperationalBackupKey))].sort()
}

export function makeBackupEnvelope(
  source: BackupEnvironment,
  namespaceId: string,
  items: KvBackupItem[],
  createdAt = new Date().toISOString()
): KvBackupEnvelope {
  const unique = new Map<string, string>()
  for (const item of items) {
    const key = item.key.trim()
    if (!isOperationalBackupKey(key)) continue
    unique.set(key, item.value)
  }
  return {
    format: KV_BACKUP_FORMAT,
    source,
    namespaceId: namespaceId.trim(),
    createdAt,
    items: [...unique].sort(([left], [right]) => left.localeCompare(right)).map(([key, value]) => ({ key, value })),
  }
}

export function parseBackupEnvelope(raw: unknown): KvBackupEnvelope {
  if (!raw || typeof raw !== "object") throw new Error("Backup inválido.")
  const row = raw as Partial<KvBackupEnvelope>
  if (row.format !== KV_BACKUP_FORMAT) throw new Error("Formato de backup não suportado.")
  if (row.source !== "staging" && row.source !== "production") throw new Error("Ambiente do backup inválido.")
  if (typeof row.namespaceId !== "string" || !/^[a-f0-9]{32}$/.test(row.namespaceId)) {
    throw new Error("Namespace do backup inválido.")
  }
  if (typeof row.createdAt !== "string" || !Number.isFinite(new Date(row.createdAt).getTime())) {
    throw new Error("Data do backup inválida.")
  }
  if (!Array.isArray(row.items)) throw new Error("Itens do backup inválidos.")
  for (const item of row.items) {
    if (!item || typeof item.key !== "string" || typeof item.value !== "string" || !isOperationalBackupKey(item.key)) {
      throw new Error("O backup contém uma chave inválida ou sensível.")
    }
  }
  return makeBackupEnvelope(row.source, row.namespaceId, row.items, row.createdAt)
}
