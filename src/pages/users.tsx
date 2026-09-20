import { useEffect, useRef, useState } from "react"
import { Copy, KeyRound, UserRoundCog } from "lucide-react"
import { PageChrome, StatusPill } from "@/components/layout/chrome"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useStore } from "@/lib/store"
import {
  createTokenRequest,
  createUserRequest,
  listTokensRequest,
  listUsersRequest,
  patchUserRequest,
  revokeTokenRequest,
  type ApiTokenItem,
  type ManagedUser,
} from "@/lib/users-api"
import type { UserRole } from "@/lib/types"
import { toast } from "sonner"

function roleLabel(role: UserRole) {
  return role === "owner" ? "Dono" : "Operador"
}

export function UsersPage() {
  const { state } = useStore()
  const me = state.user
  const owner = me?.role === "owner"
  const [users, setUsers] = useState<ManagedUser[] | null>(null)
  const [tokens, setTokens] = useState<ApiTokenItem[] | null>(null)
  const [error, setError] = useState("")
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [role, setRole] = useState<UserRole>("operator")
  const [tokenName, setTokenName] = useState("Claude Code")
  const [freshToken, setFreshToken] = useState("")
  const [busy, setBusy] = useState(false)
  const lock = useRef(false)

  const reload = () => {
    void Promise.all([listUsersRequest(), listTokensRequest()])
      .then(([nextUsers, nextTokens]) => {
        setUsers(nextUsers.users)
        setTokens(nextTokens.tokens)
        setError("")
      })
      .catch((err: Error) => {
        setError(err.message)
      })
  }

  useEffect(() => {
    reload()
  }, [])

  const create = (event: React.FormEvent) => {
    event.preventDefault()
    if (lock.current || busy) return
    lock.current = true
    setBusy(true)
    void createUserRequest({ name: name.trim(), email: email.trim(), password, role })
      .then((result) => {
        setUsers((prev) => [...(prev ?? []), result.user])
        setName("")
        setEmail("")
        setPassword("")
        setRole("operator")
        toast.success("Conta criada. Já pode entrar com esta senha.")
      })
      .catch((err: Error) => toast.error(err.message))
      .finally(() => {
        lock.current = false
        setBusy(false)
      })
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="page-shell space-y-4">
        <PageChrome icon={UserRoundCog} title="Utilizadores">
          <StatusPill tone={owner ? "success" : "muted"}>{owner ? "Dono" : "Operador"}</StatusPill>
        </PageChrome>
        <p className="max-w-2xl text-[13.5px] leading-relaxed text-muted-foreground">
          Contas do estúdio e tokens para o Claude Code ou outros agentes. Um e-mail novo só entra depois de o criares aqui — o login não inventa contas.
        </p>
        {error ? (
          <p role="alert" className="text-[13px] text-destructive">
            {error}
          </p>
        ) : null}

        <section className="surface overflow-hidden">
          <div className="border-b px-5 py-4">
            <p className="text-[14px] font-medium">Equipa</p>
            <p className="mt-1 text-[12.5px] text-muted-foreground">Victor e Gabriel são donos iniciais e não desligam.</p>
          </div>
          {!users ? (
            <p className="px-5 py-8 text-[13px] text-muted-foreground">A carregar as contas…</p>
          ) : users.length === 0 ? (
            <p className="px-5 py-8 text-[13px] text-muted-foreground">Ainda não há contas no KV.</p>
          ) : (
            <ul className="divide-y">
              {users.map((user) => (
                <li key={user.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
                  <div className="min-w-0">
                    <p className="truncate text-[13.5px] font-medium">{user.name}</p>
                    <p className="truncate text-[12px] text-muted-foreground">{user.email}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusPill tone={user.disabled ? "danger" : user.role === "owner" ? "success" : "muted"}>
                      {user.disabled ? "Desligada" : roleLabel(user.role)}
                    </StatusPill>
                    {owner && !user.seeded && user.id !== me?.id ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="rounded-full"
                        onClick={() => {
                          void patchUserRequest({ id: user.id, disabled: !user.disabled })
                            .then((result) => {
                              setUsers((prev) => (prev ?? []).map((item) => (item.id === result.user.id ? result.user : item)))
                              toast.success(result.user.disabled ? "Conta desligada." : "Conta reactivada.")
                            })
                            .catch((err: Error) => toast.error(err.message))
                        }}
                      >
                        {user.disabled ? "Reactivar" : "Desligar"}
                      </Button>
                    ) : null}
                    {owner && !user.seeded ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="rounded-full"
                        onClick={() => {
                          const next = user.role === "owner" ? "operator" : "owner"
                          void patchUserRequest({ id: user.id, role: next })
                            .then((result) => {
                              setUsers((prev) => (prev ?? []).map((item) => (item.id === result.user.id ? result.user : item)))
                              toast.success(result.user.role === "owner" ? "Passou a dono." : "Passou a operador.")
                            })
                            .catch((err: Error) => toast.error(err.message))
                        }}
                      >
                        {user.role === "owner" ? "Tornar operador" : "Tornar dono"}
                      </Button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {owner ? (
          <section className="surface max-w-xl p-5">
            <p className="text-[14px] font-medium">Nova conta</p>
            <p className="mt-1 text-[12.5px] text-muted-foreground">A pessoa entra com o e-mail e a senha que definires.</p>
            <form className="mt-4 space-y-3" onSubmit={create}>
              <div className="space-y-1.5">
                <Label htmlFor="user-name">Nome</Label>
                <Input id="user-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={80} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="user-email">E-mail</Label>
                <Input id="user-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="user-password">Senha inicial</Label>
                <Input
                  id="user-password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  minLength={6}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="user-role">Papel</Label>
                <select
                  id="user-role"
                  value={role}
                  onChange={(event) => setRole(event.target.value === "owner" ? "owner" : "operator")}
                  className="flex h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
                >
                  <option value="operator">Operador</option>
                  <option value="owner">Dono</option>
                </select>
              </div>
              <Button type="submit" className="rounded-full" disabled={busy}>
                Criar conta
              </Button>
            </form>
          </section>
        ) : (
          <p className="text-[13px] text-muted-foreground">Só o dono cria ou desliga contas.</p>
        )}

        <section className="surface max-w-2xl p-5">
          <div className="flex items-center gap-2">
            <KeyRound className="size-4 text-muted-foreground" />
            <p className="text-[14px] font-medium">Tokens MCP</p>
          </div>
          <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
            O Claude Code e outros agentes falam com <code className="text-[12px]">https://www.abilion.lol/mcp</code> com um Bearer{" "}
            <code className="text-[12px]">abn_…</code>. O valor completo só aparece uma vez.
          </p>
          <form
            className="mt-4 flex flex-wrap items-end gap-2"
            onSubmit={(event) => {
              event.preventDefault()
              void createTokenRequest(tokenName.trim() || "Agente")
                .then((result) => {
                  setTokens((prev) => [...(prev ?? []), result.item])
                  setFreshToken(result.token)
                  toast.success("Token criado. Copia agora — não volta a aparecer.")
                })
                .catch((err: Error) => toast.error(err.message))
            }}
          >
            <div className="min-w-[12rem] flex-1 space-y-1.5">
              <Label htmlFor="token-name">Nome do agente</Label>
              <Input id="token-name" value={tokenName} onChange={(event) => setTokenName(event.target.value)} maxLength={60} />
            </div>
            <Button type="submit" className="rounded-full">
              Gerar token
            </Button>
          </form>
          {freshToken ? (
            <div className="mt-4 rounded-xl bg-muted/60 p-3">
              <p className="text-[12px] text-muted-foreground">Copia e guarda. Depois disto só vês o prefixo.</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <code className="break-all text-[12.5px]">{freshToken}</code>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="rounded-full"
                  onClick={() => {
                    void navigator.clipboard.writeText(freshToken).then(() => toast.success("Token copiado."))
                  }}
                >
                  <Copy className="size-3.5" />
                  Copiar
                </Button>
              </div>
            </div>
          ) : null}
          {!tokens ? (
            <p className="mt-4 text-[13px] text-muted-foreground">A carregar tokens…</p>
          ) : tokens.length === 0 ? (
            <p className="mt-4 text-[13px] text-muted-foreground">Ainda não há tokens nesta conta.</p>
          ) : (
            <ul className="mt-4 divide-y rounded-xl border">
              {tokens.map((token) => (
                <li key={token.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
                  <div>
                    <p className="text-[13px] font-medium">{token.name}</p>
                    <p className="text-[12px] text-muted-foreground">{token.prefix}…</p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="rounded-full"
                    onClick={() => {
                      if (!confirm("Revogar este token? Os agentes que o usam deixam de entrar.")) return
                      void revokeTokenRequest(token.id)
                        .then(() => {
                          setTokens((prev) => (prev ?? []).filter((item) => item.id !== token.id))
                          toast.success("Token revogado.")
                        })
                        .catch((err: Error) => toast.error(err.message))
                    }}
                  >
                    Revogar
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <pre className="mt-5 overflow-x-auto rounded-xl bg-muted/60 p-3 text-[11.5px] leading-relaxed">
{`{
  "mcpServers": {
    "abilion": {
      "command": "npx",
      "args": ["tsx", "mcp/server.mts"],
      "env": {
        "ABILION_URL": "https://www.abilion.lol",
        "ABILION_TOKEN": "abn_…"
      }
    }
  }
}`}
          </pre>
        </section>
      </div>
    </div>
  )
}
