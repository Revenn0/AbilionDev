import type { BotNodePolicy, FlowBranchRule } from "./platform.ts"
import { LEGACY_BOT_ID, LEGACY_BRAIN_ID } from "./platform.ts"
import { applyBotResult, applyEvent, type RuntimeEvent } from "./runtime.ts"
import {
  STE_CLOSE,
  STE_LISTEN_REASK,
  STE_SUPERBET_OK,
} from "./ste.ts"
import type { FlowEdge, FlowNode, Lead, SalesFunnel, SalesSnapshot } from "./types.ts"
import { uid } from "./format.ts"

const BOUND_KINDS = ["bot", "human", "approve", "audio", "webhook", "talk", "file", "intake"] as const

export function isFlowBound(snapshot: Pick<SalesSnapshot, "nodes"> | null | undefined) {
  return Boolean(snapshot?.nodes.some((node) => (BOUND_KINDS as readonly string[]).includes(node.type)))
}

export function matchFlowBranch(rules: FlowBranchRule[] | undefined, incoming: string) {
  const text = incoming.trim()
  if (!text || !rules?.length) return ""
  for (const rule of rules) {
    const source = rule.match.trim()
    const branch = rule.branch.trim()
    if (!source || !branch) continue
    try {
      if (new RegExp(source, "i").test(text)) return branch
    } catch {
      if (text.toLowerCase().includes(source.toLowerCase())) return branch
    }
  }
  return ""
}

function lineOf(nodes: FlowNode[], line: string) {
  return nodes.find((node) => node.data.steLine === line)
}

function bubbleJoin(nodes: FlowNode[], line: string, fallback: string) {
  const bodies = nodes
    .filter((node) => node.data.steLine === line)
    .sort((a, b) => a.position.x - b.position.x || a.position.y - b.position.y)
    .map((node) => node.data.body?.trim() || "")
    .filter(Boolean)
  return bodies.length ? bodies.join("\n") : fallback
}

function policy(rules: FlowBranchRule[], branches: string[]): BotNodePolicy {
  return {
    botId: LEGACY_BOT_ID,
    brainVersionId: LEGACY_BRAIN_ID,
    instruction:
      "Este passo só escolhe uma saída desenhada no fluxo. Não inventes produto, link nem fase. Se nenhuma regra casar, usa o texto de reserva deste bloco e fica aqui.",
    mode: "decide",
    runWhen: "message",
    language: "pt-BR",
    contextFields: ["name", "lastMessage", "facts"],
    allowedActions: ["reply"],
    outputBranches: branches,
    branchRules: rules,
    readLeadMemory: true,
    writeLeadMemory: false,
    timeoutSeconds: 20,
    retries: 0,
  }
}

export function upgradeFidelityGraph(funnelId: string, nodes: FlowNode[], edges: FlowEdge[]) {
  if (nodes.some((node) => node.type === "talk" || node.type === "file" || node.type === "intake")) {
    return { nodes, edges }
  }
  if (!nodes.some((node) => node.type === "handoff")) return { nodes, edges }
  if (!nodes.some((node) => node.data.steLine === "welcome")) return { nodes, edges }

  const speaking = new Set(["course", "superbet", "rescue", "offer", "lives"])
  const source = nodes.map((node) =>
    node.data.steLine && speaking.has(node.data.steLine) ? { ...node, data: { ...node.data, steLine: undefined } } : node
  )
  const talkId = `talk:${funnelId}`.slice(0, 80)
  const aiId = `ai:${funnelId}`.slice(0, 80)
  const fileId = `file:${funnelId}`.slice(0, 80)
  const intakeId = `intake:${funnelId}`.slice(0, 80)
  const closeId = `close:${funnelId}`.slice(0, 80)
  const cpfId = `cpf:${funnelId}`.slice(0, 80)
  const okId = `ok:${funnelId}`.slice(0, 80)
  const rules: FlowBranchRule[] = [
    { match: "vai se f|\\bvsf\\b|\\bfdp\\b|filho da|sua m[aã]e|\\bidiota\\b|\\bimbecil\\b|arrombado|cala a boca", branch: "fechar" },
    { match: "print|screenshot|foto do cadastro", branch: "leitura" },
    { match: "\\bcpf\\b", branch: "cpf" },
    { match: "live|hor[aá]rio", branch: "lives" },
    { match: "premium|checkout|quanto custa|quero o app|\\bapp\\b", branch: "oferta" },
    { match: "j[aá] tenho conta|cadastrei|conta feita", branch: "superbet" },
    { match: "n[aã]o tenho conta|sem conta", branch: "superbet" },
    { match: "ainda n[aã]o|n[aã]o consegui", branch: "resgate" },
    { match: "come[cç]ando|perdendo|preju[ií]zo|queimando", branch: "curso" },
    { match: "\\barquivo\\b|\\bpdf\\b|planilha", branch: "arquivo" },
  ]
  const branches = ["curso", "superbet", "resgate", "oferta", "lives", "fechar", "arquivo", "leitura", "cpf"]
  const added: FlowNode[] = [
    {
      id: talkId,
      type: "talk",
      position: { x: 1160, y: -80 },
      data: {
        title: "Iniciar conversa",
        body: bubbleJoin(nodes, "welcome", "Opa, seja muito bem-vindo! Aqui é a Sté."),
      },
    },
    {
      id: aiId,
      type: "bot",
      position: { x: 1560, y: -80 },
      data: {
        title: "IA iniciado",
        body: STE_LISTEN_REASK,
        botPolicy: policy(rules, branches),
      },
    },
    {
      id: fileId,
      type: "file",
      position: { x: 1960, y: -80 },
      data: {
        title: "Envio de arquivo",
        body: "Segue o arquivo deste passo.",
        fileName: "material.pdf",
        url: "",
      },
    },
    {
      id: intakeId,
      type: "intake",
      position: { x: 1960, y: 80 },
      data: { title: "Leitura de arquivo", body: "Espera o print ou o arquivo do lead." },
    },
    {
      id: closeId,
      type: "message",
      position: { x: 2360, y: -80 },
      data: { title: "Encerrar", body: STE_CLOSE, dieAfter: true },
    },
    {
      id: cpfId,
      type: "message",
      position: { x: 2360, y: 80 },
      data: {
        title: "Ajuda no CPF",
        body: "No CPF, digita os 11 números sem ponto. Se a tela recusar, espera um minuto e tenta de novo — e me manda o print.",
      },
    },
    {
      id: okId,
      type: "message",
      position: { x: 2360, y: 220 },
      data: { title: "Conta confirmada", body: STE_SUPERBET_OK },
    },
  ]

  const branchTarget: Record<string, string> = {
    curso: lineOf(nodes, "course")?.id || aiId,
    superbet: lineOf(nodes, "superbet")?.id || aiId,
    resgate: lineOf(nodes, "rescue")?.id || aiId,
    oferta: lineOf(nodes, "offer")?.id || aiId,
    lives: lineOf(nodes, "lives")?.id || aiId,
    fechar: closeId,
    arquivo: fileId,
    leitura: intakeId,
    cpf: cpfId,
  }
  const scriptIds = new Set(
    ["course", "superbet", "rescue", "offer", "lives"]
      .map((line) => lineOf(nodes, line)?.id)
      .filter((id): id is string => Boolean(id))
  )
  scriptIds.add(closeId)
  scriptIds.add(cpfId)
  scriptIds.add(okId)

  let nextEdges = edges.filter((edge) => !scriptIds.has(edge.source))
  const start = source.find((node) => node.type === "entry" && node.data.entryTrigger === "start")
  if (start) {
    let redirected = false
    nextEdges = nextEdges.map((edge) => {
      if (edge.source !== start.id) return edge
      redirected = true
      return { ...edge, target: talkId, sourceHandle: undefined }
    })
    if (!redirected) {
      nextEdges.push({ id: `fid:${funnelId}:start`, source: start.id, target: talkId })
    }
  }
  nextEdges.push(
    { id: `fid:${funnelId}:talk`, source: talkId, target: aiId },
    { id: `fid:${funnelId}:file-back`, source: fileId, target: aiId },
    { id: `fid:${funnelId}:intake-yes`, source: intakeId, target: okId, sourceHandle: "yes" },
    { id: `fid:${funnelId}:intake-no`, source: intakeId, target: aiId, sourceHandle: "no" }
  )
  for (const [branch, target] of Object.entries(branchTarget)) {
    nextEdges.push({ id: `fid:${funnelId}:${branch}`, source: aiId, target, sourceHandle: branch })
  }
  for (const id of scriptIds) {
    if (id === closeId) continue
    nextEdges.push({ id: `fid:${funnelId}:back:${id}`, source: id, target: aiId })
  }

  return { nodes: [...source, ...added], edges: nextEdges }
}

export function upgradeFidelityFunnel(funnel: SalesFunnel): SalesFunnel {
  const draft = upgradeFidelityGraph(funnel.id, funnel.nodes, funnel.edges)
  const production = funnel.production
    ? {
        ...funnel.production,
        ...upgradeFidelityGraph(funnel.id, funnel.production.nodes, funnel.production.edges),
      }
    : funnel.production
  return { ...funnel, nodes: draft.nodes, edges: draft.edges, production }
}

export function playFlow(snapshot: SalesSnapshot, lead: Lead, event: RuntimeEvent, now = Date.now()) {
  let current = lead
  if ((event.type === "message" || event.type === "file") && event.text?.trim()) {
    const text = event.text.trim()
    const last = current.messages.at(-1)
    if (!(last?.role === "lead" && last.text === text)) {
      current = {
        ...current,
        messages: [...current.messages, { id: uid(), at: new Date(now).toISOString(), role: "lead", text }],
        lastMessage: text.slice(0, 400),
      }
    }
  }
  let result = applyEvent(snapshot, current, event, now)
  let guard = 0
  while (guard < 6) {
    guard += 1
    const invoke = result.effects.find((item) => item.kind === "invoke_bot")
    if (!invoke || invoke.kind !== "invoke_bot") break
    const node = snapshot.nodes.find((item) => item.id === invoke.nodeId)
    const incoming =
      event.type === "message" || event.type === "file" ? event.text || "" : current.messages.filter((item) => item.role === "lead").at(-1)?.text || ""
    const branch = matchFlowBranch(node?.data.botPolicy?.branchRules, incoming)
    if (branch) {
      result = applyBotResult(snapshot, result.lead, { nodeId: invoke.nodeId, text: "", branch }, now)
      continue
    }
    if (invoke.policy.mode === "decide") {
      result = applyBotResult(snapshot, result.lead, { nodeId: invoke.nodeId, text: node?.data.body?.trim() || "", branch: "stay" }, now)
      break
    }
    break
  }
  return result
}
