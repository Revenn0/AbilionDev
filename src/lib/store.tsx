import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { loginRequest, logoutRequest, meRequest } from "@/lib/auth-api"
import { mergeLeads } from "@/lib/crm"
import { migrateFunnel, migrateLead, migrateSettings } from "@/lib/migrate"
import { pullRemote, pushRemote, supabaseEnabled } from "@/lib/persist"
import { fetchCrm, fetchInbox, fetchRuntime, persistLeads, removeRemoteLead, saveCrm } from "@/lib/runtime-api"
import { seededOperation } from "@/lib/templates"
import { defaultSettings, type AppState, type Lead, type PluginId, type SalesFunnel, type Settings, type User } from "@/lib/types"

const KEY = "abilion.dev.v2"
const LEGACY = "abilion.dev.v1"
const SESSION = "abilion.dev.session"

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

function bootState(): AppState {
  const firstVisit = !localStorage.getItem(KEY) && !localStorage.getItem(LEGACY)
  const saved = withSeed(readState(), firstVisit)
  saved.user = readUser()
  return saved
}

type SyncState = "idle" | "ok" | "error"

type Store = {
  ready: boolean
  remote: "off" | "local" | "cloud"
  crmSync: SyncState
  inboxSync: SyncState
  persistSync: SyncState
  state: AppState
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  createFunnel: (funnel: SalesFunnel) => void
  saveFunnel: (funnel: SalesFunnel) => void
  deleteFunnel: (id: string) => void
  createLead: (lead: Lead) => void
  createLeads: (leads: Lead[]) => void
  saveLead: (lead: Lead) => void
  deleteLead: (id: string) => void
  saveSettings: (patch: Partial<Settings>) => void
  togglePlugin: (id: PluginId) => void
}

const StoreContext = createContext<Store | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [remote, setRemote] = useState<Store["remote"]>(supabaseEnabled() ? "off" : "local")
  const [crmSync, setCrmSync] = useState<SyncState>("idle")
  const [inboxSync, setInboxSync] = useState<SyncState>("idle")
  const [persistSync, setPersistSync] = useState<SyncState>("idle")
  const [state, setState] = useState<AppState>(bootState)
  const skipPush = useRef(true)
  const persistTimer = useRef(0)
  const crmTimer = useRef(0)
  const stateRef = useRef(state)

  useEffect(() => {
    stateRef.current = state
  }, [state])

  const pushWorker = () => {
    window.clearTimeout(crmTimer.current)
    crmTimer.current = window.setTimeout(() => {
      const current = stateRef.current
      if (!current.user) return
      void saveCrm({
        funnels: current.funnels,
        settings: { ...current.settings, telegramBotToken: "" },
      })
    }, 400)
  }

  useEffect(() => {
    let cancelled = false
    meRequest()
      .then((data) => {
        if (cancelled) return
        setState((prev) => ({ ...prev, user: data.user }))
      })
      .catch(() => {
        if (!cancelled) setState((prev) => ({ ...prev, user: null }))
      })
      .finally(() => {
        if (!cancelled) setReady(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!state.user) return
    let cancelled = false
    skipPush.current = true
    void Promise.all([fetchCrm(), fetchRuntime()]).then(([crm, runtime]) => {
      if (cancelled) return
      setCrmSync(crm.ok ? "ok" : "error")
      setState((prev) => ({
        ...prev,
        funnels: crm.ok && crm.funnels.length ? crm.funnels.map(migrateFunnel) : prev.funnels,
        settings: {
          ...prev.settings,
          ...(crm.ok && crm.settings ? migrateSettings({ ...crm.settings, telegramBotToken: "" }) : {}),
          telegramBotToken: "",
          telegramBotUsername: runtime.telegramBotUsername || prev.settings.telegramBotUsername,
          telegramGroupUrl: runtime.telegramGroupUrl || prev.settings.telegramGroupUrl,
          plugins: {
            ...prev.settings.plugins,
            ...(crm.ok && crm.settings?.plugins ? crm.settings.plugins : {}),
            telegram: runtime.ok ? Boolean(runtime.telegram) : prev.settings.plugins.telegram,
          },
        },
      }))
    })
    return () => {
      cancelled = true
    }
  }, [state.user])

  useEffect(() => {
    if (!state.user) return
    let cancelled = false
    const pull = async () => {
      const inbox = await fetchInbox()
      if (cancelled) return
      setInboxSync(inbox.ok ? "ok" : "error")
      const incoming = inbox.leads.map((lead) => migrateLead(lead))
      if (!incoming.length) return
      setState((prev) => {
        const leads = mergeLeads(prev.leads, incoming)
        return leads === prev.leads ? prev : { ...prev, leads }
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
    if (!supabaseEnabled()) return
    let cancelled = false
    pullRemote().then((bundle) => {
      if (cancelled || !bundle) {
        setRemote("local")
        return
      }
      setRemote("cloud")
      setState((prev) => {
        const funnels = bundle.funnels.length ? bundle.funnels : prev.funnels
        const leads = mergeLeads(prev.leads, bundle.leads.map((lead) => migrateLead(lead)))
        const remoteSettings = migrateSettings({ ...bundle.settings, telegramBotToken: "" })
        return {
          ...prev,
          funnels: funnels.length ? funnels.map(migrateFunnel) : prev.funnels,
          leads,
          settings: {
            ...remoteSettings,
            telegramBotToken: "",
            telegramBotUsername: prev.settings.telegramBotUsername || remoteSettings.telegramBotUsername,
            telegramGroupUrl: prev.settings.telegramGroupUrl || remoteSettings.telegramGroupUrl,
          },
        }
      })
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    window.clearTimeout(persistTimer.current)
    persistTimer.current = window.setTimeout(() => {
      const recent = [...state.leads].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 400)
      localStorage.setItem(KEY, JSON.stringify({ ...state, user: null, leads: recent, settings: { ...state.settings, telegramBotToken: "" } }))
      if (state.user) localStorage.setItem(SESSION, JSON.stringify(state.user))
      else localStorage.removeItem(SESSION)
      if (skipPush.current) {
        skipPush.current = false
        return
      }
      if (!supabaseEnabled()) return
      void pushRemote({
        ...state,
        settings: { ...state.settings, telegramBotToken: "" },
      })
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
      state,
      login: async (email, password) => {
        const data = await loginRequest(email, password)
        setState((prev) => ({ ...prev, user: data.user }))
      },
      logout: async () => {
        await logoutRequest().catch(() => undefined)
        setCrmSync("idle")
        setInboxSync("idle")
        setPersistSync("idle")
        setState((prev) => ({ ...prev, user: null }))
      },
      createFunnel: (funnel) => {
        setState((prev) => ({ ...prev, funnels: [funnel, ...prev.funnels] }))
        pushWorker()
      },
      saveFunnel: (funnel) => {
        setState((prev) => ({
          ...prev,
          funnels: prev.funnels.map((item) => (item.id === funnel.id ? funnel : item)),
        }))
        pushWorker()
      },
      deleteFunnel: (id) => {
        setState((prev) => ({ ...prev, funnels: prev.funnels.filter((item) => item.id !== id) }))
        pushWorker()
      },
      createLead: (lead) => {
        setState((prev) => ({ ...prev, leads: [lead, ...prev.leads] }))
        void persistLeads([lead]).then((ok) => setPersistSync(ok ? "ok" : "error"))
      },
      createLeads: (leads) => {
        setState((prev) => ({ ...prev, leads: [...leads, ...prev.leads] }))
        void persistLeads(leads).then((ok) => setPersistSync(ok ? "ok" : "error"))
      },
      saveLead: (lead) => {
        setState((prev) => ({
          ...prev,
          leads: prev.leads.map((item) => (item.id === lead.id ? lead : item)),
        }))
        void persistLeads([lead]).then((ok) => setPersistSync(ok ? "ok" : "error"))
      },
      deleteLead: (id) => {
        setState((prev) => ({ ...prev, leads: prev.leads.filter((item) => item.id !== id) }))
        void removeRemoteLead(id).then((ok) => setPersistSync(ok ? "ok" : "error"))
      },
      saveSettings: (patch) => {
        setState((prev) => ({
          ...prev,
          settings: { ...prev.settings, ...patch, telegramBotToken: "", plugins: patch.plugins ?? prev.settings.plugins },
        }))
        pushWorker()
      },
      togglePlugin: (id) => {
        if (id === "whatsapp") return
        setState((prev) => ({
          ...prev,
          settings: {
            ...prev.settings,
            plugins: { ...prev.settings.plugins, [id]: !prev.settings.plugins[id] },
          },
        }))
        pushWorker()
      },
    }),
    [ready, remote, crmSync, inboxSync, persistSync, state]
  )

  return <StoreContext.Provider value={api}>{children}</StoreContext.Provider>
}

export function useStore() {
  const value = useContext(StoreContext)
  if (!value) throw new Error("useStore precisa do StoreProvider")
  return value
}
