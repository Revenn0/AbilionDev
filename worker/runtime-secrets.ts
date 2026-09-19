import { baseUrlOf, normalizeSteModel, OPENROUTER_BASE_URL, STE_LLM_FALLBACK, STE_LLM_MODEL } from "../src/lib/llm.ts"
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
  webhookUrl?: string
  webhookOk?: boolean
  updatedAt?: string
}

export type RuntimeEnv = {
  TELEGRAM_BOT_TOKEN?: string
  OPENAI_API_KEY?: string
  STE_USE_LLM?: string
  STE_MODEL?: string
  STE_FALLBACK_MODEL?: string
  OPENAI_BASE_URL?: string
  SUPABASE_URL?: string
  SUPABASE_SERVICE_ROLE?: string
  APP_URL?: string
  AUTH?: unknown
}

export type ResolvedRuntime = {
  telegramBotToken: string
  openaiApiKey: string
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
  if (patch.telegramBotUsername !== undefined) next.telegramBotUsername = patch.telegramBotUsername.trim()
  if (patch.telegramGroupUrl !== undefined) next.telegramGroupUrl = patch.telegramGroupUrl.trim()
  if (patch.steModel !== undefined) next.steModel = normalizeSteModel(patch.steModel)
  if (patch.steFallbackModel !== undefined) next.steFallbackModel = normalizeSteModel(patch.steFallbackModel)
  if (patch.openaiBaseUrl !== undefined) {
    const url = patch.openaiBaseUrl.trim().replace(/\/$/, "")
    if (url) next.openaiBaseUrl = url
  }
  if (patch.webhookUrl !== undefined) next.webhookUrl = patch.webhookUrl
  if (patch.webhookOk !== undefined) next.webhookOk = patch.webhookOk
  delete next.opencodeApiKey
  next.updatedAt = new Date().toISOString()
  return next
}

export function resolveRuntime(env: RuntimeEnv, secrets: RuntimeSecrets, webhookFallback = ""): ResolvedRuntime {
  const telegramBotToken = (secrets.telegramBotToken || env.TELEGRAM_BOT_TOKEN || "").trim()
  const openaiApiKey = (secrets.openaiApiKey || env.OPENAI_API_KEY || "").trim()
  const model = normalizeSteModel(secrets.steModel || env.STE_MODEL || STE_LLM_MODEL)
  const rawFallback = normalizeSteModel(secrets.steFallbackModel || env.STE_FALLBACK_MODEL || STE_LLM_FALLBACK)
  const fallbackModel = rawFallback === model ? STE_LLM_FALLBACK : rawFallback
  return {
    telegramBotToken,
    openaiApiKey,
    telegramBotUsername: (secrets.telegramBotUsername || "").trim(),
    telegramGroupUrl: (secrets.telegramGroupUrl || "").trim(),
    webhookUrl: secrets.webhookUrl || webhookFallback,
    webhookOk: Boolean(secrets.webhookOk),
    llm: Boolean(openaiApiKey) && env.STE_USE_LLM !== "0",
    telegram: Boolean(telegramBotToken),
    supabase: Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE),
    persist: env.SUPABASE_SERVICE_ROLE ? "supabase" : env.AUTH ? "kv" : "memory",
    model,
    fallbackModel,
    baseUrl: (secrets.openaiBaseUrl || env.OPENAI_BASE_URL || baseUrlOf(model) || OPENROUTER_BASE_URL).replace(/\/$/, ""),
  }
}

export function publicRuntime(resolved: ResolvedRuntime): PublicRuntime {
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
