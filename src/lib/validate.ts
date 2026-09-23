import { cleanHttpUrl } from "./migrate.ts"
import { isFlowKind, type FlowEdge, type FlowNode } from "./types.ts"

export type PublishIssue = { message: string }

export function firstInvalidPublishUrl(nodes: unknown): PublishIssue | undefined {
  if (!Array.isArray(nodes)) return
  for (const node of nodes) {
    if (!node || typeof node !== "object") continue
    const data = "data" in node && node.data && typeof node.data === "object" ? (node.data as { title?: unknown; url?: unknown }) : null
    const url = typeof data?.url === "string" ? data.url : ""
    if (!url.trim() || cleanHttpUrl(url)) continue
    const title = typeof data?.title === "string" && data.title.trim() ? data.title.trim() : "Bloco"
    return { message: `O bloco “${title}” tem um link inválido. Usa http ou https.` }
  }
}

export function validatePublish(nodes: FlowNode[], edges: FlowEdge[]): PublishIssue[] {
  const issues: PublishIssue[] = []
  const urlIssue = firstInvalidPublishUrl(nodes)
  if (urlIssue) issues.push(urlIssue)
  const flow = nodes.filter((node) => isFlowKind(node.type))
  const entries = flow.filter((node) => node.type === "entry")
  if (entries.length === 0) {
    issues.push({ message: "Publica pelo menos uma entrada (popup, join ou /start)." })
  }

  const outs = new Map<string, FlowEdge[]>()
  for (const edge of edges) {
    const list = outs.get(edge.source) ?? []
    list.push(edge)
    outs.set(edge.source, list)
  }

  for (const node of flow) {
    const outgoing = outs.get(node.id) ?? []
    if (node.type === "bot") {
      const policy = node.data.botPolicy
      if (!policy?.botId || !policy.brainVersionId) {
        issues.push({ message: `O bloco “${node.data.title}” precisa de bot e versão do Cérebro.` })
      }
      if (!policy?.instruction.trim()) {
        issues.push({ message: `O bloco “${node.data.title}” precisa de uma instrução.` })
      }
      if (!outgoing.length) {
        issues.push({ message: `O bloco “${node.data.title}” precisa de pelo menos uma saída.` })
      }
      for (const branch of policy?.outputBranches ?? []) {
        if (branch === "next") continue
        if (!outgoing.some((edge) => edge.sourceHandle === branch)) {
          issues.push({ message: `O bloco “${node.data.title}” não tem a saída “${branch}”.` })
        }
      }
    }
    if (node.type === "audio" && !node.data.body?.trim()) {
      issues.push({ message: `O bloco “${node.data.title}” precisa do roteiro do áudio.` })
    }
    if (
      node.type === "webhook" &&
      (!node.data.url?.trim().toLowerCase().startsWith("https://") || !cleanHttpUrl(node.data.url))
    ) {
      issues.push({ message: `O bloco “${node.data.title}” precisa de um URL HTTPS válido.` })
    }
    if (node.type === "condition") {
      if (!outgoing.some((edge) => edge.sourceHandle === "yes")) {
        issues.push({ message: `Condição “${node.data.title}” precisa do ramo Sim.` })
      }
    } else if (
      node.type !== "offer" &&
      node.type !== "bot" &&
      outgoing.length === 0 &&
      node.type !== "handoff" &&
      node.type !== "human" &&
      node.type !== "intake" &&
      !node.data.dieAfter &&
      !node.data.steLine
    ) {
      issues.push({ message: `O bloco “${node.data.title}” não liga a nenhum passo.` })
    }
  }

  const byId = new Map(nodes.map((node) => [node.id, node]))

  for (const entry of entries) {
    const seen = new Set<string>()
    const queue = [entry.id]
    let ended = false
    while (queue.length) {
      const id = queue.shift()!
      if (seen.has(id)) continue
      seen.add(id)
      const node = byId.get(id)
      if (!node) continue
      const outgoing = outs.get(id) ?? []
      if (outgoing.length === 0) {
        ended = true
        continue
      }
      for (const edge of outgoing) queue.push(edge.target)
    }
    if (!ended) {
      issues.push({ message: `A entrada “${entry.data.title}” não chega a um fim (oferta ou espera).` })
    }
  }

  for (const node of flow.filter((item) => item.type === "notify")) {
    if (!canReachFromPrint(node.id, nodes, edges)) {
      issues.push({
        message: `“${node.data.title}” avisa a Ester sem passar por uma condição de print.`,
      })
    }
  }

  return issues
}

function canReachFromPrint(notifyId: string, nodes: FlowNode[], edges: FlowEdge[]) {
  const incoming = new Map<string, string[]>()
  for (const edge of edges) {
    const list = incoming.get(edge.target) ?? []
    list.push(edge.source)
    incoming.set(edge.target, list)
  }
  const seen = new Set<string>()
  const queue = [...(incoming.get(notifyId) ?? [])]
  while (queue.length) {
    const id = queue.shift()!
    if (seen.has(id)) continue
    seen.add(id)
    const node = nodes.find((item) => item.id === id)
    if (node?.type === "condition" && (node.data.conditionKind ?? "print") === "print") return true
    for (const prev of incoming.get(id) ?? []) queue.push(prev)
  }
  return false
}
