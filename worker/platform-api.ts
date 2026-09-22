import {
  LEGACY_BOT_ID,
  maskAuditValue,
  nextBrainVersion,
  tokenHintOf,
  type AuditEvent,
  type BotDefinition,
  type BrainVersion,
  type PlatformEnvironment,
} from "../src/lib/platform.ts"
import { isOwner, randomToken, type PublicUser } from "./auth.ts"
import { readJsonObject } from "./json-body.ts"
import type { KvLike } from "./kv.ts"
import {
  appendAudit,
  appendDiagnostic,
  ensureLegacyPlatform,
  loadPlatformState,
  publicIntegration,
  saveBots,
  saveBrains,
  saveIntegrations,
  type LegacyPlatformInput,
  type StoredBotIntegration,
} from "./platform-store.ts"
import {
  deleteTelegramWebhook,
  getTelegramIdentity,
  getTelegramWebhookInfo,
  setTelegramWebhook,
  TELEGRAM_ALLOWED_UPDATES,
} from "./runtime-secrets.ts"

type PlatformApiContext = {
  environment: PlatformEnvironment
  origin: string
  legacy: LegacyPlatformInput
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  })
}

function nowIso() {
  return new Date().toISOString()
}

function platformPublic(state: Awaited<ReturnType<typeof loadPlatformState>>) {
  return {
    ok: true,
    bots: state.bots,
    integrations: state.integrations.map(publicIntegration),
    brains: state.brains,
    audit: state.audit.slice(0, 200),
    diagnostics: state.diagnostics.slice(0, 200),
    runs: state.runs.slice(0, 200),
  }
}

function audit(
  actor: PublicUser,
  context: PlatformApiContext,
  input: Omit<AuditEvent, "id" | "at" | "environment" | "actorId" | "actorType">
): AuditEvent {
  return {
    id: crypto.randomUUID(),
    at: nowIso(),
    environment: context.environment,
    actorId: actor.id,
    actorType: "user",
    ...input,
    before: input.before ? (maskAuditValue(input.before) as Record<string, unknown>) : undefined,
    after: input.after ? (maskAuditValue(input.after) as Record<string, unknown>) : undefined,
  }
}

async function readyState(kv: KvLike, context: PlatformApiContext, actor: PublicUser) {
  return ensureLegacyPlatform(kv, {
    ...context.legacy,
    environment: context.environment,
    actorId: actor.id,
  })
}

export async function handlePlatformApi(
  request: Request,
  kv: KvLike,
  actor: PublicUser,
  context: PlatformApiContext
) {
  const url = new URL(request.url)
  const state = await readyState(kv, context, actor)

  if (url.pathname === "/api/platform" && request.method === "GET") {
    return json(platformPublic(state))
  }

  if (url.pathname === "/api/bots" && request.method === "GET") {
    return json({
      ok: true,
      bots: state.bots,
      integrations: state.integrations.map(publicIntegration),
      brains: state.brains,
    })
  }

  if (url.pathname === "/api/bots" && request.method === "POST") {
    if (!isOwner(actor)) return json({ error: "Só o administrador cria ou duplica bots." }, 403)
    const parsed = await readJsonObject<{
      name?: string
      description?: string
      locale?: string
      duplicateFromId?: string
    }>(request, 16_384)
    if (!parsed.ok) return json({ error: "Pedido inválido." }, parsed.status)
    const source = parsed.value.duplicateFromId
      ? state.bots.find((item) => item.id === parsed.value.duplicateFromId)
      : undefined
    if (parsed.value.duplicateFromId && !source) return json({ error: "O bot de origem já não existe." }, 404)
    const name = (parsed.value.name || (source ? `${source.name} · cópia` : "")).trim().slice(0, 80)
    if (!name) return json({ error: "Dá um nome ao bot." }, 400)
    const now = nowIso()
    const id = `bot-${randomToken(8)}`
    let brainId: string | undefined
    const sourceBrain = source?.activeBrainVersionId
      ? state.brains.find((item) => item.id === source.activeBrainVersionId)
      : undefined
    if (sourceBrain) {
      brainId = `brain-${randomToken(8)}`
      const copied: BrainVersion = {
        ...sourceBrain,
        id: brainId,
        botId: id,
        version: 1,
        status: "draft",
        name: `${sourceBrain.name} · cópia`,
        createdAt: now,
        createdBy: actor.id,
        publishedAt: undefined,
        publishedBy: undefined,
        restoredFromId: sourceBrain.id,
      }
      await saveBrains(kv, [copied])
    }
    const bot: BotDefinition = {
      id,
      name,
      description: (parsed.value.description || source?.description || "").trim().slice(0, 240),
      status: "draft",
      locale: (parsed.value.locale || source?.locale || "pt-BR").trim().slice(0, 16),
      ownerId: actor.id,
      activeBrainVersionId: brainId,
      defaultFunnelId: source?.defaultFunnelId,
      voiceProfileId: source?.voiceProfileId,
      createdAt: now,
      createdBy: actor.id,
      updatedAt: now,
      updatedBy: actor.id,
    }
    await saveBots(kv, [bot])
    await appendAudit(
      kv,
      audit(actor, context, {
        action: source ? "bot.duplicated" : "bot.created",
        entityType: "bot",
        entityId: bot.id,
        result: "success",
        after: { ...bot, sourceBotId: source?.id },
      })
    )
    return json({ ok: true, bot, brainId }, 201)
  }

  if (url.pathname === "/api/bots" && request.method === "PATCH") {
    if (!isOwner(actor)) return json({ error: "Só o administrador altera bots." }, 403)
    const parsed = await readJsonObject<{
      id?: string
      name?: string
      description?: string
      locale?: string
      status?: BotDefinition["status"]
      defaultFunnelId?: string
      voiceProfileId?: string
    }>(request, 16_384)
    if (!parsed.ok) return json({ error: "Pedido inválido." }, parsed.status)
    const current = state.bots.find((item) => item.id === parsed.value.id)
    if (!current) return json({ error: "Este bot já não existe." }, 404)
    const next: BotDefinition = {
      ...current,
      name: typeof parsed.value.name === "string" ? parsed.value.name.trim().slice(0, 80) || current.name : current.name,
      description:
        typeof parsed.value.description === "string"
          ? parsed.value.description.trim().slice(0, 240)
          : current.description,
      locale: typeof parsed.value.locale === "string" ? parsed.value.locale.trim().slice(0, 16) || current.locale : current.locale,
      status: parsed.value.status ?? current.status,
      defaultFunnelId:
        parsed.value.defaultFunnelId !== undefined
          ? parsed.value.defaultFunnelId.trim().slice(0, 80) || undefined
          : current.defaultFunnelId,
      voiceProfileId:
        parsed.value.voiceProfileId !== undefined
          ? parsed.value.voiceProfileId.trim().slice(0, 80) || undefined
          : current.voiceProfileId,
      archivedAt: parsed.value.status === "archived" ? nowIso() : current.archivedAt,
      updatedAt: nowIso(),
      updatedBy: actor.id,
    }
    await saveBots(kv, [next])
    await appendAudit(
      kv,
      audit(actor, context, {
        action: "bot.updated",
        entityType: "bot",
        entityId: next.id,
        result: "success",
        before: current,
        after: next,
      })
    )
    return json({ ok: true, bot: next })
  }

  if (url.pathname === "/api/bots" && request.method === "DELETE") {
    if (!isOwner(actor)) return json({ error: "Só o administrador arquiva bots." }, 403)
    const id = (url.searchParams.get("id") || "").trim()
    const current = state.bots.find((item) => item.id === id)
    if (!current) return json({ error: "Este bot já não existe." }, 404)
    if (id === LEGACY_BOT_ID && current.status === "active") {
      return json({ error: "Pausa e desconecta a Sté antes de arquivar." }, 409)
    }
    const next = { ...current, status: "archived" as const, archivedAt: nowIso(), updatedAt: nowIso(), updatedBy: actor.id }
    await saveBots(kv, [next])
    await appendAudit(
      kv,
      audit(actor, context, {
        action: "bot.archived",
        entityType: "bot",
        entityId: id,
        result: "success",
        before: current,
        after: next,
      })
    )
    return json({ ok: true, bot: next })
  }

  if (url.pathname === "/api/brains" && request.method === "GET") {
    const botId = (url.searchParams.get("botId") || "").trim()
    return json({ ok: true, brains: state.brains.filter((item) => !botId || item.botId === botId) })
  }

  if (url.pathname === "/api/brains" && request.method === "POST") {
    if (!isOwner(actor)) return json({ error: "Só o administrador cria versões do Cérebro." }, 403)
    const parsed = await readJsonObject<Partial<BrainVersion> & { botId?: string; sourceId?: string }>(request, 131_072)
    if (!parsed.ok) return json({ error: "Pedido inválido." }, parsed.status)
    const botId = (parsed.value.botId || "").trim()
    const bot = state.bots.find((item) => item.id === botId)
    if (!bot) return json({ error: "Escolhe um bot válido." }, 400)
    const source = parsed.value.sourceId
      ? state.brains.find((item) => item.id === parsed.value.sourceId && item.botId === botId)
      : undefined
    const now = nowIso()
    const brain: BrainVersion = {
      id: `brain-${randomToken(8)}`,
      botId,
      version: nextBrainVersion(state.brains, botId),
      status: "draft",
      name: (parsed.value.name || source?.name || `Cérebro ${bot.name}`).trim().slice(0, 80),
      identity: (parsed.value.identity || source?.identity || "").slice(0, 8_000),
      systemPrompt: (parsed.value.systemPrompt || source?.systemPrompt || "").slice(0, 64_000),
      behavior: (parsed.value.behavior || source?.behavior || "").slice(0, 16_000),
      globalMemory: (parsed.value.globalMemory || source?.globalMemory || "").slice(0, 64_000),
      language: (parsed.value.language || source?.language || bot.locale).slice(0, 16),
      tone: (parsed.value.tone || source?.tone || "").slice(0, 240),
      tools: Array.isArray(parsed.value.tools) ? parsed.value.tools.slice(0, 40) : source?.tools || [],
      memoryPolicy: parsed.value.memoryPolicy || source?.memoryPolicy || {
        readLead: true,
        writeLead: true,
        proposeGlobal: false,
      },
      voiceProfileId: parsed.value.voiceProfileId || source?.voiceProfileId,
      notes: parsed.value.notes?.slice(0, 2_000),
      createdAt: now,
      createdBy: actor.id,
      restoredFromId: source?.id,
    }
    await saveBrains(kv, [brain])
    await appendAudit(
      kv,
      audit(actor, context, {
        action: source ? "brain.restored_as_draft" : "brain.created",
        entityType: "brain",
        entityId: brain.id,
        result: "success",
        after: brain,
      })
    )
    return json({ ok: true, brain }, 201)
  }

  if (url.pathname === "/api/brains" && request.method === "PATCH") {
    if (!isOwner(actor)) return json({ error: "Só o administrador altera o Cérebro." }, 403)
    const parsed = await readJsonObject<Partial<BrainVersion> & { id?: string; action?: "test" | "publish" }>(
      request,
      131_072
    )
    if (!parsed.ok) return json({ error: "Pedido inválido." }, parsed.status)
    const current = state.brains.find((item) => item.id === parsed.value.id)
    if (!current) return json({ error: "Esta versão já não existe." }, 404)
    if (current.status === "published" && parsed.value.action !== "test") {
      return json({ error: "Versões publicadas são imutáveis. Cria um novo rascunho." }, 409)
    }
    const next: BrainVersion = {
      ...current,
      name: parsed.value.name?.trim().slice(0, 80) || current.name,
      identity: parsed.value.identity !== undefined ? parsed.value.identity.slice(0, 8_000) : current.identity,
      systemPrompt: parsed.value.systemPrompt !== undefined ? parsed.value.systemPrompt.slice(0, 64_000) : current.systemPrompt,
      behavior: parsed.value.behavior !== undefined ? parsed.value.behavior.slice(0, 16_000) : current.behavior,
      globalMemory: parsed.value.globalMemory !== undefined ? parsed.value.globalMemory.slice(0, 64_000) : current.globalMemory,
      language: parsed.value.language?.slice(0, 16) || current.language,
      tone: parsed.value.tone !== undefined ? parsed.value.tone.slice(0, 240) : current.tone,
      tools: Array.isArray(parsed.value.tools) ? parsed.value.tools.slice(0, 40) : current.tools,
      memoryPolicy: parsed.value.memoryPolicy || current.memoryPolicy,
      notes: parsed.value.notes !== undefined ? parsed.value.notes.slice(0, 2_000) : current.notes,
      status: parsed.value.action === "publish" ? "published" : parsed.value.action === "test" ? "testing" : current.status,
      publishedAt: parsed.value.action === "publish" ? nowIso() : current.publishedAt,
      publishedBy: parsed.value.action === "publish" ? actor.id : current.publishedBy,
    }
    if (!next.systemPrompt.trim()) return json({ error: "O prompt principal não pode ficar vazio." }, 400)
    await saveBrains(kv, [next])
    if (parsed.value.action === "publish") {
      const bot = state.bots.find((item) => item.id === next.botId)
      if (bot) {
        await saveBots(kv, [
          { ...bot, activeBrainVersionId: next.id, updatedAt: nowIso(), updatedBy: actor.id },
        ])
      }
    }
    await appendAudit(
      kv,
      audit(actor, context, {
        action: parsed.value.action === "publish" ? "brain.published" : parsed.value.action === "test" ? "brain.testing" : "brain.updated",
        entityType: "brain",
        entityId: next.id,
        result: "success",
        before: current,
        after: next,
      })
    )
    return json({ ok: true, brain: next })
  }

  if (url.pathname === "/api/integrations" && request.method === "POST") {
    if (!isOwner(actor)) return json({ error: "Só o administrador altera integrações." }, 403)
    const parsed = await readJsonObject<{
      botId?: string
      integrationId?: string
      action?: "connect" | "reconnect" | "switch" | "reset"
      token?: string
      project?: string
      workspace?: string
    }>(request, 24_576)
    if (!parsed.ok) return json({ error: "Pedido inválido." }, parsed.status)
    const bot = state.bots.find((item) => item.id === parsed.value.botId)
    if (!bot) return json({ error: "Escolhe um bot válido." }, 400)
    const current =
      state.integrations.find((item) => item.id === parsed.value.integrationId) ||
      state.integrations.find((item) => item.botId === bot.id && item.status !== "retired")
    const action = parsed.value.action || "connect"
    if (action === "reset") {
      if (!current) return json({ error: "Este bot ainda não tem integração." }, 404)
      const disconnected = current.telegramBotToken
        ? await deleteTelegramWebhook(current.telegramBotToken)
        : { ok: true, description: "" }
      const next: StoredBotIntegration = {
        ...current,
        status: "disconnected",
        telegramBotToken: undefined,
        webhookSecret: undefined,
        tokenHint: "",
        credentialVersionId: undefined,
        webhookOk: false,
        webhookUrl: undefined,
        lastError: disconnected.ok ? undefined : disconnected.description || "Não desliguei o webhook antigo.",
        cleanupPending: !disconnected.ok,
        updatedAt: nowIso(),
      }
      await saveIntegrations(kv, [next])
      await saveBots(kv, [
        { ...bot, status: "paused", integrationId: next.id, updatedAt: nowIso(), updatedBy: actor.id },
      ])
      await appendAudit(
        kv,
        audit(actor, context, {
          action: "integration.reset",
          entityType: "integration",
          entityId: next.id,
          result: disconnected.ok ? "success" : "failure",
          before: publicIntegration(current),
          after: publicIntegration(next),
          message: next.lastError,
        })
      )
      return json({ ok: true, integration: publicIntegration(next), warning: next.lastError })
    }

    const token = (parsed.value.token || current?.telegramBotToken || "").trim()
    if (!token) return json({ error: "Cola o token para ligar este bot." }, 400)
    const identity = await getTelegramIdentity(token)
    if (!identity.ok) return json({ error: identity.description || "O Telegram recusou este token." }, 400)
    if (
      action !== "switch" &&
      current?.externalBotId &&
      identity.id &&
      current.externalBotId !== identity.id
    ) {
      return json(
        {
          error: `Este token pertence a ${identity.username || identity.name || "outro bot"}. Usa “Trocar integração” para confirmar.`,
        },
        409
      )
    }
    const id = current?.id || `integration-${randomToken(8)}`
    const webhookSecret = randomToken(24)
    const webhookUrl = `${context.origin.replace(/\/$/, "")}/api/telegram/${encodeURIComponent(id)}`
    const hooked = await setTelegramWebhook(token, webhookUrl, webhookSecret)
    const verified = hooked.ok ? await getTelegramWebhookInfo(token) : null
    const verifiedOk = Boolean(hooked.ok && verified?.ok && verified.url === webhookUrl)
    if (!verifiedOk) {
      const reason =
        verified?.lastError || verified?.description || hooked.description || "O Telegram não confirmou o webhook."
      await appendDiagnostic(kv, {
        id: crypto.randomUUID(),
        at: nowIso(),
        environment: context.environment,
        level: "error",
        area: "integration",
        code: "telegram_webhook_not_verified",
        message: reason,
        recommendation: "Confere o token e tenta Reconectar.",
        botId: bot.id,
        integrationId: id,
      })
      if (!current) {
        await saveIntegrations(kv, [
          {
            id,
            botId: bot.id,
            channel: "telegram",
            environment: context.environment,
            status: "error",
            externalBotId: identity.id,
            externalUsername: identity.username,
            project: parsed.value.project?.trim().slice(0, 80),
            workspace: parsed.value.workspace?.trim().slice(0, 80),
            tokenHint: tokenHintOf(token),
            webhookOk: false,
            allowedUpdates: [...TELEGRAM_ALLOWED_UPDATES],
            lastError: reason,
            createdAt: nowIso(),
            updatedAt: nowIso(),
          },
        ])
      }
      return json({ error: reason }, 400)
    }

    const oldToken = current?.telegramBotToken
    const now = nowIso()
    let next: StoredBotIntegration = {
      id,
      botId: bot.id,
      channel: "telegram",
      environment: context.environment,
      status: "connected",
      externalBotId: identity.id,
      externalUsername: identity.username,
      project: parsed.value.project?.trim().slice(0, 80) || current?.project,
      workspace: parsed.value.workspace?.trim().slice(0, 80) || current?.workspace,
      telegramBotToken: token,
      webhookSecret,
      tokenHint: tokenHintOf(token),
      credentialVersionId: `credential-${randomToken(8)}`,
      webhookUrl,
      webhookOk: true,
      allowedUpdates: [...TELEGRAM_ALLOWED_UPDATES],
      lastVerifiedAt: now,
      createdAt: current?.createdAt || now,
      updatedAt: now,
    }
    await saveIntegrations(kv, [next])
    await saveBots(kv, [
      {
        ...bot,
        integrationId: id,
        status: "active",
        updatedAt: now,
        updatedBy: actor.id,
      },
    ])

    if (oldToken && oldToken !== token) {
      const removed = await deleteTelegramWebhook(oldToken)
      if (!removed.ok) {
        next = {
          ...next,
          cleanupPending: true,
          lastError: "O bot novo está ligado, mas o webhook anterior ainda precisa de limpeza.",
          updatedAt: nowIso(),
        }
        await saveIntegrations(kv, [next])
      }
    }

    await appendAudit(
      kv,
      audit(actor, context, {
        action: current ? (action === "switch" ? "integration.switched" : "integration.reconnected") : "integration.connected",
        entityType: "integration",
        entityId: id,
        result: "success",
        before: current ? publicIntegration(current) : undefined,
        after: publicIntegration(next),
        message: next.lastError,
      })
    )
    return json({ ok: true, integration: publicIntegration(next), warning: next.lastError })
  }

  return json({ error: "not_found" }, 404)
}
