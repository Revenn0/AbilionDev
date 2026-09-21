import { useEffect, useRef, useState } from "react"
import { fetchLeadQuery } from "@/lib/runtime-api"
import { useStore } from "@/lib/store"
import { type RemoteLeadSearchStatus } from "@/lib/lead-search"

export { remoteSearchBlank, type RemoteLeadSearchStatus } from "@/lib/lead-search"

/** Se a lista hidratada já não tem o lead, o Worker procura por id, @user, telefone e nome. */
export function useRemoteLeadSearch(query: string): RemoteLeadSearchStatus {
  const { ingestRemoteLeads, noteEventsUnread } = useStore()
  const ingestRef = useRef(ingestRemoteLeads)
  const noteEventsRef = useRef(noteEventsUnread)
  const [status, setStatus] = useState<RemoteLeadSearchStatus>("idle")

  useEffect(() => {
    ingestRef.current = ingestRemoteLeads
    noteEventsRef.current = noteEventsUnread
  }, [ingestRemoteLeads, noteEventsUnread])

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
        if (result.eventsUnread) noteEventsRef.current()
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
