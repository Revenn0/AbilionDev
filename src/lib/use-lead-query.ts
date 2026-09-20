import { useEffect, useRef, useState } from "react"
import { fetchLeadQuery } from "@/lib/runtime-api"
import { useStore } from "@/lib/store"
import { type RemoteLeadSearchStatus } from "@/lib/lead-search"

export { remoteSearchBlank, type RemoteLeadSearchStatus } from "@/lib/lead-search"

/** Se a lista hidratada já não tem o lead, o Worker procura por id, @user, telefone e nome. */
export function useRemoteLeadSearch(query: string): RemoteLeadSearchStatus {
  const { ingestRemoteLeads } = useStore()
  const ingestRef = useRef(ingestRemoteLeads)
  const [status, setStatus] = useState<RemoteLeadSearchStatus>("idle")

  useEffect(() => {
    ingestRef.current = ingestRemoteLeads
  }, [ingestRemoteLeads])

  useEffect(() => {
    const needle = query.trim()
    if (needle.length < 3) {
      setStatus("idle")
      return
    }
    setStatus("loading")
    let cancelled = false
    const timer = window.setTimeout(() => {
      void fetchLeadQuery(needle).then((result) => {
        if (cancelled) return
        if (!result.ok) {
          setStatus("error")
          return
        }
        if (result.leads.length) ingestRef.current(result.leads)
        setStatus("ok")
      })
    }, 400)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [query])

  return status
}
