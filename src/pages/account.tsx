import { CircleUser } from "lucide-react"
import { AccountPanel } from "@/components/account/account-panel"
import { PageChrome } from "@/components/layout/chrome"

export function AccountPage() {
  return (
    <div className="h-full overflow-y-auto">
      <div className="page-shell">
        <PageChrome icon={CircleUser} title="Conta" />
        <p className="max-w-3xl text-[13px] leading-relaxed text-muted-foreground">
          Aqui mudas o e-mail de login e a senha. A senha actual confirma cada troca.
        </p>
        <AccountPanel />
      </div>
    </div>
  )
}
