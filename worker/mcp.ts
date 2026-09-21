import { adoptLeadStores, clipNewestIds, FUNNEL_CAP, publicSettings } from "../src/lib/crm.ts"
import { addLeadCategory, leadCategoriesWriteBlocked, leadFromImport, migrateLeadCategories, parseLeadImportText } from "../src/lib/lead-category.ts"
import { addPageScript, installSettingsBlocked, pageInstallManual, pageScriptById, pageScriptsFunnelUnread, pageScriptsListBlocked, pageScriptsWriteBlocked, PAGE_SCRIPT_REMOVED_CAP, removePageScript } from "../src/lib/page-script.ts"
import { importFunnel } from "../src/lib/funnel-import.ts"
import { emptySalesFunnel, publishSnapshot } from "../src/lib/templates.ts"
import { firstInvalidPublishUrl, validatePublish } from "../src/lib/validate.ts"
import { cleanBotUsername } from "../src/lib/migrate.ts"
import type { Lead, SalesFunnel, Settings } from "../src/lib/types.ts"
import {
  isOwner,
  isValidEmail,
  kvAuthStore,
  normalizeEmail,
  type PublicUser,
} from "./auth.ts"
import { handleTokens, handleUsers } from "./users.ts"
import { filterLiveLeads, importOrAdoptLead, leadPageFromRemote, listLeadPage } from "./crm-store.ts"
import { emptySecrets, loadSecrets, resolveRuntime } from "./runtime-secrets.ts"
import { attachWorkspaceLeadEvents, fetchRemoteLeadPage, fetchRemoteLeadsByIds, fillLeadHoles, findWorkspaceLeadById, leadCatalogUnread, persistRemoteLead, persistWorkspaceFunnels, persistWorkspaceSettings, readWorkspaceFunnels, readWorkspaceSettings, resolveWorkspaceLeadWrite, searchWorkspaceLeads } from "./workspace-settings.ts"
import { readJsonStrict } from "./json-body.ts"
import type { KvLike } from "./kv.ts"

const PROTOCOLS = ["2024-11-05", "2025-03-26"] as const
const SERVER = { name: "abilion", version: "0.1.0" }

type RpcId = string | number | null
type RpcReq = { jsonrpc?: string; id?: RpcId; method?: string; params?: unknown }

type McpEnv = {
  AUTH?: KvLike
  TELEGRAM_BOT_TOKEN?: string
  SUPABASE_URL?: string
  SUPABASE_SERVICE_ROLE?: string
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
    category: lead.category,
    stage: lead.stage,
    temperature: lead.temperature,
    updatedAt: lead.updatedAt,
  }
}

function detailLead(lead: Lead) {
  return {
    ...compactLead(lead),
    lastMessage: lead.lastMessage,
    waitUntil: lead.waitUntil,
    funnelId: lead.funnelId,
    nodeId: lead.nodeId,
    memory: lead.memory,
    telegramChatId: lead.telegramChatId,
    visitorId: lead.visitorId,
    paused: lead.paused,
    printAt: lead.printAt,
    bancaAt: lead.bancaAt,
    messages: lead.messages ?? [],
    events: lead.events ?? [],
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
    name: "abilion_patch_user",
    description: "Desliga, reactiva ou muda o papel de uma conta. Só o dono. Donos iniciais não desligam.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
        disabled: { type: "boolean" },
        role: { type: "string", enum: ["owner", "operator"] },
      },
      required: ["id"],
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
    description: "Lista leads (recorte). q= busca no KV e no Postgres. Página do KV junta o backup pelo id — leftover não tapa a ficha viva. Não devolve o histórico completo da conversa.",
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
    name: "abilion_get_lead",
    description:
      "Devolve uma ficha pelo id (falas e timeline). KV e Postgres juntam-se. Miss no KV + backup em baixo é erro, não «já não está». A lista compacta não substitui isto.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
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
  {
    name: "abilion_revoke_token",
    description: "Revoga um token MCP/API desta conta. O id fica no tombstone do KV e não volta no merge.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
      additionalProperties: false,
    },
  },
  {
    name: "abilion_page_install_manual",
    description:
      "Manual para instalar o pixel numa landing. Passos: 1) publica o funil 2) cria um script (abilion_create_page_script) 3) cola <script src=https://www.abilion.lol/t.js?v=2&s=ID data-cta=[data-abilion-cta]> 4) o anúncio aponta para a landing, não t.me 5) /start fica fb_sID_vid. Sem scriptId devolve o script geral; com scriptId o snippet daquela página/funil.",
    inputSchema: {
      type: "object",
      properties: { scriptId: { type: "string" } },
      additionalProperties: false,
    },
  },
  {
    name: "abilion_list_page_scripts",
    description: "Lista os scripts de página (um por landing/funil) e o snippet de cada um.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "abilion_create_page_script",
    description: "Cria um script para outra página/funil. O funil precisa de um quadro publicado. Devolve o snippet e o manual.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        funnelId: { type: "string" },
        pageUrl: { type: "string" },
      },
      required: ["name", "funnelId"],
      additionalProperties: false,
    },
  },
  {
    name: "abilion_delete_page_script",
    description: "Remove um script de página. As landings que ainda o colam passam a usar o funil publicado.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
      additionalProperties: false,
    },
  },
  {
    name: "abilion_import_leads",
    description: "Importa uma lista (nome, contacto) para o CRM. toGroup=true mete-os na categoria Grupo e no passo group.",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string" },
        category: { type: "string" },
        toGroup: { type: "boolean" },
      },
      required: ["text"],
      additionalProperties: false,
    },
  },
] as const

async function workspaceSettingsOf(env: McpEnv, unread: string) {
  try {
    return await readWorkspaceSettings(env)
  } catch {
    throw new Error(unread)
  }
}

async function workspaceFunnelsOf(env: McpEnv, unread = "Não confirmei os funis.") {
  try {
    return await readWorkspaceFunnels(env)
  } catch {
    throw new Error(unread)
  }
}

async function saveFunnels(env: McpEnv, funnels: SalesFunnel[]) {
  try {
    await persistWorkspaceFunnels(env, funnels)
  } catch (error) {
    const message = error instanceof Error ? error.message : ""
    if (message === "Mantém pelo menos um funil." || message.startsWith("O estúdio aceita no máximo")) throw error
    throw new Error("Não confirmei os funis.")
  }
}

async function saveSettingsOf(env: McpEnv, incoming: Settings, unread: string) {
  try {
    await persistWorkspaceSettings(env, incoming)
  } catch {
    throw new Error(unread)
  }
}

async function publishFunnel(env: McpEnv, id: string) {
  const loaded = await workspaceFunnelsOf(env)
  const current = loaded.funnels.find((item) => item.id === id)
  if (!current) throw new Error(loaded.unread ? "Não confirmei os funis." : "Este funil já não está no CRM.")
  const issue =
    firstInvalidPublishUrl(current.nodes) ?? validatePublish(current.nodes, current.edges)[0]
  if (issue) throw new Error(issue.message)
  const now = new Date().toISOString()
  const next = loaded.funnels.map((item) =>
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
    let loaded = { settings: { telegramBotUsername: "" }, unread: false }
    if (env.AUTH) {
      try {
        loaded = await readWorkspaceSettings(env)
      } catch {
        loaded = { settings: { telegramBotUsername: "" }, unread: true }
      }
    }
    let secrets = emptySecrets()
    if (env.AUTH) {
      try {
        secrets = await loadSecrets(env.AUTH)
      } catch {
        loaded = { ...loaded, unread: true }
      }
    }
    const resolved = resolveRuntime(env, secrets)
    const telegramBotUsername = cleanBotUsername(resolved.telegramBotUsername || loaded.settings.telegramBotUsername)
    return {
      ok: true,
      telegramBotUsername,
      telegramBound: resolved.telegram,
      unread: loaded.unread && !telegramBotUsername ? true : undefined,
    }
  }
  if (name === "abilion_list_users") {
    const res = await callHttp(request, env, actor, "/api/users", "GET")
    const data = await res.json()
    if (!res.ok) throw new Error(typeof data === "object" && data && "error" in data ? String((data as { error: string }).error) : "Não confirmei as contas.")
    return data
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
  if (name === "abilion_patch_user") {
    if (!isOwner(actor)) throw new Error("Só o dono altera contas.")
    const id = str(args.id).trim()
    if (!id) throw new Error("Falta o id da conta.")
    const body: { id: string; disabled?: boolean; role?: "owner" | "operator" } = { id }
    if (typeof args.disabled === "boolean") body.disabled = args.disabled
    if (args.role === "owner" || args.role === "operator") body.role = args.role
    if (body.disabled === undefined && !body.role) throw new Error("Informa disabled ou role.")
    const res = await callHttp(request, env, actor, "/api/users", "PATCH", body)
    const data = await res.json()
    if (!res.ok) throw new Error(typeof data === "object" && data && "error" in data ? String((data as { error: string }).error) : "Não actualizei a conta.")
    return data
  }
  if (name === "abilion_list_funnels") {
    const loaded = await workspaceFunnelsOf(env)
    return { ok: true, funnels: loaded.funnels.map(compactFunnel), unread: loaded.unread || undefined }
  }
  if (name === "abilion_get_funnel") {
    const id = str(args.id).trim()
    const loaded = await workspaceFunnelsOf(env)
    const funnel = loaded.funnels.find((item) => item.id === id)
    if (!funnel) throw new Error(loaded.unread ? "Não confirmei os funis." : "Este funil já não está no CRM.")
    return { ok: true, funnel, unread: loaded.unread || undefined }
  }
  if (name === "abilion_create_funnel") {
    const loaded = await workspaceFunnelsOf(env)
    if (loaded.unread) throw new Error("Não confirmei os funis.")
    const funnels = loaded.funnels
    if (funnels.length >= FUNNEL_CAP) throw new Error(`O estúdio aceita no máximo ${FUNNEL_CAP} funis.`)
    const funnel = emptySalesFunnel(clipName(str(args.name), "Novo funil"))
    await saveFunnels(env, [...funnels, funnel])
    return { ok: true, funnel: compactFunnel(funnel), id: funnel.id }
  }
  if (name === "abilion_import_funnel") {
    const imported = importFunnel(args.payload, clipName(str(args.name), "Funil importado"))
    if (!imported.ok) throw new Error(imported.error)
    const loaded = await workspaceFunnelsOf(env)
    if (loaded.unread) throw new Error("Não confirmei os funis.")
    const funnels = loaded.funnels
    if (funnels.length >= FUNNEL_CAP) throw new Error(`O estúdio aceita no máximo ${FUNNEL_CAP} funis.`)
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
    if (query) {
      if (query.length > 80) throw new Error("Busca inválida.")
      const found = await searchWorkspaceLeads(env, query)
      if (!found.ok) throw new Error("Não li os leads do Postgres.")
      return { ok: true, leads: (await filterLiveLeads(env.AUTH, found.leads)).slice(0, 50).map(compactLead) }
    }
    const limit = Math.min(50, Math.max(1, Number(args.limit) || 20))
    const cursor = str(args.cursor).trim()
    let page
    try {
      page = await listLeadPage(env.AUTH, limit, "all", cursor)
    } catch {
      throw new Error("Não li os leads do Postgres.")
    }
    const missing = page.missingIds ?? []
    if (!page.empty && missing.length && !page.leads.length) {
      const extras = await fetchRemoteLeadsByIds(env, missing)
      if (extras === null && env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE) {
        throw new Error("Não li os leads do Postgres.")
      }
      if (!(extras ?? []).length && page.unread) throw new Error("Não li os leads do Postgres.")
      const live = await filterLiveLeads(env.AUTH, extras ?? [])
      return {
        ok: true,
        leads: live.map(compactLead),
        nextCursor: page.stale ? undefined : page.nextCursor,
        stale: page.stale || undefined,
        clipped: page.clipped === true || missing.some((id) => !live.some((item) => item.id === id)) || undefined,
      }
    }
    if (page.empty || (!page.leads.length && !page.nextCursor)) {
      const remote = await fetchRemoteLeadPage(env, limit, "all", cursor)
      if (remote === null && env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE) {
        throw new Error("Não li os leads do Postgres.")
      }
      const folded = leadPageFromRemote(remote, limit, Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE))
      return {
        ok: true,
        leads: (await filterLiveLeads(env.AUTH, folded.leads)).map(compactLead),
        nextCursor: folded.nextCursor,
        clipped: folded.clipped || (!page.empty && !folded.leads.length) || undefined,
      }
    }
    const filled = await fillLeadHoles(env, page.leads, missing)
    const extras = await fetchRemoteLeadsByIds(env, filled.leads.map((item) => item.id))
    const live = extras ? await filterLiveLeads(env.AUTH, extras) : []
    const merged = adoptLeadStores(filled.leads, live)
    return {
      ok: true,
      leads: (await filterLiveLeads(env.AUTH, merged)).map(compactLead),
      nextCursor: page.stale ? undefined : page.nextCursor,
      stale: page.stale || undefined,
      clipped: page.clipped === true || filled.holesOpen || undefined,
    }
  }
  if (name === "abilion_get_lead") {
    if (!env.AUTH) throw new Error("Auth ainda sem KV.")
    const id = str(args.id).trim()
    if (!id) throw new Error("Falta o id do lead.")
    let lead: Lead | null
    try {
      lead = await findWorkspaceLeadById(env, id)
    } catch {
      throw new Error("Não li o lead do Postgres.")
    }
    if (!lead) throw new Error("Este lead já não está no CRM.")
    const attached = await attachWorkspaceLeadEvents(env, [lead])
    const next = attached.leads[0] ?? lead
    return { ok: true, lead: detailLead(next), eventsUnread: attached.unread || undefined }
  }
  if (name === "abilion_get_settings") {
    if (!env.AUTH) throw new Error("Auth ainda sem KV.")
    const loaded = await workspaceSettingsOf(env, "Não confirmei as definições no Postgres.")
    if (pageScriptsListBlocked(loaded.unread, loaded.settings.pageScripts) && !loaded.settings.telegramBotUsername) {
      throw new Error("Não confirmei as definições no Postgres.")
    }
    return { ok: true, settings: publicSettings(loaded.settings), unread: loaded.unread || undefined }
  }
  if (name === "abilion_create_token") {
    const res = await callHttp(request, env, actor, "/api/tokens", "POST", { name: str(args.name) || "MCP" })
    const data = await res.json()
    if (!res.ok) throw new Error(typeof data === "object" && data && "error" in data ? String((data as { error: string }).error) : "Não criei o token.")
    return data
  }
  if (name === "abilion_revoke_token") {
    const id = str(args.id).trim()
    if (!id) throw new Error("Falta o id do token.")
    const res = await callHttp(request, env, actor, `/api/tokens?id=${encodeURIComponent(id)}`, "DELETE")
    const data = await res.json()
    if (!res.ok) throw new Error(typeof data === "object" && data && "error" in data ? String((data as { error: string }).error) : "Não revoguei o token.")
    return data
  }
  if (name === "abilion_page_install_manual") {
    return installManualOf(env, str(args.scriptId))
  }
  if (name === "abilion_list_page_scripts") {
    if (!env.AUTH) throw new Error("Auth ainda sem KV.")
    const loaded = await workspaceSettingsOf(env, "Não confirmei os scripts desta página.")
    if (pageScriptsListBlocked(loaded.unread, loaded.settings.pageScripts)) {
      throw new Error("Não confirmei os scripts desta página.")
    }
    const boards = await workspaceFunnelsOf(env, "Não confirmei o funil deste script.")
    if (pageScriptsFunnelUnread(boards.unread, loaded.settings.pageScripts, boards.funnels)) {
      throw new Error("Não confirmei o funil deste script.")
    }
    return {
      ok: true,
      scripts: loaded.settings.pageScripts.map((script) => ({
        ...script,
        funnelName: boards.funnels.find((item) => item.id === script.funnelId)?.name,
        ...installManualOfSync(loaded.settings.telegramBotUsername, script, boards.funnels.find((item) => item.id === script.funnelId)?.name),
      })),
      unread: loaded.unread || undefined,
    }
  }
  if (name === "abilion_create_page_script") {
    if (!env.AUTH) throw new Error("Auth ainda sem KV.")
    const boards = await workspaceFunnelsOf(env)
    if (boards.unread) throw new Error("Não confirmei os funis.")
    const funnel = boards.funnels.find((item) => item.id === str(args.funnelId).trim())
    if (!funnel?.production) {
      throw new Error("Publica este funil antes de criar o script da página.")
    }
    const loaded = await workspaceSettingsOf(env, "Não confirmei os scripts desta página.")
    if (pageScriptsWriteBlocked(loaded.unread)) {
      throw new Error("Não confirmei os scripts desta página.")
    }
    const settings = loaded.settings
    const made = addPageScript(
      settings.pageScripts,
      {
        name: clipName(str(args.name), "Landing"),
        funnelId: funnel.id,
        pageUrl: str(args.pageUrl),
      },
      settings.removedPageScripts
    )
    if (!made.ok) throw new Error(made.error)
    await saveSettingsOf(env, { ...settings, pageScripts: made.scripts }, "Não confirmei os scripts desta página.")
    return { ...pageInstallManual({ botUsername: settings.telegramBotUsername, script: made.script, funnelName: funnel.name }), script: made.script }
  }
  if (name === "abilion_delete_page_script") {
    if (!env.AUTH) throw new Error("Auth ainda sem KV.")
    const id = str(args.id).trim()
    if (!id) throw new Error("Falta o id do script.")
    const loaded = await workspaceSettingsOf(env, "Não confirmei o script desta página.")
    const settings = loaded.settings
    const current = pageScriptById(settings.pageScripts, id)
    if (pageScriptsWriteBlocked(loaded.unread) || installSettingsBlocked(loaded.unread, id, current)) {
      throw new Error("Não confirmei o script desta página.")
    }
    const next = removePageScript(settings.pageScripts, id)
    if (next.length === settings.pageScripts.length) throw new Error("Este script já não está no estúdio.")
    await saveSettingsOf(env, {
      ...settings,
      pageScripts: next,
      removedPageScripts: clipNewestIds([...(settings.removedPageScripts ?? []), id], PAGE_SCRIPT_REMOVED_CAP),
    }, "Não confirmei o script desta página.")
    return { ok: true }
  }
  if (name === "abilion_import_leads") {
    if (!env.AUTH) throw new Error("Auth ainda sem KV.")
    const parsed = parseLeadImportText(str(args.text))
    if (parsed.error) throw new Error(parsed.error)
    const loaded = await workspaceSettingsOf(env, "Não confirmei as definições no Postgres.")
    const settings = loaded.settings
    const toGroup = args.toGroup === true
    if (toGroup && loaded.unread && !settings.telegramGroupUrl) {
      throw new Error("Não confirmei o grupo do Telegram.")
    }
    const named = addLeadCategory(settings.leadCategories, str(args.category) || (toGroup ? "Grupo" : ""))
    const category = named.ok ? named.category : ""
    if (named.ok && named.categories.length > migrateLeadCategories(settings.leadCategories).length) {
      if (leadCategoriesWriteBlocked(loaded.unread)) {
        throw new Error("Não confirmei as categorias.")
      }
      await saveSettingsOf(env, { ...settings, leadCategories: named.categories }, "Não confirmei as categorias.")
    }
    if (await leadCatalogUnread(env)) throw new Error("Não li os leads do Postgres.")
    const imported = []
    for (const row of parsed.rows.slice(0, 50)) {
      const lead = leadFromImport(row, { category, toGroup, groupUrl: settings.telegramGroupUrl })
      const resolved = await resolveWorkspaceLeadWrite(env, lead)
      if (!resolved.ok) throw new Error("Não li o lead do Postgres.")
      const saved = await importOrAdoptLead(env.AUTH, resolved.incoming)
      if (!saved) continue
      await persistRemoteLead(env, saved)
      imported.push({ id: saved.id, name: saved.name, contact: saved.contact, category: saved.category, stage: saved.stage })
    }
    return { ok: true, imported: imported.length, leads: imported }
  }
  throw new Error(`Ferramenta desconhecida: ${name}`)
}

async function installManualOf(env: McpEnv, scriptId?: string) {
  if (!env.AUTH) throw new Error("Auth ainda sem KV.")
  try {
    const loaded = await readWorkspaceSettings(env)
    const script = pageScriptById(loaded.settings.pageScripts, scriptId)
    if (installSettingsBlocked(loaded.unread, scriptId, script)) {
      throw new Error("Não confirmei o script desta página.")
    }
    let funnelName: string | undefined
    if (script) {
      try {
        const boards = await readWorkspaceFunnels(env)
        const named = boards.funnels.find((item) => item.id === script.funnelId)
        if (!named && boards.unread) throw new Error("Não confirmei o funil deste script.")
        funnelName = named?.name
      } catch (error) {
        if (error instanceof Error && error.message === "Não confirmei o funil deste script.") throw error
        throw new Error("Não confirmei o funil deste script.")
      }
    }
    return pageInstallManual({ botUsername: loaded.settings.telegramBotUsername, script, funnelName })
  } catch (error) {
    if (error instanceof Error && (error.message === "Não confirmei o script desta página." || error.message === "Não confirmei o funil deste script.")) {
      throw error
    }
    if (installSettingsBlocked(true, scriptId, undefined)) {
      throw new Error("Não confirmei o script desta página.")
    }
    return pageInstallManual({ botUsername: "" })
  }
}

function installManualOfSync(botUsername: string, script: { id: string; name: string; funnelId: string; pageUrl?: string; createdAt: string; updatedAt: string }, funnelName?: string) {
  const manual = pageInstallManual({ botUsername, script, funnelName })
  return { snippet: manual.snippet, landing: manual.landing, start: manual.start }
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
  if (method === "resources/list") {
    return rpcResult(id, {
      resources: [
        {
          uri: "abilion://install",
          name: "Manual de instalação do pixel",
          mimeType: "application/json",
          description: "Os mesmos 5 passos do painel, do t.js e de GET /api/install.",
        },
      ],
    })
  }
  if (method === "resources/read") {
    const uri = str(params.uri)
    if (uri === "abilion://install" || uri.startsWith("abilion://install/")) {
      const scriptId = uri.split("/")[3] || ""
      try {
        const manual = await installManualOf(env, scriptId)
        return rpcResult(id, { contents: [{ uri, mimeType: "application/json", text: JSON.stringify(manual) }] })
      } catch (error) {
        const message = error instanceof Error ? error.message : "Não confirmei o script desta página."
        return rpcError(id, -32603, message)
      }
    }
    return rpcError(id, -32602, "Recurso desconhecido.")
  }
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
    return json({ ok: true, name: SERVER.name, version: SERVER.version, transport: "jsonrpc", install: "/api/install" })
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
  let loaded: { funnels: SalesFunnel[]; unread: boolean }
  try {
    loaded = await readWorkspaceFunnels(env)
  } catch {
    return json({ error: "Não confirmei os funis." }, 503)
  }
  if (loaded.unread) return json({ error: "Não confirmei os funis." }, 503)
  const funnels = loaded.funnels
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
