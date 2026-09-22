import { clipHash } from "../src/lib/ste-voice.ts"
import type { AudioAsset, AudioJob, AudioRemoteFile } from "../src/lib/platform.ts"
import type { KvLike } from "./kv.ts"
import { synthesizeClip, uploadTelegramMedia } from "./ste-voice.ts"
import { telegramCall } from "./telegram.ts"

export const AUDIO_ASSETS = "platform:audio-assets"
export const AUDIO_JOBS = "platform:audio-jobs"
const ASSET_CAP = 1000
const JOB_CAP = 2000

export type StoredAudioAsset = AudioAsset & {
  audioB64: string
  remoteFiles: AudioRemoteFile[]
}

export type StoredAudioJob = AudioJob & {
  chatId?: string
  nodeId?: string
}

function bytesToB64(bytes: Uint8Array) {
  let binary = ""
  for (const value of bytes) binary += String.fromCharCode(value)
  return btoa(binary)
}

function b64ToBytes(value: string) {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index)
  return bytes
}

async function loadArray<T>(kv: KvLike, key: string): Promise<T[]> {
  const raw = await kv.get(key, "json")
  return Array.isArray(raw) ? (raw as T[]) : []
}

async function mergeById<T extends { id: string; updatedAt: string }>(
  kv: KvLike,
  key: string,
  incoming: T[],
  cap: number
) {
  for (let attempt = 0; attempt < 10; attempt++) {
    const current = await loadArray<T>(kv, key)
    const byId = new Map(current.map((item) => [item.id, item]))
    for (const item of incoming) {
      const prev = byId.get(item.id)
      byId.set(item.id, !prev || item.updatedAt >= prev.updatedAt ? { ...prev, ...item } : { ...item, ...prev })
    }
    const next = [...byId.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, cap)
    await kv.put(key, JSON.stringify(next))
    const stored = await loadArray<T>(kv, key)
    if (incoming.every((item) => stored.some((row) => row.id === item.id))) return stored
    await new Promise((resolve) => setTimeout(resolve, 4 * (attempt + 1)))
  }
  throw new Error(`Não confirmei ${key}.`)
}

export async function loadAudioAssets(kv: KvLike) {
  return loadArray<StoredAudioAsset>(kv, AUDIO_ASSETS)
}

export async function loadAudioJobs(kv: KvLike) {
  return loadArray<StoredAudioJob>(kv, AUDIO_JOBS)
}

export function publicAudioAsset(asset: StoredAudioAsset): AudioAsset & { remoteFiles: AudioRemoteFile[] } {
  const { audioB64: _bytes, ...safe } = asset
  return safe
}

export function publicAudioJob(job: StoredAudioJob): AudioJob {
  const { chatId: _chatId, nodeId: _nodeId, ...safe } = job
  return safe
}

export async function saveAudioJob(kv: KvLike, job: StoredAudioJob) {
  return mergeById(kv, AUDIO_JOBS, [job], JOB_CAP)
}

export async function ensureAudioAsset(
  kv: KvLike,
  input: {
    botId: string
    brainVersionId?: string
    flowVersionId?: string
    nodeId?: string
    voiceProfileId: string
    language: string
    text: string
    apiKey: string
  }
) {
  const text = input.text.trim().slice(0, 8_000)
  if (!text) throw new Error("O roteiro do áudio está vazio.")
  const textHash = clipHash(
    `${input.botId}\n${input.brainVersionId || ""}\n${input.flowVersionId || ""}\n${input.nodeId || ""}\n${input.language}\n${text}`,
    input.voiceProfileId
  )
  const id = `audio-${textHash}`
  const current = (await loadAudioAssets(kv)).find((item) => item.id === id)
  if (current?.audioB64) return current
  const now = new Date().toISOString()
  const generated = await synthesizeClip(input.apiKey, input.voiceProfileId, text)
  const asset: StoredAudioAsset = {
    id,
    botId: input.botId,
    brainVersionId: input.brainVersionId,
    flowVersionId: input.flowVersionId,
    nodeId: input.nodeId,
    voiceProfileId: input.voiceProfileId,
    language: input.language,
    textHash,
    text,
    mime: generated.mime,
    size: generated.bytes.byteLength,
    audioB64: bytesToB64(generated.bytes),
    remoteFiles: [],
    createdAt: now,
    updatedAt: now,
  }
  await mergeById(kv, AUDIO_ASSETS, [asset], ASSET_CAP)
  return asset
}

export async function sendAudioAsset(
  kv: KvLike,
  input: {
    asset: StoredAudioAsset
    token: string
    chatId: string
    integrationId: string
    externalBotId?: string
  }
) {
  const remote = input.asset.remoteFiles.find(
    (item) =>
      item.integrationId === input.integrationId &&
      (!input.externalBotId || !item.externalBotId || item.externalBotId === input.externalBotId)
  )
  const mime = input.asset.mime === "audio/mpeg" ? "audio/mpeg" : "audio/ogg"
  const method = mime === "audio/mpeg" ? "sendAudio" : "sendVoice"
  const field = mime === "audio/mpeg" ? "audio" : "voice"
  if (remote?.fileId) {
    const reused = await telegramCall(input.token, method, {
      chat_id: input.chatId,
      [field]: remote.fileId,
    })
    if (reused.ok) return { ok: true, fileId: remote.fileId, reused: true }
  }
  if (!input.asset.audioB64) return { ok: false, fileId: "", reused: false, errorCode: "audio_source_missing" }
  const bytes = b64ToBytes(input.asset.audioB64)
  const uploaded = await uploadTelegramMedia(
    input.token,
    method,
    input.chatId,
    field,
    bytes,
    mime,
    mime === "audio/mpeg" ? "abilion.mp3" : "abilion.ogg"
  )
  const fileId = uploaded.result?.voice?.file_id || uploaded.result?.audio?.file_id || ""
  if (!uploaded.ok || !fileId) {
    return { ok: false, fileId: "", reused: false, errorCode: "channel_rejected_audio" }
  }
  const updated: StoredAudioAsset = {
    ...input.asset,
    remoteFiles: [
      ...input.asset.remoteFiles.filter((item) => item.integrationId !== input.integrationId),
      {
        integrationId: input.integrationId,
        externalBotId: input.externalBotId,
        fileId,
        updatedAt: new Date().toISOString(),
      },
    ],
    updatedAt: new Date().toISOString(),
  }
  await mergeById(kv, AUDIO_ASSETS, [updated], ASSET_CAP)
  return { ok: true, fileId, reused: false }
}
