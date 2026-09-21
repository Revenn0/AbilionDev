import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { loginRequest, logoutRequest, meRequest } from "@/lib/auth-api"
import { clearSessionExpired, noteSessionExpired, subscribeSessionExpired } from "@/lib/session"
import { toast } from "sonner"
import {
  activatePublishedFunnels,
  adoptHydrateSettings,
  adoptOperatorLead,
  applyRemovedFunnels,
  applyRemovedLeads,
  leadsStillOnRemote,
  canCreateFunnel,
  canDeleteFunnel,
  cacheLeadsForStorage,
  canFlushCrm,
  clipNewestIds,
  clipRemovedIds,
  FUNNEL_REMOVED_CAP,
  hydrateFunnels,
  INBOX_LIST_PAGES,
  LEAD_REMOVED_CAP,
  hydrateLeads,
  leftoverPendingFunnelIds,
  leadPersistSync,
  mergeLeads,
  overlayPendingLeads,
  remapAdoptedLeads,
  revertPublishedFunnels,
  pendingSeedFunnelIds,
  recoverPendingFunnelIds,
  settingsWriteFingerprint,
} from "@/lib/crm"
import { sameLeadContact } from "@/lib/capture"
import { migrateFunnel, migrateLead, migrateSettings } from "@/lib/migrate"
import { fetchCrm, fetchInbox, fetchLeads, fetchRuntime, persistLeads, removeRemoteLead, saveCrm } from "@/lib/runtime-api"
import { seededOperation } from "@/lib/templates"
import { defaultSettings, type AppState, type Lead, type SalesFunnel, type Settings, type User } from "@/lib/types"

const KEY = "abilion.dev.v2"
const LEGACY = "abilion.dev.v1"
const SESSION = "abilion.dev.session"
const REMOVED_LEADS = "abilion.dev.removed-leads"
const REMOVED_FUNNELS = "abilion.dev.removed-funnels"
const PENDING_LEADS = "abilion.dev.pending-leads"
const PENDING_FUNNELS = "abilion.dev.pending-funnels"
const PENDING_SETTINGS = "abilion.dev.pending-settings"

const empty: AppState = {
  user: null,
  funnels: [],
  leads: [],
  settings: defaultSettings,
}

function readState(): AppState {
  try {
    const raw = localStorage.getItem(KEY) ?? localStorage.getItem(LEGACY)
    if (!raw) return empty
    const parsed = JSON.parse(raw) as Partial<AppState>
    return {
      user: parsed.user ?? null,
      funnels: Array.isArray(parsed.funnels) ? parsed.funnels.map(migrateFunnel) : [],
      leads: Array.isArray(parsed.leads) ? parsed.leads.map((lead) => migrateLead(lead as Lead)) : [],
      settings: migrateSettings({ ...parsed.settings, telegramBotToken: "" }),
    }
  } catch {
    return empty
  }
}

function readUser(): User | null {
  try {
    const raw = localStorage.getItem(SESSION)
    return raw ? (JSON.parse(raw) as User) : null
  } catch {
    return null
  }
}

function withSeed(state: AppState, firstVisit: boolean): AppState {
  if (state.funnels.length > 0 || !firstVisit) return state
  return { ...state, funnels: [seededOperation()] }
}

function loadIdSet(key: string, cap = FUNNEL_REMOVED_CAP): Set<string> {
  try {
    return new Set(clipRemovedIds(JSON.parse(localStorage.getItem(key) || "[]"), cap))
  } catch {
    return new Set()
  }
}

function persistIdSet(key: string, ids: Set<string>, cap = FUNNEL_REMOVED_CAP) {
  try {
    localStorage.setItem(key, JSON.stringify(clipNewestIds(ids, cap)))
  } catch {
    /* quota */
  }
}

function loadFlag(key: string) {
  try {
    return localStorage.getItem(key) === "1"
  } catch {
    return false
  }
}

function persistFlag(key: string, on: boolean) {
  try {
    if (on) localStorage.setItem(key, "1")
    else localStorage.removeItem(key)
  } catch {
    /* quota */
  }
}

function bootState(): AppState {
  const firstVisit = !localStorage.getItem(KEY) && !localStorage.getItem(LEGACY)
  const saved = withSeed(readState(), firstVisit)
  saved.user = readUser()
  return {
    ...saved,
    leads: applyRemovedLeads(saved.leads, loadIdSet(REMOVED_LEADS, LEAD_REMOVED_CAP)),
    funnels: applyRemovedFunnels(saved.funnels, [...loadIdSet(REMOVED_FUNNELS)]),
  }
}

function bootSession() {
  const state = bootState()
  const pendingLeadIds = loadIdSet(PENDING_LEADS)
  const pendingLeads = new Map<string, Lead>()
  for (const lead of state.leads) {
    if (pendingLeadIds.has(lead.id)) pendingLeads.set(lead.id, lead)
  }
  return { state, pendingLeads, pendingFunnels: loadIdSet(PENDING_FUNNELS) }
}

type SyncState = "idle" | "ok" | "error"

type Store = {
  ready: boolean
  remote: "off" | "local" | "cloud"
  crmSync: SyncState
  inboxSync: SyncState
  persistSync: SyncState
  sessionSync: SyncState
  state: AppState
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  createFunnel: (funnel: SalesFunnel) => void
  saveFunnel: (funnel: SalesFunnel) => void
  flushCrmNow: () => Promise<{ ok: boolean; error?: string; queued?: boolean }>
  flushLeadNow: () => Promise<boolean>
  retryHydrate: () => Promise<void>
  deleteFunnel: (id: string) => Promise<boolean>
  createLead: (lead: Lead) => Promise<boolean>
  createLeads: (leads: Lead[]) => Promise<boolean>
  saveLead: (lead: Lead) => void
  ingestRemoteLeads: (leads: Lead[]) => void
  deleteLead: (id: string) => Promise<boolean>
  saveSettings: (patch: Partial<Settings>) => void
}

const StoreContext = createContext<Store | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [remote, setRemote] = useState<Store["remote"]>("local")
  const [crmSync, setCrmSync] = useState<SyncState>("idle")
  const [inboxSync, setInboxSync] = useState<SyncState>("idle")
  const [persistSync, setPersistSync] = useState<SyncState>("idle")
  const [sessionSync, setSessionSync] = useState<SyncState>("idle")
  const session = useState(bootSession)[0]
  const [state, setState] = useState(session.state)
  const persistTimer = useRef(0)
  const crmTimer = useRef(0)
  const leadWriteTimer = useRef(0)
  const pendingLeadWrites = useRef(session.pendingLeads)
  const pendingFunnelIds = useRef(session.pendingFunnels)
  const removedFunnelIds = useRef(loadIdSet(REMOVED_FUNNELS))
  const removedLeadIds = useRef(loadIdSet(REMOVED_LEADS, LEAD_REMOVED_CAP))
  const crmHydrated = useRef(false)
  const leadReadKnown = useRef(false)
  const lastLeadReadOk = useRef(false)
  const lastLeadWriteOk = useRef(true)
  const settingsDirty = useRef(loadFlag(PENDING_SETTINGS))
  const lastGoodFunnels = useRef<SalesFunnel[]>([])
  const stateRef = useRef(state)
  const leadFlushRef = useRef(Promise.resolve(true))
  const crmFlushRef = useRef(Promise.resolve<{ ok: boolean; error?: string; queued?: boolean }>({ ok: true }))
  const hydrateLock = useRef<Promise<void> | null>(null)

  const resetLeadPersist = () => {
    leadReadKnown.current = false
    lastLeadReadOk.current = false
    lastLeadWriteOk.current = true
    setPersistSync("idle")
  }

  const settleLeadPersist = () => {
    setPersistSync(
      leadPersistSync({
        readKnown: leadReadKnown.current,
        readOk: lastLeadReadOk.current,
        pendingWrites: pendingLeadWrites.current.size,
        writeOk: lastLeadWriteOk.current,
      })
    )
  }

  const markLeadRead = (ok: boolean) => {
    leadReadKnown.current = true
    lastLeadReadOk.current = ok
  }

  const ingestRemoteRemoved = (ids: string[] | undefined) => {
    if (!ids?.length) return
    let changed = false
    for (const id of ids) {
      const next = id.trim()
      if (!next || removedLeadIds.current.has(next)) continue
      removedLeadIds.current.add(next)
      changed = true
    }
    if (changed) persistIdSet(REMOVED_LEADS, removedLeadIds.current, LEAD_REMOVED_CAP)
  }

  const flushLeadWrites = (opts?: { keepalive?: boolean }): Promise<boolean> => {
    window.clearTimeout(leadWriteTimer.current)
    const run = async (): Promise<boolean> => {
      for (const id of [...pendingLeadWrites.current.keys()]) {
        if (removedLeadIds.current.has(id)) pendingLeadWrites.current.delete(id)
      }
      persistIdSet(PENDING_LEADS, new Set(pendingLeadWrites.current.keys()))
      const batch = [...pendingLeadWrites.current.values()]
      if (!batch.length) {
        lastLeadWriteOk.current = true
        settleLeadPersist()
        return true
      }
      const result = await persistLeads(batch, opts)
      const savedIds = new Set(result.ids)
      const adopted = result.adopted ?? {}
      const sent = batch.filter((lead) => savedIds.has(lead.id))
      const raced = sent.filter((lead) => removedLeadIds.current.has(lead.id))
      if (raced.length) await Promise.all(raced.map((lead) => removeRemoteLead(lead.id)))
      for (const lead of sent) {
        if (removedLeadIds.current.has(lead.id)) continue
        const latest = pendingLeadWrites.current.get(lead.id)
        if (latest && latest.updatedAt === lead.updatedAt) pendingLeadWrites.current.delete(lead.id)
      }
      for (const [from, to] of Object.entries(adopted)) {
        const pending = pendingLeadWrites.current.get(from)
        pendingLeadWrites.current.delete(from)
        if (pending && !removedLeadIds.current.has(from) && !removedLeadIds.current.has(to)) {
          pendingLeadWrites.current.set(to, { ...pending, id: to })
        }
      }
      if (Object.keys(adopted).length) {
        commitState({
          ...stateRef.current,
          leads: remapAdoptedLeads(stateRef.current.leads, adopted),
        })
      }
      persistIdSet(PENDING_LEADS, new Set(pendingLeadWrites.current.keys()))
      persistIdSet(REMOVED_LEADS, removedLeadIds.current, LEAD_REMOVED_CAP)
      const complete = batch.every((lead) => savedIds.has(lead.id) || removedLeadIds.current.has(lead.id))
      lastLeadWriteOk.current = result.ok && complete
      settleLeadPersist()
      return result.ok && complete
    }
    const pending = leadFlushRef.current.then(run, run)
    leadFlushRef.current = pending.then(
      () => true,
      () => false
    )
    return pending
  }

  const flushRemovedLeads = (ids: string[]) => {
    const batch = ids.filter((id) => id && removedLeadIds.current.has(id)).slice(0, 40)
    if (!batch.length) return Promise.resolve(true)
    return Promise.all(batch.map((id) => removeRemoteLead(id))).then((results) => {
      const ok = results.every(Boolean)
      lastLeadWriteOk.current = ok
      settleLeadPersist()
      return ok
    })
  }

  const queueLeadWrite = (lead: Lead) => {
    if (removedLeadIds.current.has(lead.id)) return
    pendingLeadWrites.current.set(lead.id, lead)
    persistIdSet(PENDING_LEADS, new Set(pendingLeadWrites.current.keys()))
    window.clearTimeout(leadWriteTimer.current)
    leadWriteTimer.current = window.setTimeout(flushLeadWrites, 400)
  }

  useEffect(() => {
    stateRef.current = state
  }, [state])

  const commitState = (next: AppState) => {
    stateRef.current = next
    setState(next)
  }

  const flushCrm = (opts?: { silent?: boolean; keepalive?: boolean }): Promise<{ ok: boolean; error?: string; queued?: boolean }> => {
    window.clearTimeout(crmTimer.current)
    const run = async (): Promise<{ ok: boolean; error?: string; queued?: boolean }> => {
      const current = stateRef.current
      if (!current.user) return { ok: false, error: "Sessão expirada." }
      if (!canFlushCrm(crmHydrated.current)) return { ok: true, queued: true }
      const sentRemoved = [...removedFunnelIds.current]
      const sentSettings = settingsWriteFingerprint(current.settings)
      const result = await saveCrm(
        {
          funnels: current.funnels,
          settings: { ...current.settings, telegramBotToken: "" },
          removedFunnelIds: sentRemoved,
        },
        { keepalive: opts?.keepalive }
      )
      if (result.ok) {
        for (const id of sentRemoved) {
          if (!stateRef.current.funnels.some((item) => item.id === id)) removedFunnelIds.current.delete(id)
        }
        persistIdSet(REMOVED_FUNNELS, removedFunnelIds.current)
        const leftover = leftoverPendingFunnelIds(pendingFunnelIds.current, current.funnels, stateRef.current.funnels)
        pendingFunnelIds.current.clear()
        for (const id of leftover) pendingFunnelIds.current.add(id)
        persistIdSet(PENDING_FUNNELS, pendingFunnelIds.current)
        lastGoodFunnels.current = applyRemovedFunnels(current.funnels, sentRemoved)
        if (settingsWriteFingerprint(stateRef.current.settings) === sentSettings) {
          settingsDirty.current = false
          persistFlag(PENDING_SETTINGS, false)
        }
        if (pendingFunnelIds.current.size || removedFunnelIds.current.size || settingsDirty.current) pushWorker()
      } else {
        const reverted = revertPublishedFunnels(stateRef.current.funnels, lastGoodFunnels.current)
        if (reverted !== stateRef.current.funnels) {
          setState((prev) => {
            const next = { ...prev, funnels: reverted }
            stateRef.current = next
            return next
          })
        }
        if (!opts?.silent) toast.error(result.error || "Não gravei o CRM no Worker.")
      }
      setCrmSync(result.ok ? "ok" : "error")
      return result
    }
    const pending = crmFlushRef.current.then(run, run)
    crmFlushRef.current = pending.then(
      (result) => result,
      () => ({ ok: false, error: "Não gravei o CRM no Worker." })
    )
    return pending
  }

  const pushWorker = () => {
    window.clearTimeout(crmTimer.current)
    crmTimer.current = window.setTimeout(flushCrm, 400)
  }

  const runHydrate = (force = false) => {
    if (!force && crmHydrated.current) return Promise.resolve()
    if (hydrateLock.current) return hydrateLock.current
    const pending = Promise.all([fetchCrm(), fetchRuntime(), fetchLeads(), fetchInbox(INBOX_LIST_PAGES)]).then(
      ([crm, runtime, remoteLeads, inbox]) => {
      setCrmSync(crm.ok ? "ok" : "error")
      markLeadRead(remoteLeads.ok)
      if (remoteLeads.ok) ingestRemoteRemoved(remoteLeads.removed)
      if (inbox.ok) ingestRemoteRemoved(inbox.removed)
      setInboxSync(inbox.ok ? "ok" : "error")
      setRemote(runtime.persist === "supabase" ? "cloud" : runtime.ok ? "local" : "off")
      setState((prev) => {
        const remoteFunnels = crm.ok ? crm.funnels.map(migrateFunnel) : []
        const funnels = crm.ok
          ? hydrateFunnels(prev.funnels, remoteFunnels, pendingFunnelIds.current, removedFunnelIds.current)
          : prev.funnels
        if (crm.ok) {
          for (const id of pendingSeedFunnelIds(remoteFunnels, funnels)) pendingFunnelIds.current.add(id)
          for (const id of recoverPendingFunnelIds(funnels, remoteFunnels)) pendingFunnelIds.current.add(id)
        }
        const remoteSettings =
          crm.ok && crm.settings && !settingsDirty.current ? migrateSettings({ ...crm.settings, telegramBotToken: "" }) : undefined
        const next = {
          ...prev,
          funnels,
          leads: hydrateLeads(
            prev.leads,
            {
              ok: remoteLeads.ok,
              leads: remoteLeads.leads.map(migrateLead),
              complete: remoteLeads.complete,
            },
            {
              ok: inbox.ok,
              leads: inbox.leads.map(migrateLead),
            },
            pendingLeadWrites.current,
            removedLeadIds.current
          ),
          settings: adoptHydrateSettings(prev.settings, remoteSettings, settingsDirty.current, runtime),
        }
        stateRef.current = next
        if (crm.ok) lastGoodFunnels.current = funnels
        return next
      })
      if (crm.ok) {
        persistIdSet(PENDING_FUNNELS, pendingFunnelIds.current)
        crmHydrated.current = true
        if (pendingFunnelIds.current.size || removedFunnelIds.current.size || settingsDirty.current) pushWorker()
      }
      if (pendingLeadWrites.current.size) void flushLeadWrites()
      else settleLeadPersist()
      if (remoteLeads.ok) {
        const retry = leadsStillOnRemote(removedLeadIds.current, remoteLeads.leads)
        if (retry.length) void flushRemovedLeads(retry)
      }
    }
    ).finally(() => {
      if (hydrateLock.current === pending) hydrateLock.current = null
    })
    hydrateLock.current = pending
    return pending
  }

  useEffect(() => {
    let cancelled = false
    meRequest()
      .then((data) => {
        if (cancelled) return
        setSessionSync("ok")
        commitState({ ...stateRef.current, user: data.user })
      })
      .catch(() => {
        if (!cancelled) setSessionSync("error")
      })
      .finally(() => {
        if (!cancelled) setReady(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const expire = () => {
      crmHydrated.current = false
      lastGoodFunnels.current = []
      setCrmSync("idle")
      setInboxSync("idle")
      setSessionSync("idle")
      resetLeadPersist()
      setState((prev) => {
        if (!prev.user) return prev
        toast.error("Sessão expirada. Entra outra vez.")
        return { ...prev, user: null }
      })
    }
    return subscribeSessionExpired(expire)
  }, [])

  useEffect(() => {
    if (!state.user) return
    const check = () => {
      void meRequest()
        .then((data) => {
          setSessionSync("ok")
          if (!data.user) noteSessionExpired()
          else commitState({ ...stateRef.current, user: data.user })
        })
        .catch(() => setSessionSync("error"))
    }
    const timer = window.setInterval(check, 15_000)
    window.addEventListener("focus", check)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener("focus", check)
    }
  }, [state.user])

  useEffect(() => {
    if (!state.user) return
    void runHydrate()
    const retry = () => {
      if (!crmHydrated.current) void runHydrate()
    }
    const timer = window.setInterval(retry, 8_000)
    window.addEventListener("focus", retry)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener("focus", retry)
    }
  }, [state.user])

  useEffect(() => {
    if (!state.user) return
    let cancelled = false
    const pull = async () => {
      const inbox = await fetchInbox()
      if (cancelled) return
      setInboxSync(inbox.ok ? "ok" : "error")
      if (inbox.ok) ingestRemoteRemoved(inbox.removed)
      const incoming = applyRemovedLeads(inbox.leads.map((lead) => migrateLead(lead)), removedLeadIds.current)
      setState((prev) => {
        const leads = overlayPendingLeads(
          mergeLeads(applyRemovedLeads(prev.leads, removedLeadIds.current), incoming),
          pendingLeadWrites.current,
          removedLeadIds.current
        )
        if (leads === prev.leads) return prev
        const next = { ...prev, leads }
        stateRef.current = next
        return next
      })
    }
    void pull()
    const timer = window.setInterval(() => void pull(), 5000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [state.user])

  useEffect(() => {
    if (!state.user) return
    let cancelled = false
    const reconcile = async () => {
      const [remoteLeads, inbox] = await Promise.all([fetchLeads(), fetchInbox(INBOX_LIST_PAGES)])
      if (cancelled) return
      markLeadRead(remoteLeads.ok)
      if (remoteLeads.ok) ingestRemoteRemoved(remoteLeads.removed)
      if (inbox.ok) ingestRemoteRemoved(inbox.removed)
      setInboxSync(inbox.ok ? "ok" : "error")
      if (!remoteLeads.ok) {
        if (pendingLeadWrites.current.size) void flushLeadWrites()
        else settleLeadPersist()
        return
      }
      setState((prev) => {
        const leads = hydrateLeads(
          prev.leads,
          {
            ok: true,
            leads: applyRemovedLeads(remoteLeads.leads.map(migrateLead), removedLeadIds.current),
            complete: remoteLeads.complete,
          },
          {
            ok: inbox.ok,
            leads: inbox.leads.map(migrateLead),
          },
          pendingLeadWrites.current,
          removedLeadIds.current
        )
        if (leads === prev.leads) return prev
        const next = { ...prev, leads }
        stateRef.current = next
        return next
      })
      if (pendingLeadWrites.current.size) void flushLeadWrites()
      else settleLeadPersist()
      const retry = leadsStillOnRemote(removedLeadIds.current, remoteLeads.leads)
      if (retry.length) void flushRemovedLeads(retry)
    }
    const timer = window.setInterval(() => void reconcile(), 30_000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [state.user])

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === REMOVED_LEADS) {
        const ids = loadIdSet(REMOVED_LEADS, LEAD_REMOVED_CAP)
        let changed = false
        for (const id of ids) {
          if (removedLeadIds.current.has(id)) continue
          removedLeadIds.current.add(id)
          changed = true
        }
        if (changed) persistIdSet(REMOVED_LEADS, removedLeadIds.current, LEAD_REMOVED_CAP)
        setState((prev) => {
          const leads = applyRemovedLeads(prev.leads, removedLeadIds.current)
          return leads === prev.leads ? prev : { ...prev, leads }
        })
      }
      if (event.key === REMOVED_FUNNELS) {
        const ids = loadIdSet(REMOVED_FUNNELS)
        let changed = false
        for (const id of ids) {
          if (removedFunnelIds.current.has(id)) continue
          removedFunnelIds.current.add(id)
          changed = true
        }
        if (changed) persistIdSet(REMOVED_FUNNELS, removedFunnelIds.current)
        setState((prev) => {
          const funnels = applyRemovedFunnels(prev.funnels, [...removedFunnelIds.current])
          return funnels === prev.funnels ? prev : { ...prev, funnels }
        })
      }
    }
    window.addEventListener("storage", onStorage)
    return () => window.removeEventListener("storage", onStorage)
  }, [])

  useEffect(() => {
    const onHide = () => {
      window.clearTimeout(leadWriteTimer.current)
      window.clearTimeout(crmTimer.current)
      void flushLeadWrites({ keepalive: true })
      void flushCrm({ silent: true, keepalive: true })
    }
    window.addEventListener("pagehide", onHide)
    return () => {
      window.removeEventListener("pagehide", onHide)
      flushLeadWrites()
      flushCrm()
    }
  }, [])

  useEffect(() => {
    window.clearTimeout(persistTimer.current)
    persistTimer.current = window.setTimeout(() => {
      const recent = cacheLeadsForStorage(state.leads, pendingLeadWrites.current.keys())
      localStorage.setItem(KEY, JSON.stringify({ ...state, user: null, leads: recent, settings: { ...state.settings, telegramBotToken: "" } }))
      if (state.user) localStorage.setItem(SESSION, JSON.stringify(state.user))
      else localStorage.removeItem(SESSION)
    }, 120)
    return () => window.clearTimeout(persistTimer.current)
  }, [state])

  const api = useMemo<Store>(
    () => ({
      ready,
      remote,
      crmSync,
      inboxSync,
      persistSync,
      sessionSync,
      state,
      login: async (email, password) => {
        const data = await loginRequest(email, password)
        clearSessionExpired()
        setSessionSync("ok")
        commitState({ ...stateRef.current, user: data.user })
      },
      logout: async () => {
        await flushLeadWrites()
        await flushCrm()
        crmHydrated.current = false
        lastGoodFunnels.current = []
        await logoutRequest().catch(() => undefined)
        setCrmSync("idle")
        setInboxSync("idle")
        setSessionSync("idle")
        resetLeadPersist()
        commitState({ ...stateRef.current, user: null })
      },
      createFunnel: (funnel) => {
        const gate = canCreateFunnel(stateRef.current.funnels)
        if (!gate.ok) {
          toast.error(gate.reason)
          return
        }
        pendingFunnelIds.current.add(funnel.id)
        persistIdSet(PENDING_FUNNELS, pendingFunnelIds.current)
        removedFunnelIds.current.delete(funnel.id)
        persistIdSet(REMOVED_FUNNELS, removedFunnelIds.current)
        const prev = stateRef.current
        commitState({
          ...prev,
          funnels:
            funnel.status === "active" && funnel.production
              ? activatePublishedFunnels([funnel, ...prev.funnels], funnel.id)
              : [funnel, ...prev.funnels],
        })
        pushWorker()
      },
      saveFunnel: (funnel) => {
        if (removedFunnelIds.current.has(funnel.id)) return
        const exists = stateRef.current.funnels.some((item) => item.id === funnel.id)
        if (!exists) {
          const gate = canCreateFunnel(stateRef.current.funnels)
          if (!gate.ok) {
            toast.error(gate.reason)
            return
          }
        }
        pendingFunnelIds.current.add(funnel.id)
        persistIdSet(PENDING_FUNNELS, pendingFunnelIds.current)
        const prev = stateRef.current
        const nextFunnels = exists
          ? prev.funnels.map((item) => (item.id === funnel.id ? funnel : item))
          : [funnel, ...prev.funnels]
        commitState({
          ...prev,
          funnels: funnel.status === "active" && funnel.production ? activatePublishedFunnels(nextFunnels, funnel.id) : nextFunnels,
        })
        pushWorker()
      },
      flushCrmNow: () => flushCrm({ silent: true }),
      flushLeadNow: () => flushLeadWrites(),
      retryHydrate: () => {
        void meRequest()
          .then((data) => {
            setSessionSync("ok")
            if (!data.user) noteSessionExpired()
            else commitState({ ...stateRef.current, user: data.user })
          })
          .catch(() => setSessionSync("error"))
        return runHydrate(true)
      },
      deleteFunnel: (id) => {
        const gate = canDeleteFunnel(stateRef.current.funnels, id)
        if (!gate.ok) {
          toast.error(gate.reason)
          return Promise.resolve(false)
        }
        pendingFunnelIds.current.delete(id)
        persistIdSet(PENDING_FUNNELS, pendingFunnelIds.current)
        removedFunnelIds.current.add(id)
        persistIdSet(REMOVED_FUNNELS, removedFunnelIds.current)
        const prev = stateRef.current
        commitState({ ...prev, funnels: prev.funnels.filter((item) => item.id !== id) })
        return flushCrm({ silent: true }).then((result) => result.ok)
      },
      createLead: (lead) => {
        const prev = stateRef.current
        const existing = prev.leads.find((item) => sameLeadContact(item.contact, lead.contact))
        const next = existing ? adoptOperatorLead(existing, { ...lead, id: existing.id }) : lead
        removedLeadIds.current.delete(next.id)
        persistIdSet(REMOVED_LEADS, removedLeadIds.current, LEAD_REMOVED_CAP)
        pendingLeadWrites.current.set(next.id, next)
        persistIdSet(PENDING_LEADS, new Set(pendingLeadWrites.current.keys()))
        commitState({
          ...prev,
          leads: existing ? prev.leads.map((item) => (item.id === next.id ? next : item)) : [next, ...prev.leads],
        })
        return flushLeadWrites()
      },
      createLeads: (leads) => {
        const prev = stateRef.current
        const adopted: Lead[] = []
        const used = new Set<string>()
        for (const lead of leads) {
          const existing = prev.leads.find((item) => !used.has(item.id) && sameLeadContact(item.contact, lead.contact))
          const next = existing ? adoptOperatorLead(existing, { ...lead, id: existing.id }) : lead
          used.add(next.id)
          adopted.push(next)
          removedLeadIds.current.delete(next.id)
          pendingLeadWrites.current.set(next.id, next)
        }
        persistIdSet(REMOVED_LEADS, removedLeadIds.current, LEAD_REMOVED_CAP)
        persistIdSet(PENDING_LEADS, new Set(pendingLeadWrites.current.keys()))
        const created = adopted.filter((lead) => !prev.leads.some((item) => item.id === lead.id))
        commitState({
          ...prev,
          leads: [
            ...created,
            ...prev.leads.map((item) => adopted.find((lead) => lead.id === item.id) ?? item),
          ],
        })
        return flushLeadWrites()
      },
      saveLead: (lead) => {
        if (removedLeadIds.current.has(lead.id)) return
        const prev = stateRef.current
        const current = prev.leads.find((item) => item.id === lead.id)
        const nextLead = adoptOperatorLead(current ?? null, lead)
        queueLeadWrite(nextLead)
        commitState({
          ...prev,
          leads: current
            ? prev.leads.map((item) => (item.id === lead.id ? nextLead : item))
            : mergeLeads(prev.leads, [nextLead], [nextLead.id]),
        })
      },
      ingestRemoteLeads: (incoming) => {
        const fresh = incoming.map(migrateLead).filter((lead) => lead.id && !removedLeadIds.current.has(lead.id))
        if (!fresh.length) return
        const prev = stateRef.current
        const leads = overlayPendingLeads(mergeLeads(prev.leads, fresh, fresh.map((lead) => lead.id)), pendingLeadWrites.current, removedLeadIds.current)
        if (leads === prev.leads) return
        commitState({ ...prev, leads })
      },
      deleteLead: (id) => {
        pendingLeadWrites.current.delete(id)
        persistIdSet(PENDING_LEADS, new Set(pendingLeadWrites.current.keys()))
        removedLeadIds.current.add(id)
        persistIdSet(REMOVED_LEADS, removedLeadIds.current, LEAD_REMOVED_CAP)
        const prev = stateRef.current
        commitState({ ...prev, leads: prev.leads.filter((item) => item.id !== id) })
        return leadFlushRef.current.then(() => removeRemoteLead(id)).then((ok) => {
          lastLeadWriteOk.current = ok
          settleLeadPersist()
          return ok
        })
      },
      saveSettings: (patch) => {
        settingsDirty.current = true
        persistFlag(PENDING_SETTINGS, true)
        const prev = stateRef.current
        commitState({
          ...prev,
          settings: { ...prev.settings, ...patch, telegramBotToken: "", plugins: patch.plugins ?? prev.settings.plugins },
        })
        pushWorker()
      },
    }),
    [ready, remote, crmSync, inboxSync, persistSync, sessionSync, state]
  )

  return <StoreContext.Provider value={api}>{children}</StoreContext.Provider>
}

export function useStore() {
  const value = useContext(StoreContext)
  if (!value) throw new Error("useStore precisa do StoreProvider")
  return value
}
