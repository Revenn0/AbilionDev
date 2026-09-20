import { applyRemovedFunnels, applyRemovedLeads, enforceSinglePublished, publicSettings } from "../src/lib/crm.ts"
import { importFunnel } from "../src/lib/funnel-import.ts"
import { emptySalesFunnel, publishSnapshot } from "../src/lib/templates.ts"
import { firstInvalidPublishUrl, validatePublish } from "../src/lib/validate.ts"
import { cleanBotUsername } from "../src/lib/migrate.ts"
import type { Lead, SalesFunnel } from "../src/lib/types.ts"
import {
  isOwner,
  isValidEmail,
  kvAuthStore,
  normalizeEmail,
  type PublicUser,
} from "./auth.ts"
import { handleTokens, handleUsers } from "./users.ts"
import { listLeadPage, loadFunnelsKv, loadRemovedFunnelIds, loadRemovedLeadIds, loadSettingsKv, lookupLeadsByQuery, saveFunnelsKv } from "./crm-store.ts"
import { readJsonStrict } from "./json-body.ts"
import type { KvLike } from "./kv.ts"

const PROTOCOLS = ["2024-11-05", "2025-03-26"] as const
const SERVER = { name: "abilion", version: "0.1.0" }

type RpcId = string | number | null
type RpcReq = { jsonrpc?: string; id?: RpcId; method?: string; params?: unknown }

type McpEnv = {
  AUTH?: KvLike
  TELEGRAM_BOT_TOKEN?: string
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  })
}

function rpcResult(id: RpcId, result: unknown) {
  return { jsonrpc: "2.0", id, result }
}

function rpcError(id: RpcId, code: number, message: string) {
  return { jsonrpc: "2.0", id, error: { code, message } }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

function str(value: unknown) {
  return typeof value === "string" ? value : ""
}

function compactLead(lead: Lead) {
  return {
    id: lead.id,
    name: lead.name,
    contact: lead.contact,
    channel: lead.channel,
    origin: lead.origin,
    campaign: lead.campaign,
    stage: lead.stage,
    temperature: lead.temperature,
    updatedAt: lead.updatedAt,
  }
}

function compactFunnel(funnel: SalesFunnel) {
  return {
    id: funnel.id,
    name: funnel.name,
    status: funnel.status,
    published: Boolean(funnel.production),
    nodes: funnel.nodes.length,
    edges: funnel.edges.length,
    updatedAt: funnel.updatedAt,
  }
}

const TOOLS = [
  {
    name: "abilion_health",
    description: "Estado público do estúdio: se o bot Telegram já tem username.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "abilion_list_users",
    description: "Lista as contas do estúdio (dono e operadores).",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "abilion_create_user",
    description: "Cria uma conta. Só o dono. A senha fica definida já; o e-mail não é criado no login.",
    inputSchema: {
      type: "object",
      properties: {
        email: { type: "string" },
        name: { type: "string" },
        password: { type: "string", minLength: 6 },
        role: { type: "string", enum: ["owner", "operator"] },
      },
      required: ["email", "password"],
      additionalProperties: false,
    },
  },
  {
    name: "abilion_list_funnels",
    description: "Lista os funis do quadro.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "abilion_get_funnel",
    description: "Devolve um funil completo (nós e arestas).",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
      additionalProperties: false,
    },
  },
  {
    name: "abilion_create_funnel",
    description: "Cria um funil de rascunho com o quadro padrão da Sté.",
    inputSchema: {
      type: "object",
      properties: { name: { type: "string" } },
      additionalProperties: false,
    },
  },
  {
    name: "abilion_import_funnel",
    description: "Importa um funil ManyChat, n8n, Typebot, JSON Abilion ou lista de mensagens. Fica em rascunho, a menos que publish seja true.",
    inputSchema: {
      type: "object",
      properties: {
        payload: {},
        name: { type: "string" },
        publish: { type: "boolean" },
      },
      required: ["payload"],
      additionalProperties: false,
    },
  },
  {
    name: "abilion_publish_funnel",
    description: "Publica um funil. A Sté passa a seguir este quadro.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
      additionalProperties: false,
    },
  },
  {
    name: "abilion_list_leads",
    description: "Lista leads (recorte). Não devolve o histórico completo da conversa.",
    inputSchema: {
      type: "object",
      properties: {
        q: { type: "string" },
        cursor: { type: "string" },
        limit: { type: "number" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "abilion_get_settings",
    description: "Definições públicas do estúdio. Sem tokens nem chat da Ester.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "abilion_create_token",
    description: "Cria um token MCP/API (abn_…) para esta conta. Só aparece uma vez.",
    inputSchema: {
      type: "object",
      properties: { name: { type: "string" } },
      additionalProperties: false,
    },
  },
] as const

async function funnelsOf(env: McpEnv): Promise<SalesFunnel[]> {
  if (!env.AUTH) return []
  return applyRemovedFunnels(await loadFunnelsKv(env.AUTH), await loadRemovedFunnelIds(env.AUTH))
}

async function saveFunnels(env: McpEnv, funnels: SalesFunnel[]) {
  if (!env.AUTH) throw new Error("Auth ainda sem KV.")
  if (!funnels.length) throw new Error("Mantém pelo menos um funil.")
  await saveFunnelsKv(env.AUTH, enforceSinglePublished(funnels.slice(0, 20)))
}

async function publishFunnel(env: McpEnv, id: string) {
  const funnels = await funnelsOf(env)
  const current = funnels.find((item) => item.id === id)
  if (!current) throw new Error("Este funil já não está no CRM.")
  const issue =
    firstInvalidPublishUrl(current.nodes) ?? validatePublish(current.nodes, current.edges)[0]
  if (issue) throw new Error(issue.message)
  const now = new Date().toISOString()
  const next = funnels.map((item) =>
    item.id === id ? { ...item, status: "active" as const, production: publishSnapshot(item), updatedAt: now } : item
  )
  await saveFunnels(env, next)
  return next.find((item) => item.id === id)!
}

async function callHttp(
  request: Request,
  env: McpEnv,
  actor: PublicUser,
  path: string,
  method: string,
  body?: unknown
) {
  if (!env.AUTH) throw new Error("Auth ainda sem KV.")
  const url = new URL(path, request.url)
  const init: RequestInit = {
    method,
    headers: { "content-type": "application/json", authorization: request.headers.get("authorization") || "" },
  }
  if (body !== undefined) init.body = JSON.stringify(body)
  const cookie = request.headers.get("cookie")
  if (cookie) {
    const headers = new Headers(init.headers)
    headers.set("cookie", cookie)
    init.headers = headers
  }
  const req = new Request(url, init)
  const store = kvAuthStore(env.AUTH)
  if (path.startsWith("/api/users")) return handleUsers(req, store, actor)
  if (path.startsWith("/api/tokens")) return handleTokens(req, store, actor)
  throw new Error("rota interna em falta")
}

async function toolResult(request: Request, env: McpEnv, actor: PublicUser, name: string, args: Record<string, unknown>) {
  if (name === "abilion_health") {
    const settings = env.AUTH ? await loadSettingsKv(env.AUTH) : null
    return {
      ok: true,
      telegramBotUsername: cleanBotUsername(settings?.telegramBotUsername),
      telegramBound: Boolean(env.TELEGRAM_BOT_TOKEN),
    }
  }
  if (name === "abilion_list_users") {
    const res = await callHttp(request, env, actor, "/api/users", "GET")
    return await res.json()
  }
  if (name === "abilion_create_user") {
    if (!isOwner(actor)) throw new Error("Só o dono cria contas.")
    const email = normalizeEmail(str(args.email))
    if (!isValidEmail(email)) throw new Error("Informa um e-mail válido.")
    const res = await callHttp(request, env, actor, "/api/users", "POST", {
      email,
      name: str(args.name),
      password: str(args.password),
      role: args.role === "owner" ? "owner" : "operator",
    })
    const data = await res.json()
    if (!res.ok) throw new Error(typeof data === "object" && data && "error" in data ? String((data as { error: string }).error) : "Não criei a conta.")
    return data
  }
  if (name === "abilion_list_funnels") {
    return { ok: true, funnels: (await funnelsOf(env)).map(compactFunnel) }
  }
  if (name === "abilion_get_funnel") {
    const id = str(args.id).trim()
    const funnel = (await funnelsOf(env)).find((item) => item.id === id)
    if (!funnel) throw new Error("Este funil já não está no CRM.")
    return { ok: true, funnel }
  }
  if (name === "abilion_create_funnel") {
    const funnels = await funnelsOf(env)
    if (funnels.length >= 20) throw new Error("O estúdio aceita no máximo 20 funis.")
    const funnel = emptySalesFunnel(clipName(str(args.name), "Novo funil"))
    await saveFunnels(env, [...funnels, funnel])
    return { ok: true, funnel: compactFunnel(funnel), id: funnel.id }
  }
  if (name === "abilion_import_funnel") {
    const imported = importFunnel(args.payload, clipName(str(args.name), "Funil importado"))
    if (!imported.ok) throw new Error(imported.error)
    const funnels = await funnelsOf(env)
    if (funnels.length >= 20) throw new Error("O estúdio aceita no máximo 20 funis.")
    let funnel = imported.funnel
    if (args.publish === true) {
      const issue = firstInvalidPublishUrl(funnel.nodes) ?? validatePublish(funnel.nodes, funnel.edges)[0]
      if (issue) throw new Error(issue.message)
      funnel = { ...funnel, status: "active", production: publishSnapshot(funnel) }
    }
    await saveFunnels(env, [...funnels, funnel])
    return { ok: true, source: imported.source, funnel: compactFunnel(funnel), id: funnel.id }
  }
  if (name === "abilion_publish_funnel") {
    const funnel = await publishFunnel(env, str(args.id).trim())
    return { ok: true, funnel: compactFunnel(funnel) }
  }
  if (name === "abilion_list_leads") {
    if (!env.AUTH) throw new Error("Auth ainda sem KV.")
    const query = str(args.q).trim()
    const removed = await loadRemovedLeadIds(env.AUTH)
    if (query) {
      if (query.length > 80) throw new Error("Busca inválida.")
      const found = await lookupLeadsByQuery(env.AUTH, query)
      return { ok: true, leads: applyRemovedLeads(found, removed).slice(0, 50).map(compactLead) }
    }
    const limit = Math.min(50, Math.max(1, Number(args.limit) || 20))
    const page = await listLeadPage(env.AUTH, limit, "all", str(args.cursor).trim())
    return {
      ok: true,
      leads: applyRemovedLeads(page.leads, removed).map(compactLead),
      nextCursor: page.stale ? undefined : page.nextCursor,
      stale: page.stale || undefined,
    }
  }
  if (name === "abilion_get_settings") {
    if (!env.AUTH) throw new Error("Auth ainda sem KV.")
    return { ok: true, settings: publicSettings(await loadSettingsKv(env.AUTH)) }
  }
  if (name === "abilion_create_token") {
    const res = await callHttp(request, env, actor, "/api/tokens", "POST", { name: str(args.name) || "MCP" })
    const data = await res.json()
    if (!res.ok) throw new Error(typeof data === "object" && data && "error" in data ? String((data as { error: string }).error) : "Não criei o token.")
    return data
  }
  throw new Error(`Ferramenta desconhecida: ${name}`)
}

function clipName(value: string, fallback: string) {
  return value.trim().slice(0, 80) || fallback
}

async function dispatch(request: Request, env: McpEnv, actor: PublicUser, req: RpcReq) {
  const id = req.id ?? null
  const method = req.method || ""
  const params = asRecord(req.params)
  if (req.jsonrpc !== "2.0" || !method) return rpcError(id, -32600, "Pedido JSON-RPC inválido.")
  if (method === "initialize") {
    const asked = str(params.protocolVersion)
    return rpcResult(id, {
      protocolVersion: PROTOCOLS.includes(asked as (typeof PROTOCOLS)[number]) ? asked : "2025-03-26",
      capabilities: { tools: {} },
      serverInfo: SERVER,
    })
  }
  if (method === "ping" || method === "notifications/initialized") return rpcResult(id, {})
  if (method === "tools/list") return rpcResult(id, { tools: TOOLS })
  if (method === "resources/list") return rpcResult(id, { resources: [] })
  if (method === "prompts/list") return rpcResult(id, { prompts: [] })
  if (method === "tools/call") {
    const name = str(params.name)
    const args = asRecord(params.arguments)
    if (!name) return rpcError(id, -32602, "Falta o nome da ferramenta.")
    try {
      const result = await toolResult(request, env, actor, name, args)
      return rpcResult(id, { content: [{ type: "text", text: JSON.stringify(result) }] })
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha na ferramenta."
      return rpcResult(id, { content: [{ type: "text", text: JSON.stringify({ error: message }) }], isError: true })
    }
  }
  return rpcError(id, -32601, `Método ${method} não existe.`)
}

export async function handleMcp(request: Request, env: McpEnv, actor: PublicUser | null) {
  if (request.method === "GET") {
    return json({ ok: true, name: SERVER.name, version: SERVER.version, transport: "jsonrpc" })
  }
  if (request.method !== "POST") return json({ error: "Usa POST JSON-RPC." }, 405)
  if (!actor) return json({ error: "Token MCP em falta. Cria um em Utilizadores." }, 401)
  const parsed = await readJsonStrict(request, 256_000)
  if (!parsed.ok) return json({ error: parsed.status === 413 ? "Pedido demasiado grande." : "JSON inválido." }, parsed.status)
  const payload = parsed.value as unknown
  if (Array.isArray(payload)) {
    const out = []
    for (const item of payload) {
      const req = asRecord(item) as RpcReq
      if (req.id === undefined && typeof req.method === "string" && req.method.startsWith("notifications/")) continue
      out.push(await dispatch(request, env, actor, req))
    }
    return json(out)
  }
  const req = payload as RpcReq
  if (req.id === undefined && typeof req.method === "string" && req.method.startsWith("notifications/")) {
    return new Response(null, { status: 202 })
  }
  return json(await dispatch(request, env, actor, req))
}

export async function handleFunnelImport(request: Request, env: McpEnv) {
  if (!env.AUTH) return json({ error: "Auth ainda sem KV." }, 503)
  const parsed = await readJsonStrict(request, 256_000)
  if (!parsed.ok) return json({ error: parsed.status === 413 ? "Pedido demasiado grande." : "JSON inválido." }, parsed.status)
  const body = asRecord(parsed.value)
  const imported = importFunnel(body.payload ?? body.funnel ?? body, clipName(str(body.name), "Funil importado"))
  if (!imported.ok) return json({ error: imported.error }, 400)
  const funnels = await funnelsOf(env)
  if (funnels.length >= 20) return json({ error: "O estúdio aceita no máximo 20 funis." }, 400)
  let funnel = imported.funnel
  if (body.publish === true) {
    const issue = firstInvalidPublishUrl(funnel.nodes) ?? validatePublish(funnel.nodes, funnel.edges)[0]
    if (issue) return json({ error: issue.message }, 400)
    funnel = { ...funnel, status: "active", production: publishSnapshot(funnel) }
  }
  await saveFunnels(env, [...funnels, funnel])
  return json({ ok: true, source: imported.source, funnel }, 201)
}
