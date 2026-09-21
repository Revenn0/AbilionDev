import { lazy, Suspense, useEffect } from "react"
import { BrowserRouter, Navigate, Route, Routes, useLocation, useSearchParams } from "react-router-dom"
import { AppShell } from "@/components/layout/app-shell"
import { OfflineBanner } from "@/components/layout/offline-banner"
import { RouteError } from "@/components/layout/route-error"
import { DashboardPage } from "@/pages/dashboard"
import { NotFoundPage } from "@/pages/not-found"
import { foldStudioPath, safeAppPath } from "@/lib/safe-path"
import { useStore } from "@/lib/store"

const FluxoPage = lazy(() => import("@/pages/fluxo").then((m) => ({ default: m.FluxoPage })))
const FunnelEditorPage = lazy(() => import("@/pages/funnel-editor").then((m) => ({ default: m.FunnelEditorPage })))
const LeadsPage = lazy(() => import("@/pages/leads").then((m) => ({ default: m.LeadsPage })))
const ConversationsPage = lazy(() => import("@/pages/conversations").then((m) => ({ default: m.ConversationsPage })))
const SettingsPage = lazy(() => import("@/pages/settings").then((m) => ({ default: m.SettingsPage })))
const AnalyticsPage = lazy(() => import("@/pages/analytics").then((m) => ({ default: m.AnalyticsPage })))
const TelegramPage = lazy(() => import("@/pages/telegram").then((m) => ({ default: m.TelegramPage })))
const UsersPage = lazy(() => import("@/pages/users").then((m) => ({ default: m.UsersPage })))

function AuthGate({ children }: { children: React.ReactNode }) {
  const { ready, state } = useStore()
  const [params] = useSearchParams()
  if (!ready) return <PageFallback />
  if (state.user) return <Navigate to={safeAppPath(params.get("next"))} replace />
  return children
}

function StudioCaseRedirect() {
  const location = useLocation()
  const dest = foldStudioPath(location.pathname)
  if (dest) return <Navigate to={`${dest}${location.search}`} replace />
  return <NotFoundPage />
}

function PageFallback() {
  return (
    <div className="grid h-full place-items-center bg-background" role="status" aria-live="polite">
      <p className="text-[13px] text-muted-foreground">A carregar…</p>
    </div>
  )
}

/** GET destas rotas é HTML do Worker; um Link do SPA não pode ficar no login React. */
function WorkerPublicPage() {
  const location = useLocation()
  useEffect(() => {
    window.location.replace(`${location.pathname}${location.search}`)
  }, [location.pathname, location.search])
  return <PageFallback />
}

function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <AuthGate>
            <WorkerPublicPage />
          </AuthGate>
        }
      />
      <Route
        path="/forgot"
        element={
          <AuthGate>
            <WorkerPublicPage />
          </AuthGate>
        }
      />
      <Route path="/reset" element={<WorkerPublicPage />} />
      <Route path="/privacidade" element={<WorkerPublicPage />} />
      <Route path="/l" element={<WorkerPublicPage />} />
      <Route
        path="/*"
        element={
          <AppShell>
            <RouteError>
              <Suspense fallback={<PageFallback />}>
                <Routes>
                  <Route path="/" element={<DashboardPage />} />
                  <Route path="/analytics" element={<AnalyticsPage />} />
                  <Route path="/fluxo" element={<FluxoPage />} />
                  <Route path="/fluxo/funil/:id" element={<FunnelEditorPage />} />
                  <Route path="/leads" element={<LeadsPage />} />
                  <Route path="/conversas" element={<ConversationsPage />} />
                  <Route path="/telegram" element={<TelegramPage />} />
                  <Route path="/utilizadores" element={<UsersPage />} />
                  <Route path="/configuracoes" element={<SettingsPage />} />
                  <Route path="*" element={<StudioCaseRedirect />} />
                </Routes>
              </Suspense>
            </RouteError>
          </AppShell>
        }
      />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <a href="#conteudo" className="skip-link">
        Ir para o conteúdo
      </a>
      <OfflineBanner />
      <div>
        <AppRoutes />
      </div>
    </BrowserRouter>
  )
}
