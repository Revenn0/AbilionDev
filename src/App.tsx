import { lazy, Suspense } from "react"
import { BrowserRouter, Navigate, Route, Routes, useSearchParams } from "react-router-dom"
import { AppShell } from "@/components/layout/app-shell"
import { OfflineBanner } from "@/components/layout/offline-banner"
import { RouteError } from "@/components/layout/route-error"
import { DashboardPage } from "@/pages/dashboard"
import { ForgotPage } from "@/pages/forgot"
import { LoginPage } from "@/pages/login"
import { LandingPage } from "@/pages/landing"
import { NotFoundPage } from "@/pages/not-found"
import { PrivacyPage } from "@/pages/privacy"
import { ResetPage } from "@/pages/reset"
import { safeAppPath } from "@/lib/safe-path"
import { useStore } from "@/lib/store"

const FluxoPage = lazy(() => import("@/pages/fluxo").then((m) => ({ default: m.FluxoPage })))
const FunnelEditorPage = lazy(() => import("@/pages/funnel-editor").then((m) => ({ default: m.FunnelEditorPage })))
const LeadsPage = lazy(() => import("@/pages/leads").then((m) => ({ default: m.LeadsPage })))
const ConversationsPage = lazy(() => import("@/pages/conversations").then((m) => ({ default: m.ConversationsPage })))
const SettingsPage = lazy(() => import("@/pages/settings").then((m) => ({ default: m.SettingsPage })))
const AnalyticsPage = lazy(() => import("@/pages/analytics").then((m) => ({ default: m.AnalyticsPage })))
const TelegramPage = lazy(() => import("@/pages/telegram").then((m) => ({ default: m.TelegramPage })))

function AuthGate({ children }: { children: React.ReactNode }) {
  const { ready, state } = useStore()
  const [params] = useSearchParams()
  if (!ready) return <PageFallback />
  if (state.user) return <Navigate to={safeAppPath(params.get("next"))} replace />
  return children
}

function PageFallback() {
  return (
    <div className="grid h-full place-items-center bg-background" role="status" aria-live="polite">
      <p className="text-[13px] text-muted-foreground">A carregar…</p>
    </div>
  )
}

function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <AuthGate>
            <LoginPage />
          </AuthGate>
        }
      />
      <Route
        path="/forgot"
        element={
          <AuthGate>
            <ForgotPage />
          </AuthGate>
        }
      />
      <Route path="/reset" element={<ResetPage />} />
      <Route path="/privacidade" element={<PrivacyPage />} />
      <Route path="/l" element={<LandingPage />} />
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
                  <Route path="/configuracoes" element={<SettingsPage />} />
                  <Route path="*" element={<NotFoundPage />} />
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
