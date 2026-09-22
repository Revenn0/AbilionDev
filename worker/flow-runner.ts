import { uid } from "../src/lib/format.ts"
import { applyBotResult, applyEvent, type RuntimeEvent, type RuntimeEffect } from "../src/lib/runtime.ts"
import { cleanHttpUrl } from "../src/lib/migrate.ts"
import {
  LEGACY_BOT_ID,
  LEGACY_INTEGRATION_ID,
  type FlowRun,
  type FlowRunStep,
} from "../src/lib/platform.ts"
import type { Lead, SalesSnapshot } from "../src/lib/types.ts"
import { ensureAudioAsset, saveAudioJob, sendAudioAsset } from "./audio-store.ts"
import { executeBotNode } from "./bot-executor.ts"
import type { KvLike } from "./kv.ts"
import {
  appendDiagnostic,
  loadPlatformState,
  saveFlowRun,
  type StoredBotIntegration,
} from "./platform-store.ts"

export type StrictFlowDelivery = {
  sendText(body: string, url?: string): Promise<boolean>
  approveJoin?(): Promise<boolean>
  notify?(body: string): Promise<boolean>
}

export type StrictFlowRuntime = {
  apiKey?: string
  openCodeKey?: string
  openRouterKey?: string
  model?: string
  fallbackModel?: string
  elevenApiKey?: string
  elevenVoiceId?: string
  telegramToken?: string
  chatId?: string
  integration?: StoredBotIntegration
}

export type StrictFlowResult = {
  ok: boolean
  sent: boolean
  lead: Lead
  run: FlowRun
  error?: string
}

export function isStrictFlow(snapshot: SalesSnapshot | null | undefined) {
  return Boolean(
    snapshot?.nodes.some((node) =>
      ["bot", "human", "approve", "audio", "webhook"].includes(node.type)
    )
  )
}

function withIncoming(lead: Lead, event: RuntimeEvent, incoming: string, now: string) {
  if (event.type !== "message" || !incoming.trim()) return lead
  const last = lead.messages.at(-1)
  if (last?.role === "lead" && last.text === incoming.trim()) return lead
  return {
    ...lead,
    messages: [
      ...lead.messages,
      { id: uid(), at: now, role: "lead" as const, text: incoming.trim().slice(0, 4_000) },
    ],
    lastMessage: incoming.trim().slice(0, 400),
    updatedAt: now,
  }
}

function stepOf(effect: RuntimeEffect, status: FlowRunStep["status"], summary?: string): FlowRunStep {
  const nodeId = "nodeId" in effect && typeof effect.nodeId === "string" ? effect.nodeId : ""
  return {
    id: crypto.randomUUID(),
    nodeId,
    mode:
      effect.kind === "invoke_bot"
        ? "ai"
        : effect.kind === "handoff_human"
          ? "human"
          : "automation",
    status,
    at: new Date().toISOString(),
    summary: summary || effect.kind,
  }
}

export async function executeStrictFlow(input: {
  kv: KvLike
  snapshot: SalesSnapshot
  lead: Lead
  event: RuntimeEvent
  incoming?: string
  delivery: StrictFlowDelivery
  runtime: StrictFlowRuntime
  environment: "development" | "staging" | "production"
  shadow?: boolean
  now?: number
}): Promise<StrictFlowResult> {
  const nowMs = input.now ?? Date.now()
  const now = new Date(nowMs).toISOString()
  const botId = input.lead.botId || input.snapshot.botId || LEGACY_BOT_ID
  const integrationId =
    input.lead.integrationId || input.runtime.integration?.id || LEGACY_INTEGRATION_ID
  let lead = withIncoming(input.lead, input.event, input.incoming || "", now)
  let result = applyEvent(input.snapshot, lead, input.event, nowMs)
  lead = result.lead
  const queue = [...result.effects]
  let sent = false
  const run: FlowRun = {
    id: crypto.randomUUID(),
    botId,
    integrationId,
    leadId: lead.id,
    funnelId: lead.funnelId || "",
    flowVersionId: input.snapshot.id || input.snapshot.publishedAt,
    brainVersionId: input.snapshot.brainVersionId,
    status: "running",
    startedAt: now,
    updatedAt: now,
    steps: [],
    shadow: input.shadow,
  }

  const fail = async (effect: RuntimeEffect, message: string, code: string) => {
    run.status = "failed"
    run.updatedAt = new Date().toISOString()
    run.completedAt = run.updatedAt
    run.steps.push({ ...stepOf(effect, "failed", message), errorCode: code })
    await Promise.all([
      saveFlowRun(input.kv, run),
      appendDiagnostic(input.kv, {
        id: crypto.randomUUID(),
        at: run.updatedAt,
        environment: input.environment,
        level: "error",
        area: effect.kind === "send_audio" ? "audio" : effect.kind === "invoke_bot" ? "bot" : "flow",
        code,
        message,
        recommendation:
          effect.kind === "invoke_bot"
            ? "Confere o Cérebro, a chave da IA e o caminho de erro deste nó."
            : "Abre o trace e tenta novamente depois de corrigir a integração.",
        botId,
        integrationId,
        runId: run.id,
      }),
    ])
    return { ok: false, sent, lead, run, error: message }
  }

  for (let guard = 0; queue.length && guard < 64; guard++) {
    const effect = queue.shift()!
    if (input.shadow) {
      run.steps.push(stepOf(effect, "completed", `Sombra · ${effect.kind}`))
      continue
    }

    if (effect.kind === "send_message" || effect.kind === "offer") {
      const ok = await input.delivery.sendText(effect.body || "", effect.url)
      if (!ok) return fail(effect, "O canal recusou a mensagem.", "channel_rejected_message")
      sent = true
      run.steps.push(stepOf(effect, "completed"))
      continue
    }

    if (effect.kind === "invoke_bot") {
      const state = await loadPlatformState(input.kv)
      const brain = state.brains.find(
        (item) =>
          item.id === effect.policy.brainVersionId &&
          item.botId === effect.policy.botId
      )
      if (!brain) return fail(effect, "Não encontrei a versão do Cérebro deste nó.", "brain_missing")
      const output = await executeBotNode(brain, effect.policy, lead, input.incoming || "", {
        apiKey: input.runtime.apiKey,
        openCodeKey: input.runtime.openCodeKey,
        openRouterKey: input.runtime.openRouterKey,
        model: input.runtime.model,
        fallbackModel: input.runtime.fallbackModel,
      })
      if (!output.ok) {
        if (effect.policy.errorTarget) {
          result = applyBotResult(input.snapshot, lead, {
            nodeId: effect.nodeId,
            branch: effect.policy.errorTarget,
          }, nowMs)
          lead = result.lead
          queue.unshift(...result.effects)
          run.steps.push(stepOf(effect, "blocked", output.error))
          continue
        }
        return fail(effect, output.error || "O Cérebro falhou.", output.errorCode || "brain_failed")
      }
      result = applyBotResult(input.snapshot, lead, {
        nodeId: effect.nodeId,
        text: output.text,
        branch: output.branch,
        memory: output.memory,
      }, nowMs)
      lead = result.lead
      queue.unshift(...result.effects)
      run.brainVersionId = brain.id
      run.steps.push(stepOf(effect, "completed", `${effect.policy.mode} → ${output.branch}`))
      continue
    }

    if (effect.kind === "handoff_human" || effect.kind === "handoff") {
      run.status = "human"
      run.steps.push(stepOf(effect, "completed", "Conversa entregue ao operador."))
      continue
    }

    if (effect.kind === "approve_join") {
      const ok = await input.delivery.approveJoin?.()
      if (!ok) return fail(effect, "O canal recusou a aprovação da entrada.", "channel_rejected_approval")
      run.steps.push(stepOf(effect, "completed"))
      continue
    }

    if (effect.kind === "send_audio") {
      if (
        !input.runtime.elevenApiKey ||
        !input.runtime.elevenVoiceId ||
        !input.runtime.telegramToken ||
        !input.runtime.chatId ||
        !input.runtime.integration
      ) {
        if (effect.fallback === "text") {
          const ok = await input.delivery.sendText(effect.text)
          if (!ok) return fail(effect, "O áudio e o texto de reserva falharam.", "audio_fallback_failed")
          sent = true
          run.steps.push(stepOf(effect, "completed", "Áudio indisponível; texto autorizado enviado."))
          continue
        }
        return fail(effect, "A voz ou a integração deste bot não está configurada.", "audio_not_configured")
      }
      const jobId = `audio-job-${crypto.randomUUID()}`
      const jobBase = {
        id: jobId,
        botId,
        integrationId,
        chatId: input.runtime.chatId,
        nodeId: effect.nodeId,
        progress: 10,
        attempts: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      await saveAudioJob(input.kv, {
        ...jobBase,
        assetId: "",
        status: "processing",
      })
      try {
        const asset = await ensureAudioAsset(input.kv, {
          botId,
          brainVersionId: run.brainVersionId,
          flowVersionId: run.flowVersionId,
          nodeId: effect.nodeId,
          voiceProfileId: input.runtime.elevenVoiceId,
          language: input.runtime.integration.externalUsername ? "pt-BR" : "pt-BR",
          text: effect.text,
          apiKey: input.runtime.elevenApiKey,
        })
        const delivered = await sendAudioAsset(input.kv, {
          asset,
          token: input.runtime.telegramToken,
          chatId: input.runtime.chatId,
          integrationId,
          externalBotId: input.runtime.integration.externalBotId,
        })
        if (!delivered.ok) throw new Error(delivered.errorCode || "channel_rejected_audio")
        await saveAudioJob(input.kv, {
          ...jobBase,
          assetId: asset.id,
          status: "completed",
          progress: 100,
          remoteMessageId: delivered.fileId,
          updatedAt: new Date().toISOString(),
        })
        sent = true
        run.steps.push(stepOf(effect, "completed", delivered.reused ? "Áudio reutilizado." : "Áudio enviado."))
      } catch (error) {
        const code = error instanceof Error ? error.message : "audio_failed"
        await saveAudioJob(input.kv, {
          ...jobBase,
          assetId: "",
          status: "error",
          progress: 100,
          errorCode: code,
          errorMessage: "Não processei o áudio.",
          recommendation: "Confere voz, credencial e formato; depois tenta novamente.",
          updatedAt: new Date().toISOString(),
        })
        if (effect.fallback === "text") {
          const ok = await input.delivery.sendText(effect.text)
          if (ok) {
            sent = true
            run.steps.push(stepOf(effect, "completed", "Áudio falhou; texto autorizado enviado."))
            continue
          }
        }
        return fail(effect, "Não processei ou enviei o áudio.", code)
      }
      continue
    }

    if (effect.kind === "notify_ester") {
      const ok = await input.delivery.notify?.(effect.body)
      if (!ok) return fail(effect, "Não enviei o aviso interno.", "notification_failed")
      run.steps.push(stepOf(effect, "completed"))
      continue
    }

    if (effect.kind === "call_webhook") {
      const url = cleanHttpUrl(effect.url)
      if (!url || !url.startsWith("https://")) {
        return fail(effect, "O webhook deste nó não é um URL HTTPS válido.", "webhook_invalid")
      }
      try {
        const response = await fetch(url, {
          method: effect.method,
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            runId: run.id,
            botId,
            leadId: lead.id,
            nodeId: effect.nodeId,
            body: effect.body,
          }),
          signal: AbortSignal.timeout(12_000),
        })
        if (!response.ok) return fail(effect, `O webhook respondeu ${response.status}.`, "webhook_rejected")
        run.steps.push(stepOf(effect, "completed"))
      } catch {
        return fail(effect, "O webhook não respondeu.", "webhook_unavailable")
      }
      continue
    }

    if (effect.kind === "blocked") {
      run.status = "blocked"
      run.blockedReason = effect.reason
      run.steps.push(stepOf(effect, "blocked", effect.reason))
      continue
    }

    run.steps.push(stepOf(effect, "completed"))
  }

  if (run.status === "running") {
    run.status = lead.paused || lead.waitUntil ? "waiting" : "completed"
  }
  run.updatedAt = new Date().toISOString()
  if (run.status === "completed" || run.status === "blocked" || run.status === "human") {
    run.completedAt = run.updatedAt
  }
  await saveFlowRun(input.kv, run)
  return { ok: true, sent, lead, run }
}
