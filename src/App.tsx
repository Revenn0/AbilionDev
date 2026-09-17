import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom"
import { AppShell } from "@/components/layout/app-shell"
import { DashboardPage } from "@/pages/dashboard"
import { FluxoPage } from "@/pages/fluxo"
import { ForgotPage } from "@/pages/forgot"
import { FunnelEditorPage } from "@/pages/funnel-editor"
import { JourneyEditorPage } from "@/pages/journey-editor"
import { LoginPage } from "@/pages/login"
import { PrivacyPage } from "@/pages/privacy"
import { SoonPage } from "@/pages/soon"
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
              <Route path="/fluxo/:id" element={<JourneyEditorPage />} />
              <Route path="/leads" element={<SoonPage title="Leads" hint="Base de contactos fica para a próxima fatia." />} />
              <Route path="/conversas" element={<SoonPage title="Conversas" hint="Inbox unificada fica para a próxima fatia." />} />
              <Route path="/agendamentos" element={<SoonPage title="Agendamentos" hint="Agenda e sinais ficam para a próxima fatia." />} />
              <Route path="/loja" element={<SoonPage title="Loja" hint="Ofertas e checkout ficam para a próxima fatia." />} />
              <Route path="/telegram" element={<SoonPage title="Telegram" hint="Ligação do canal fica para a próxima fatia." />} />
              <Route path="/instagram" element={<SoonPage title="Instagram" hint="Canal em breve." />} />
              <Route path="/plugins" element={<SoonPage title="Plugins" hint="Extensões ficam para a próxima fatia." />} />
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
