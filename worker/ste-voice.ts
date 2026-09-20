import { clipHash, STE_VOICE_CLIPS, type SteVoiceClip } from "../src/lib/ste-voice.ts"
import type { KvLike } from "./kv.ts"
import { telegramCall } from "./telegram.ts"

export const VOICE_STORE_KEY = "voice:clips"
export const ELEVEN_MODEL = "eleven_multilingual_v2"

export type StoredVoiceClip = {
  id: string
  hash: string
  voiceId: string
  mime: "audio/ogg" | "audio/mpeg"
  fileId?: string
  audioB64?: string
  updatedAt: string
}

export type VoiceClipStatus = {
  id: string
  label: string
  ready: boolean
}

type TelegramMedia = {
  ok?: boolean
  description?: string
  result?: { voice?: { file_id?: string }; audio?: { file_id?: string } }
}

export async function loadVoiceStore(kv: KvLike): Promise<Record<string, StoredVoiceClip>> {
  const raw = await kv.get(VOICE_STORE_KEY, "json")
  if (!raw || typeof raw !== "object") return {}
  return raw as Record<string, StoredVoiceClip>
}

export async function saveVoiceStore(kv: KvLike, store: Record<string, StoredVoiceClip>) {
  await kv.put(VOICE_STORE_KEY, JSON.stringify(store))
}

export function voiceClipStatus(store: Record<string, StoredVoiceClip>, voiceId: string): VoiceClipStatus[] {
  return STE_VOICE_CLIPS.map((clip) => {
    const saved = store[clip.id]
    const hash = clipHash(clip.script, voiceId)
    return {
      id: clip.id,
      label: clip.label,
      ready: Boolean(saved && saved.hash === hash && saved.voiceId === voiceId && (saved.fileId || saved.audioB64)),
    }
  })
}

export async function synthesizeClip(apiKey: string, voiceId: string, script: string) {
  const opus = await elevenLabs(apiKey, voiceId, script, "opus_48000_64", "audio/ogg")
  if (opus) return { ...opus, mime: "audio/ogg" as const, filename: `${Date.now()}.ogg`, method: "sendVoice" as const }
  const mp3 = await elevenLabs(apiKey, voiceId, script, "mp3_44100_128", "audio/mpeg")
  if (mp3) return { ...mp3, mime: "audio/mpeg" as const, filename: `${Date.now()}.mp3`, method: "sendAudio" as const }
  throw new Error("ElevenLabs não gerou o áudio. Confere a chave e o voice id.")
}

async function elevenLabs(apiKey: string, voiceId: string, text: string, output: string, accept: string) {
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=${output}`, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "content-type": "application/json",
      accept,
    },
    body: JSON.stringify({
      text,
      model_id: ELEVEN_MODEL,
      voice_settings: {
        stability: 0.42,
        similarity_boost: 0.82,
        style: 0.18,
        use_speaker_boost: true,
      },
    }),
  })
  if (!res.ok) return null
  const bytes = new Uint8Array(await res.arrayBuffer())
  return bytes.length ? { bytes } : null
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

export async function ensureVoiceClip(kv: KvLike, clip: SteVoiceClip, apiKey: string, voiceId: string) {
  const store = await loadVoiceStore(kv)
  const hash = clipHash(clip.script, voiceId)
  const saved = store[clip.id]
  if (saved && saved.hash === hash && saved.voiceId === voiceId && (saved.fileId || saved.audioB64)) {
    return saved
  }
  const audio = await synthesizeClip(apiKey, voiceId, clip.script)
  const next: StoredVoiceClip = {
    id: clip.id,
    hash,
    voiceId,
    mime: audio.mime,
    audioB64: bytesToB64(audio.bytes),
    updatedAt: new Date().toISOString(),
  }
  store[clip.id] = next
  await saveVoiceStore(kv, store)
  return next
}

export async function prepareVoiceClips(kv: KvLike, apiKey: string, voiceId: string) {
  const results: VoiceClipStatus[] = []
  for (const clip of STE_VOICE_CLIPS) {
    try {
      await ensureVoiceClip(kv, clip, apiKey, voiceId)
      results.push({ id: clip.id, label: clip.label, ready: true })
    } catch {
      results.push({ id: clip.id, label: clip.label, ready: false })
    }
  }
  return results
}

export async function sendStoredVoice(token: string, chatId: string, stored: StoredVoiceClip) {
  if (stored.fileId) {
    const method = stored.mime === "audio/mpeg" ? "sendAudio" : "sendVoice"
    const field = stored.mime === "audio/mpeg" ? "audio" : "voice"
    const reused = await telegramCall(token, method, { chat_id: chatId, [field]: stored.fileId })
    if (reused.ok) return stored.fileId
  }
  if (!stored.audioB64) return ""
  const bytes = b64ToBytes(stored.audioB64)
  const method = stored.mime === "audio/mpeg" ? "sendAudio" : "sendVoice"
  const field = stored.mime === "audio/mpeg" ? "audio" : "voice"
  const filename = stored.mime === "audio/mpeg" ? "ste.mp3" : "ste.ogg"
  const uploaded = await telegramUpload(token, method, chatId, field, bytes, stored.mime, filename)
  return uploaded.ok
    ? uploaded.result?.voice?.file_id || uploaded.result?.audio?.file_id || ""
    : ""
}

export async function rememberVoiceFile(kv: KvLike, clipId: string, fileId: string) {
  const store = await loadVoiceStore(kv)
  const saved = store[clipId]
  if (!saved) return
  saved.fileId = fileId
  saved.updatedAt = new Date().toISOString()
  store[clipId] = saved
  await saveVoiceStore(kv, store)
}

async function telegramUpload(
  token: string,
  method: string,
  chatId: string,
  field: string,
  bytes: Uint8Array,
  mime: string,
  filename: string
) {
  const form = new FormData()
  form.set("chat_id", chatId)
  const copy = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(copy).set(bytes)
  form.set(field, new Blob([copy], { type: mime }), filename)
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, { method: "POST", body: form })
      if (res.status === 429 || res.status >= 500) {
        if (attempt === 2) return { ok: false }
        const retryAfter = Number(res.headers.get("retry-after") ?? "1")
        await new Promise((resolve) => setTimeout(resolve, Math.min(Math.max(Number.isFinite(retryAfter) ? retryAfter : 1, 1), 8) * 1000))
        continue
      }
      return (await res.json().catch(() => ({}))) as TelegramMedia
    } catch {
      if (attempt === 2) return { ok: false }
    }
  }
  return { ok: false }
}
