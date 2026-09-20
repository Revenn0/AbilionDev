export type RemoteLeadSearchStatus = "idle" | "loading" | "ok" | "error"

/** Lista local vazia com busca de 3+ — falha ou debounce não é “nada nesta busca”. */
export function remoteSearchBlank(
  query: string,
  localHits: number,
  status: RemoteLeadSearchStatus
): "hits" | "local" | "loading" | "error" | "empty" {
  if (localHits > 0) return "hits"
  if (query.trim().length < 3) return "local"
  if (status === "error") return "error"
  if (status === "ok") return "empty"
  return "loading"
}
