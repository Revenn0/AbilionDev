import {
  baseUrlOf,
  normalizeSteModel,
  OPENCODE_GO_BASE_URL,
  OPENROUTER_BASE_URL,
  STE_LLM_FALLBACK,
  STE_LLM_MODEL,
  STE_OPENCODE_MODEL,
} from "../src/lib/llm.ts"
import { cleanBotUsername, cleanTelegramGroupUrl } from "../src/lib/migrate.ts"
import type { KvLike } from "./kv.ts"

export const RUNTIME_KEY = "runtime:secrets"

export type RuntimeSecrets = {
  telegramBotToken?: string
  telegramBotUsername?: string
  telegramGroupUrl?: string
  openaiApiKey?: string
  opencodeApiKey?: string
  steModel?: string
  steFallbackModel?: string
  openaiBaseUrl?: string
  elevenApiKey?: string
  elevenVoiceId?: string
  webhookUrl?: string
  webhookOk?: boolean
  telegramWebhookSecret?: string
  updatedAt?: string
}

export type RuntimeEnv = {
  TELEGRAM_BOT_TOKEN?: string
  OPENAI_API_KEY?: string
  OPENCODE_API_KEY?: string
  STE_USE_LLM?: string
  STE_MODEL?: string
  STE_FALLBACK_MODEL?: string
  OPENAI_BASE_URL?: string
  OPENCODE_BASE_URL?: string
  ELEVENLABS_API_KEY?: string
  ELEVENLABS_VOICE_ID?: string
  SUPABASE_URL?: string
  SUPABASE_SERVICE_ROLE?: string
  APP_URL?: string
  AUTH?: unknown
}

export type ResolvedRuntime = {
  telegramBotToken: string
  openaiApiKey: string
  opencodeApiKey: string
  telegramBotUsername: string
  telegramGroupUrl: string
  webhookUrl: string
  webhookOk: boolean
  llm: boolean
  telegram: boolean
  supabase: boolean
  persist: "supabase" | "kv" | "memory"
  model: string
  fallbackModel: string
  baseUrl: string
  elevenApiKey: string
  elevenVoiceId: string
  voice: boolean
  voiceHint: string
}

export type PublicRuntime = {
  ok: true
  telegram: boolean
  llm: boolean
  supabase: boolean
  persist: ResolvedRuntime["persist"]
  telegramBotUsername: string
  telegramGroupUrl: string
  tokenHint: string
  webhook: string
  webhookOk: boolean
  model: string
  fallbackModel: string
  voice: boolean
  voiceHint: string
  voiceClips?: Array<{ id: string; label: string; ready: boolean }>
}

const MASK = /^[•*]+\s*\S{0,4}$/

export function emptySecrets(): RuntimeSecrets {
  return {}
}

export function tokenHint(token?: string) {
  const value = (token ?? "").trim()
  if (!value) return ""
  return `•••• ${value.slice(-4)}`
}

export function looksMasked(value?: string) {
  const next = (value ?? "").trim()
  return !next || MASK.test(next)
}

export function mergeSecrets(current: RuntimeSecrets, patch: RuntimeSecrets): RuntimeSecrets {
  const next: RuntimeSecrets = { ...current }
  if (patch.telegramBotToken !== undefined) {
    const token = patch.telegramBotToken.trim()
    if (!looksMasked(token)) next.telegramBotToken = token
  }
  if (patch.openaiApiKey !== undefined) {
    const key = patch.openaiApiKey.trim()
    if (!looksMasked(key)) next.openaiApiKey = key
  }
  if (patch.telegramBotUsername !== undefined) next.telegramBotUsername = cleanBotUsername(patch.telegramBotUsername)
  if (patch.telegramGroupUrl !== undefined) next.telegramGroupUrl = cleanTelegramGroupUrl(patch.telegramGroupUrl)
  if (patch.steModel !== undefined) next.steModel = normalizeSteModel(patch.steModel)
  if (patch.steFallbackModel !== undefined) next.steFallbackModel = normalizeSteModel(patch.steFallbackModel)
  if (patch.opencodeApiKey !== undefined) {
    const key = patch.opencodeApiKey.trim()
    if (!looksMasked(key)) next.opencodeApiKey = key
  }
  if (patch.openaiBaseUrl !== undefined) {
    const url = patch.openaiBaseUrl.trim().replace(/\/$/, "")
    if (url) next.openaiBaseUrl = url
  }
  if (patch.elevenApiKey !== undefined) {
    const key = patch.elevenApiKey.trim()
    if (!looksMasked(key)) next.elevenApiKey = key
  }
  if (patch.elevenVoiceId !== undefined) {
    const voice = patch.elevenVoiceId.trim()
    if (!looksMasked(voice)) next.elevenVoiceId = voice
  }
  if (patch.webhookUrl !== undefined) next.webhookUrl = patch.webhookUrl
  if (patch.webhookOk !== undefined) next.webhookOk = patch.webhookOk
  next.updatedAt = new Date().toISOString()
  return next
}

export function resolveRuntime(env: RuntimeEnv, secrets: RuntimeSecrets, webhookFallback = ""): ResolvedRuntime {
  const telegramBotToken = (secrets.telegramBotToken || env.TELEGRAM_BOT_TOKEN || "").trim()
  const openaiApiKey = (secrets.openaiApiKey || env.OPENAI_API_KEY || "").trim()
  const opencodeApiKey = (secrets.opencodeApiKey || env.OPENCODE_API_KEY || "").trim()
  const elevenApiKey = (secrets.elevenApiKey || env.ELEVENLABS_API_KEY || "").trim()
  const elevenVoiceId = (secrets.elevenVoiceId || env.ELEVENLABS_VOICE_ID || "").trim()
  const openrouterModel = normalizeSteModel(secrets.steModel || env.STE_MODEL || STE_LLM_MODEL)
  const rawFallback = normalizeSteModel(secrets.steFallbackModel || env.STE_FALLBACK_MODEL || STE_LLM_FALLBACK)
  const openrouterFallback = rawFallback === openrouterModel ? STE_LLM_FALLBACK : rawFallback
  const model = opencodeApiKey ? STE_OPENCODE_MODEL : openrouterModel
  const fallbackModel = opencodeApiKey ? openrouterModel : openrouterFallback
  return {
    telegramBotToken,
    openaiApiKey,
    opencodeApiKey,
    telegramBotUsername: cleanBotUsername(secrets.telegramBotUsername),
    telegramGroupUrl: cleanTelegramGroupUrl(secrets.telegramGroupUrl),
    webhookUrl: secrets.webhookUrl || webhookFallback,
    webhookOk: Boolean(secrets.webhookOk),
    llm: Boolean(openaiApiKey || opencodeApiKey) && env.STE_USE_LLM !== "0",
    telegram: Boolean(telegramBotToken),
    supabase: Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE),
    persist: env.SUPABASE_SERVICE_ROLE ? "supabase" : env.AUTH ? "kv" : "memory",
    model,
    fallbackModel,
    elevenApiKey,
    elevenVoiceId,
    voice: Boolean(elevenApiKey && elevenVoiceId),
    voiceHint: elevenVoiceId ? tokenHint(elevenVoiceId) : "",
    baseUrl: (
      opencodeApiKey
        ? env.OPENCODE_BASE_URL || OPENCODE_GO_BASE_URL
        : secrets.openaiBaseUrl || env.OPENAI_BASE_URL || baseUrlOf(model) || OPENROUTER_BASE_URL
    ).replace(/\/$/, ""),
  }
}

export function publicRuntime(
  resolved: ResolvedRuntime,
  clips?: Array<{ id: string; label: string; ready: boolean }>
): PublicRuntime {
  return {
    ok: true,
    telegram: resolved.telegram,
    llm: resolved.llm,
    supabase: resolved.supabase,
    persist: resolved.persist,
    telegramBotUsername: resolved.telegramBotUsername,
    telegramGroupUrl: resolved.telegramGroupUrl,
    tokenHint: tokenHint(resolved.telegramBotToken),
    webhook: resolved.webhookUrl,
    webhookOk: resolved.webhookOk,
    model: resolved.model,
    fallbackModel: resolved.fallbackModel,
    voice: resolved.voice,
    voiceHint: resolved.voiceHint,
    voiceClips: clips,
  }
}

export async function loadSecrets(kv: KvLike): Promise<RuntimeSecrets> {
  const raw = await kv.get(RUNTIME_KEY, "json")
  if (!raw || typeof raw !== "object") return emptySecrets()
  const secrets = raw as RuntimeSecrets
  if (secrets.steModel) secrets.steModel = normalizeSteModel(secrets.steModel)
  if (secrets.steFallbackModel) secrets.steFallbackModel = normalizeSteModel(secrets.steFallbackModel)
  return secrets
}

export async function saveSecrets(kv: KvLike, next: RuntimeSecrets) {
  await kv.put(RUNTIME_KEY, JSON.stringify(next))
}

export async function setTelegramWebhook(token: string, url: string, secret?: string) {
  const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      url,
      allowed_updates: ["message", "chat_member", "my_chat_member"],
      ...(secret ? { secret_token: secret } : {}),
    }),
  })
  const data = (await res.json().catch(() => ({}))) as { ok?: boolean; description?: string }
  return { ok: Boolean(data.ok), description: data.description || "" }
}
