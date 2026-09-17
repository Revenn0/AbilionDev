import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { nameFromEmail, uid } from "@/lib/format"
import { migrateFunnel, migrateLead, migrateSettings } from "@/lib/migrate"
import { pullRemote, pushRemote, supabaseEnabled } from "@/lib/persist"
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
      settings: migrateSettings(parsed.settings),
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

type Store = {
  ready: boolean
  remote: "off" | "local" | "cloud"
  state: AppState
  login: (email: string, password: string) => void
  logout: () => void
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
  const [ready] = useState(true)
  const [remote, setRemote] = useState<Store["remote"]>(supabaseEnabled() ? "off" : "local")
  const [state, setState] = useState<AppState>(bootState)
  const skipPush = useRef(true)
  const persistTimer = useRef(0)

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
        const leads = bundle.leads.length ? bundle.leads : prev.leads
        const remoteSettings = migrateSettings(bundle.settings)
        return {
          ...prev,
          funnels: funnels.length ? funnels.map(migrateFunnel) : prev.funnels,
          leads: leads.map((lead) => migrateLead(lead)),
          settings: {
            ...remoteSettings,
            telegramBotToken: prev.settings.telegramBotToken || remoteSettings.telegramBotToken,
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
      localStorage.setItem(KEY, JSON.stringify({ ...state, user: null, leads: recent }))
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
      state,
      login: (email, password) => {
        if (password.length < 6) throw new Error("Informe um e-mail e uma senha com 6+ caracteres.")
        const user: User = { id: uid(), name: nameFromEmail(email), email }
        setState((prev) => ({ ...prev, user }))
      },
      logout: () => setState((prev) => ({ ...prev, user: null })),
      createFunnel: (funnel) => setState((prev) => ({ ...prev, funnels: [funnel, ...prev.funnels] })),
      saveFunnel: (funnel) =>
        setState((prev) => ({
          ...prev,
          funnels: prev.funnels.map((item) => (item.id === funnel.id ? funnel : item)),
        })),
      deleteFunnel: (id) => setState((prev) => ({ ...prev, funnels: prev.funnels.filter((item) => item.id !== id) })),
      createLead: (lead) => setState((prev) => ({ ...prev, leads: [lead, ...prev.leads] })),
      createLeads: (leads) => setState((prev) => ({ ...prev, leads: [...leads, ...prev.leads] })),
      saveLead: (lead) =>
        setState((prev) => ({
          ...prev,
          leads: prev.leads.map((item) => (item.id === lead.id ? lead : item)),
        })),
      deleteLead: (id) => setState((prev) => ({ ...prev, leads: prev.leads.filter((item) => item.id !== id) })),
      saveSettings: (patch) =>
        setState((prev) => ({
          ...prev,
          settings: { ...prev.settings, ...patch, plugins: patch.plugins ?? prev.settings.plugins },
        })),
      togglePlugin: (id) =>
        setState((prev) => ({
          ...prev,
          settings: {
            ...prev.settings,
            plugins: { ...prev.settings.plugins, [id]: !prev.settings.plugins[id] },
          },
        })),
    }),
    [ready, remote, state]
  )

  return <StoreContext.Provider value={api}>{children}</StoreContext.Provider>
}

export function useStore() {
  const value = useContext(StoreContext)
  if (!value) throw new Error("useStore precisa do StoreProvider")
  return value
}
