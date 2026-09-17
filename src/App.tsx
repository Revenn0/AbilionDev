import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom"
import { AppShell } from "@/components/layout/app-shell"
import { DashboardPage } from "@/pages/dashboard"
import { FluxoPage } from "@/pages/fluxo"
import { ForgotPage } from "@/pages/forgot"
import { FunnelEditorPage } from "@/pages/funnel-editor"
import { LoginPage } from "@/pages/login"
import { PrivacyPage } from "@/pages/privacy"
import { ConversationsPage } from "@/pages/conversations"
import { LeadsPage } from "@/pages/leads"
import { SettingsPage } from "@/pages/settings"
import { TelegramPage } from "@/pages/telegram"
import { useStore } from "@/lib/store"

function AuthGate({ children }: { children: React.ReactNode }) {
  const { ready, state } = useStore()
  if (!ready) return null
  if (state.user) return <Navigate to="/" replace />
  return children
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
      <Route path="/privacidade" element={<PrivacyPage />} />
      <Route
        path="/*"
        element={
          <AppShell>
            <Routes>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/fluxo" element={<FluxoPage />} />
              <Route path="/fluxo/funil/:id" element={<FunnelEditorPage />} />
              <Route path="/leads" element={<LeadsPage />} />
              <Route path="/conversas" element={<ConversationsPage />} />
              <Route path="/telegram" element={<TelegramPage />} />
              <Route path="/configuracoes" element={<SettingsPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </AppShell>
        }
      />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  )
}
