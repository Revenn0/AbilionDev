import { profilesForUser } from "../src/lib/access.ts"
import {
  canAccess,
  type CreativeConcept,
  type CreativeExperiment,
  type CreativeVariant,
  type ExperimentMetric,
  type Permission,
  type PlatformEnvironment,
} from "../src/lib/platform.ts"
import type { PublicUser } from "./auth.ts"
import {
  loadCreativeCatalog,
  loadCreativeExperiments,
  saveCreativeConcepts,
  saveCreativeExperiments,
  saveCreativeVariants,
  suggestedWinner,
  translateVariantToSpanish,
} from "./creative-store.ts"
import { readJsonObject } from "./json-body.ts"
import type { KvLike } from "./kv.ts"
import { appendAudit } from "./platform-store.ts"

type CreativeContext = {
  environment: PlatformEnvironment
  runtime: {
    apiKey?: string
    openCodeKey?: string
    openRouterKey?: string
    model?: string
    fallbackModel?: string
  }
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  })
}

function forbidUnless(actor: PublicUser, permission: Permission) {
  if (canAccess(profilesForUser(actor), permission)) return null
  return json({ error: "Não tens permissão para esta acção." }, 403)
}

function nowIso() {
  return new Date().toISOString()
}

function text(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : ""
}

function trackingId() {
  return `cr_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`
}

function creativeAudit(
  actor: PublicUser,
  context: CreativeContext,
  input: {
    action: string
    entityType: string
    entityId: string
    before?: Record<string, unknown>
    after?: Record<string, unknown>
    result?: "success" | "failure"
    message?: string
  }
) {
  return {
    id: crypto.randomUUID(),
    at: nowIso(),
    environment: context.environment,
    actorId: actor.id,
    actorType: "user" as const,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    before: input.before,
    after: input.after,
    result: input.result || ("success" as const),
    message: input.message,
  }
}

function sanitizeConcept(raw: unknown, current?: CreativeConcept): CreativeConcept | null {
  if (!raw || typeof raw !== "object") return null
  const row = raw as Partial<CreativeConcept>
  const name = text(row.name, 120)
  const theme = text(row.theme, 120)
  if (!name || !theme) return null
  const now = nowIso()
  return {
    id: current?.id || text(row.id, 80) || `concept-${crypto.randomUUID()}`,
    name,
    theme,
    createdAt: current?.createdAt || now,
    updatedAt: now,
  }
}

function sanitizeVariant(raw: unknown, current?: CreativeVariant): CreativeVariant | null {
  if (!raw || typeof raw !== "object") return null
  const row = raw as Partial<CreativeVariant>
  const conceptId = text(row.conceptId, 80)
  const name = text(row.name, 120)
  const title = text(row.title, 240)
  const body = text(row.body, 8_000)
  const cta = text(row.cta, 240)
  if (!conceptId || !name || !title || !body || !cta) return null
  const now = nowIso()
  const status = ["draft", "review", "testing", "approved", "paused", "winner"].includes(String(row.status))
    ? (row.status as CreativeVariant["status"])
    : current?.status || "draft"
  return {
    id: current?.id || text(row.id, 80) || `variant-${crypto.randomUUID()}`,
    conceptId,
    sourceVariantId: text(row.sourceVariantId, 80) || current?.sourceVariantId,
    name,
    language: row.language === "es" ? "es" : "pt-BR",
    market: text(row.market, 80),
    operation: text(row.operation, 80),
    theme: text(row.theme, 120),
    title,
    body,
    cta,
    description: text(row.description, 2_000),
    script: text(row.script, 16_000),
    status,
    botId: text(row.botId, 80) || undefined,
    funnelId: text(row.funnelId, 80) || undefined,
    flowVersionId: text(row.flowVersionId, 80) || undefined,
    pageScriptId: text(row.pageScriptId, 80) || undefined,
    trackingId: current?.trackingId || text(row.trackingId, 80) || trackingId(),
    responsibleId: text(row.responsibleId, 80) || undefined,
    version: current ? current.version + 1 : Math.max(1, Number(row.version) || 1),
    createdAt: current?.createdAt || now,
    updatedAt: now,
    reviewedAt: status === "approved" || status === "testing" ? now : current?.reviewedAt,
    reviewedBy: text(row.reviewedBy, 80) || current?.reviewedBy,
  }
}

function sanitizeMetrics(raw: unknown, variants: string[]): ExperimentMetric[] {
  if (!Array.isArray(raw)) return []
  const allowed = new Set(variants)
  return raw.flatMap((item) => {
    if (!item || typeof item !== "object") return []
    const row = item as Partial<ExperimentMetric>
    const variantId = text(row.variantId, 80)
    if (!allowed.has(variantId)) return []
    const count = (value: unknown) => Math.max(0, Math.floor(Number(value) || 0))
    return [{
      variantId,
      impressions: count(row.impressions),
      clicks: count(row.clicks),
      leads: count(row.leads),
      conversions: count(row.conversions),
      revenue: row.revenue === undefined ? undefined : Math.max(0, Number(row.revenue) || 0),
    }]
  })
}

function sanitizeExperiment(
  raw: unknown,
  knownVariants: CreativeVariant[],
  current?: CreativeExperiment
): CreativeExperiment | null {
  if (!raw || typeof raw !== "object") return null
  const row = raw as Partial<CreativeExperiment>
  const known = new Set(knownVariants.map((item) => item.id))
  const variantIds = Array.isArray(row.variantIds)
    ? [...new Set(row.variantIds.filter((item): item is string => typeof item === "string" && known.has(item)))].slice(0, 12)
    : []
  if (variantIds.length < 2) return null
  const name = text(row.name, 120)
  if (!name) return null
  const traffic: Record<string, number> = {}
  for (const id of variantIds) traffic[id] = Math.max(0, Math.min(100, Number(row.traffic?.[id]) || 0))
  const total = Object.values(traffic).reduce((sum, value) => sum + value, 0)
  if (Math.abs(total - 100) > 0.01) return null
  const now = nowIso()
  const status = ["draft", "running", "paused", "completed"].includes(String(row.status))
    ? (row.status as CreativeExperiment["status"])
    : current?.status || "draft"
  const metrics = row.metrics ? sanitizeMetrics(row.metrics, variantIds) : current?.metrics || []
  const next: CreativeExperiment = {
    id: current?.id || text(row.id, 80) || `experiment-${crypto.randomUUID()}`,
    name,
    hypothesis: text(row.hypothesis, 2_000),
    status,
    variantIds,
    traffic,
    audience: text(row.audience, 240),
    operation: text(row.operation, 120),
    primaryMetric: ["ctr", "leads", "conversion", "revenue"].includes(String(row.primaryMetric))
      ? (row.primaryMetric as CreativeExperiment["primaryMetric"])
      : "conversion",
    minimumSample: Math.max(1, Math.min(1_000_000, Math.floor(Number(row.minimumSample) || 100))),
    startAt: text(row.startAt, 40) || current?.startAt,
    endAt: text(row.endAt, 40) || current?.endAt,
    metrics,
    approvedWinnerId:
      row.approvedWinnerId && variantIds.includes(row.approvedWinnerId)
        ? row.approvedWinnerId
        : current?.approvedWinnerId,
    createdAt: current?.createdAt || now,
    updatedAt: now,
  }
  next.suggestedWinnerId = suggestedWinner(next)
  return next
}

export async function handleCreativeApi(
  request: Request,
  kv: KvLike,
  actor: PublicUser,
  context: CreativeContext
) {
  const url = new URL(request.url)
  const catalog = await loadCreativeCatalog(kv)

  if (url.pathname === "/api/creatives" && request.method === "GET") {
    return json({ ok: true, ...catalog })
  }

  if (url.pathname === "/api/creatives" && request.method === "POST") {
    const denied = forbidUnless(actor, "creatives.write")
    if (denied) return denied
    const parsed = await readJsonObject<{
      action?: string
      concept?: unknown
      variant?: unknown
      variantId?: string
    }>(request, 131_072)
    if (!parsed.ok) return json({ error: "Pedido inválido." }, parsed.status)
    if (parsed.value.action === "create-concept") {
      const concept = sanitizeConcept(parsed.value.concept)
      if (!concept) return json({ error: "Nome e tema do conceito são obrigatórios." }, 400)
      await saveCreativeConcepts(kv, [concept])
      await appendAudit(kv, creativeAudit(actor, context, {
        action: "creative_concept.created",
        entityType: "creative_concept",
        entityId: concept.id,
        after: concept,
      }))
      return json({ ok: true, concept }, 201)
    }
    if (parsed.value.action === "create-variant") {
      const variant = sanitizeVariant(parsed.value.variant)
      if (!variant || !catalog.concepts.some((item) => item.id === variant.conceptId)) {
        return json({ error: "Preenche conceito, nome, título, texto e CTA." }, 400)
      }
      await saveCreativeVariants(kv, [variant])
      return json({ ok: true, variant }, 201)
    }
    const source = catalog.variants.find((item) => item.id === parsed.value.variantId)
    if (!source) return json({ error: "Esta variação já não existe." }, 404)
    if (parsed.value.action === "duplicate-variant") {
      const duplicate = sanitizeVariant({
        ...source,
        id: undefined,
        name: `${source.name} · cópia`,
        status: "draft",
        trackingId: undefined,
      })
      if (!duplicate) return json({ error: "Não dupliquei a variação." }, 400)
      await saveCreativeVariants(kv, [duplicate])
      return json({ ok: true, variant: duplicate }, 201)
    }
    if (parsed.value.action === "translate-variant") {
      if (source.language !== "pt-BR") return json({ error: "A tradução automática parte de uma versão em português." }, 409)
      let translated
      try {
        translated = await translateVariantToSpanish(source, context.runtime)
      } catch (error) {
        return json({ error: error instanceof Error ? error.message : "Não traduzi o criativo." }, 400)
      }
      const variant = sanitizeVariant({
        ...source,
        ...translated,
        id: undefined,
        sourceVariantId: source.id,
        name: `${source.name} · ES`,
        language: "es",
        status: "review",
        trackingId: undefined,
      })
      if (!variant) return json({ error: "A tradução ficou incompleta." }, 400)
      await saveCreativeVariants(kv, [variant])
      await appendAudit(kv, creativeAudit(actor, context, {
        action: "creative_variant.translated",
        entityType: "creative_variant",
        entityId: variant.id,
        after: { sourceVariantId: source.id, language: "es", status: "review" },
      }))
      return json({ ok: true, variant }, 201)
    }
    return json({ error: "Acção de criativo inválida." }, 400)
  }

  if (url.pathname === "/api/creatives" && request.method === "PATCH") {
    const denied = forbidUnless(actor, "creatives.write")
    if (denied) return denied
    const parsed = await readJsonObject<{ action?: string; concept?: unknown; variant?: unknown }>(request, 131_072)
    if (!parsed.ok) return json({ error: "Pedido inválido." }, parsed.status)
    if (parsed.value.action === "update-concept") {
      const id = text((parsed.value.concept as { id?: unknown } | undefined)?.id, 80)
      const current = catalog.concepts.find((item) => item.id === id)
      if (!current) return json({ error: "Este conceito já não existe." }, 404)
      const concept = sanitizeConcept(parsed.value.concept, current)
      if (!concept) return json({ error: "Nome e tema são obrigatórios." }, 400)
      await saveCreativeConcepts(kv, [concept])
      return json({ ok: true, concept })
    }
    if (parsed.value.action === "update-variant") {
      const id = text((parsed.value.variant as { id?: unknown } | undefined)?.id, 80)
      const current = catalog.variants.find((item) => item.id === id)
      if (!current) return json({ error: "Esta variação já não existe." }, 404)
      const variant = sanitizeVariant(parsed.value.variant, current)
      if (!variant) return json({ error: "Preenche os campos obrigatórios." }, 400)
      if (variant.status === "approved" && current.status !== "approved") {
        const publishDenied = forbidUnless(actor, "creatives.publish")
        if (publishDenied) return publishDenied
      }
      if (variant.language === "es" && variant.status === "approved") {
        variant.reviewedAt = nowIso()
        variant.reviewedBy = actor.id
      }
      await saveCreativeVariants(kv, [variant])
      await appendAudit(kv, creativeAudit(actor, context, {
        action: "creative_variant.updated",
        entityType: "creative_variant",
        entityId: variant.id,
        before: current,
        after: variant,
      }))
      return json({ ok: true, variant })
    }
    return json({ error: "Acção de criativo inválida." }, 400)
  }

  if (url.pathname === "/api/experiments" && request.method === "GET") {
    return json({ ok: true, experiments: await loadCreativeExperiments(kv) })
  }

  if (url.pathname === "/api/experiments" && request.method === "POST") {
    const denied = forbidUnless(actor, "creatives.write")
    if (denied) return denied
    const parsed = await readJsonObject<{ experiment?: unknown }>(request, 131_072)
    if (!parsed.ok) return json({ error: "Pedido inválido." }, parsed.status)
    const experiment = sanitizeExperiment(parsed.value.experiment, catalog.variants)
    if (!experiment) return json({ error: "Escolhe duas variações e distribui 100% do tráfego." }, 400)
    await saveCreativeExperiments(kv, [experiment])
    return json({ ok: true, experiment }, 201)
  }

  if (url.pathname === "/api/experiments" && request.method === "PATCH") {
    const denied = forbidUnless(actor, "creatives.write")
    if (denied) return denied
    const parsed = await readJsonObject<{ experimentId?: string; experiment?: unknown; metrics?: unknown }>(
      request,
      131_072
    )
    if (!parsed.ok) return json({ error: "Pedido inválido." }, parsed.status)
    const experiments = await loadCreativeExperiments(kv)
    const current = experiments.find((item) => item.id === parsed.value.experimentId)
    if (!current) return json({ error: "Esta experiência já não existe." }, 404)
    const raw = parsed.value.experiment && typeof parsed.value.experiment === "object"
      ? { ...(parsed.value.experiment as Record<string, unknown>), metrics: parsed.value.metrics ?? current.metrics }
      : { ...current, metrics: parsed.value.metrics ?? current.metrics }
    const experiment = sanitizeExperiment(raw, catalog.variants, current)
    if (!experiment) return json({ error: "A experiência ficou inválida." }, 400)
    await saveCreativeExperiments(kv, [experiment])
    await appendAudit(kv, creativeAudit(actor, context, {
      action: "creative_experiment.updated",
      entityType: "creative_experiment",
      entityId: experiment.id,
      before: current,
      after: experiment,
    }))
    return json({ ok: true, experiment })
  }

  return json({ error: "not_found" }, 404)
}
