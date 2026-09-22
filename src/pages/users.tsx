import { useEffect, useMemo, useRef, useState } from "react"
import { Link } from "react-router-dom"
import { Copy, Eye, EyeOff, KeyRound, Search, Sparkles, UserRoundCog } from "lucide-react"
import { FilterChip, PageChrome, StatusPill } from "@/components/layout/chrome"
import { ConfirmActionDialog } from "@/components/platform/platform-feedback"
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
  usersWriteBlocked,
  type ApiTokenItem,
  type ManagedUser,
} from "@/lib/users-api"
import { PROFILE_LABEL, profilesForUser } from "@/lib/access"
import type { AccessProfile } from "@/lib/platform"
import {
  ASSIGNABLE_PROFILES,
  PROFILE_HELP,
  TEAM_FILTERS,
  accountLocks,
  countTeamUsers,
  filterTeamUsers,
  generateAccountPassword,
  toggleProfile,
  type TeamFilter,
} from "@/lib/team"
import { initials, timeAgo } from "@/lib/format"
import type { UserRole } from "@/lib/types"
import { toast } from "sonner"

function roleLabel(role: UserRole) {
  return role === "owner" ? "Dono" : "Operador"
}

function copyText(value: string, ok: string) {
  void navigator.clipboard.writeText(value).then(() => toast.success(ok))
}

function SecretCopy({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-muted/60 p-3">
      <p className="text-[12px] text-muted-foreground">{label}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <code className="break-all text-[12.5px]">{value}</code>
        <Button type="button" variant="ghost" size="sm" className="rounded-full" onClick={() => copyText(value, "Copiado.")}>
          <Copy className="size-3.5" />
          Copiar
        </Button>
      </div>
    </div>
  )
}

function sessionHint(user: ManagedUser) {
  if (user.disabled) return "Conta desligada"
  if (user.lastSeenAt) return user.sessionCount > 0 ? `Em sessão · ${timeAgo(user.lastSeenAt)}` : `Última sessão ${timeAgo(user.lastSeenAt)}`
  return "Ainda não entrou"
}

export function UsersPage() {
  const { state } = useStore()
  const me = state.user
  const owner = me?.role === "owner"
  const [users, setUsers] = useState<ManagedUser[] | null>(null)
  const [tokens, setTokens] = useState<ApiTokenItem[] | null>(null)
  const [usersError, setUsersError] = useState("")
  const [tokensError, setTokensError] = useState("")
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState<TeamFilter>("all")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [role, setRole] = useState<UserRole>("operator")
  const [createProfiles, setCreateProfiles] = useState<AccessProfile[]>([])
  const [tokenName, setTokenName] = useState("Claude Code")
  const [freshToken, setFreshToken] = useState("")
  const [freshPassword, setFreshPassword] = useState("")
  const [busy, setBusy] = useState(false)
  const [tokenBusy, setTokenBusy] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const lock = useRef(false)
  const tokenLock = useRef(false)

  const reload = () => {
    void listUsersRequest()
      .then((next) => {
        setUsers(next.users)
        setUsersError("")
      })
      .catch((err: Error) => {
        setUsersError(err.message)
      })
    void listTokensRequest()
      .then((next) => {
        setTokens(next.tokens)
        setTokensError("")
      })
      .catch((err: Error) => {
        setTokensError(err.message)
      })
  }

  useEffect(() => {
    reload()
  }, [])

  const usersUnread = usersWriteBlocked(users, usersError)
  const tokensUnread = usersWriteBlocked(tokens, tokensError)
  const counts = useMemo(() => countTeamUsers(users ?? []), [users])
  const rows = useMemo(() => filterTeamUsers(users ?? [], query, filter), [filter, query, users])
  const selected = users?.find((item) => item.id === selectedId) ?? null

  const applyUser = (user: ManagedUser, password?: string) => {
    setUsers((prev) => (prev ?? []).map((item) => (item.id === user.id ? user : item)))
    if (password) setFreshPassword(password)
  }

  const create = (event: React.FormEvent) => {
    event.preventDefault()
    if (lock.current || busy) return
    if (usersUnread) {
      toast.error("Não confirmei as contas.")
      return
    }
    lock.current = true
    setBusy(true)
    const issued = password
    void createUserRequest({
      name: name.trim(),
      email: email.trim(),
      password: issued,
      role,
      profiles: role === "operator" && createProfiles.length ? createProfiles : undefined,
    })
      .then((result) => {
        setUsers((prev) => (prev ? [...prev, result.user] : prev))
        setFreshPassword(issued)
        setName("")
        setEmail("")
        setPassword("")
        setRole("operator")
        setCreateProfiles([])
        setShowPassword(false)
        toast.success("Conta criada. Copia a senha inicial agora.")
        reload()
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
          {users ? <StatusPill>{counts.active} activas</StatusPill> : null}
        </PageChrome>
        <p className="max-w-2xl text-[13.5px] leading-relaxed text-muted-foreground">
          Contas do estúdio e tokens para o Claude Code ou outros agentes. Um e-mail novo só entra depois de o criares aqui — o login não inventa contas.
        </p>
        {usersError || tokensError ? (
          <div className="flex flex-wrap items-center gap-3" data-users-error={usersError ? "1" : undefined} data-tokens-error={tokensError ? "1" : undefined}>
            {usersError ? (
              <p role="alert" className="text-[13px] text-destructive">
                {usersError}
              </p>
            ) : null}
            {tokensError ? (
              <p role="alert" className="text-[13px] text-destructive">
                {tokensError}
              </p>
            ) : null}
            <Button type="button" variant="ghost" size="sm" className="rounded-full" onClick={reload}>
              Tentar outra vez
            </Button>
          </div>
        ) : null}

        <section className="surface overflow-hidden">
          <div className="border-b px-5 py-4">
            <p className="text-[14px] font-medium">Equipa</p>
            <p className="mt-1 text-[12.5px] text-muted-foreground">Victor e Gabriel são donos iniciais e não desligam. Clica numa conta para gerir o acesso.</p>
            <div className="relative mt-3">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Nome ou e-mail"
                aria-label="Procurar contas"
                className="pl-9"
              />
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {TEAM_FILTERS.map((item) => (
                <FilterChip key={item.id} active={filter === item.id} onClick={() => setFilter(item.id)}>
                  {item.label} {users ? counts[item.id] : "…"}
                </FilterChip>
              ))}
            </div>
          </div>
          {!users && !usersError ? (
            <p className="px-5 py-8 text-[13px] text-muted-foreground">A carregar as contas…</p>
          ) : usersError && !users ? (
            <p className="px-5 py-8 text-[13px] text-muted-foreground" role="status">
              Não li as contas.
            </p>
          ) : !users || users.length === 0 ? (
            <p className="px-5 py-8 text-[13px] text-muted-foreground">Ainda não há contas no KV.</p>
          ) : rows.length === 0 ? (
            <p className="px-5 py-8 text-[13px] text-muted-foreground">
              {query.trim() ? "Nenhuma conta nesta busca." : "Nenhuma conta neste recorte."}
            </p>
          ) : (
            <ul className="divide-y">
              {rows.map((user) => {
                const profiles = user.role === "owner" ? [] : profilesForUser(user)
                return (
                  <li key={user.id}>
                    <button
                      type="button"
                      data-user-id={user.id}
                      className="flex w-full flex-wrap items-center justify-between gap-3 px-5 py-3.5 text-left hover:bg-muted/40"
                      onClick={() => setSelectedId(user.id)}
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="grid size-9 shrink-0 place-items-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">
                          {initials(user.name)}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-[13.5px] font-medium">
                            {user.name}
                            {user.id === me?.id ? <span className="ml-1.5 text-[11.5px] font-normal text-muted-foreground">tu</span> : null}
                          </p>
                          <p className="truncate text-[12px] text-muted-foreground">{user.email}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusPill tone={user.disabled ? "danger" : user.sessionCount > 0 ? "success" : user.role === "owner" ? "success" : "muted"}>
                          {user.disabled ? "Desligada" : roleLabel(user.role)}
                        </StatusPill>
                        {profiles.length ? (
                          <p className="max-w-[220px] truncate text-[11.5px] text-muted-foreground">
                            {profiles.map((item) => PROFILE_LABEL[item]).join(" · ")}
                          </p>
                        ) : null}
                        <p className="text-[11.5px] text-muted-foreground">{sessionHint(user)}</p>
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <div className="grid items-start gap-3 xl:grid-cols-2">
        {owner ? (
          <section className="surface min-w-0 p-5">
            <p className="text-[14px] font-medium">Nova conta</p>
            <p className="mt-1 text-[12.5px] text-muted-foreground">A pessoa entra com o e-mail e a senha que definires. Gera uma senha se não quiseres inventar.</p>
            <form className="mt-4 space-y-3" onSubmit={create}>
              <fieldset disabled={usersUnread} className="min-w-0 space-y-3 border-0 p-0">
              <div className="space-y-1.5">
                <Label htmlFor="user-name">Nome</Label>
                <Input
                  id="user-name"
                  value={name}
                  autoComplete="name"
                  onChange={(event) => setName(event.target.value)}
                  maxLength={80}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="user-email">E-mail</Label>
                <Input
                  id="user-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="user-password">Senha inicial</Label>
                <div className="flex gap-2">
                  <div className="relative min-w-0 flex-1">
                    <Input
                      id="user-password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      value={password}
                      className="pr-10"
                      onChange={(event) => setPassword(event.target.value)}
                      minLength={6}
                      required
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      onClick={() => setShowPassword((value) => !value)}
                      aria-label={showPassword ? "Ocultar senha inicial" : "Mostrar senha inicial"}
                    >
                      {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-full"
                    disabled={usersUnread}
                    onClick={() => {
                      setPassword(generateAccountPassword())
                      setShowPassword(true)
                    }}
                  >
                    <Sparkles className="size-3.5" />
                    Gerar
                  </Button>
                </div>
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
              {role === "operator" ? (
                <div className="space-y-1.5">
                  <p className="text-[13px] font-medium">Acesso</p>
                  <div className="flex flex-wrap gap-1.5">
                    {ASSIGNABLE_PROFILES.map((profile) => {
                      const checked = createProfiles.includes(profile)
                      return (
                        <label
                          key={profile}
                          className={`inline-flex h-7 items-center rounded-full px-2.5 text-[12px] ${
                            checked ? "bg-foreground text-background" : "bg-muted text-muted-foreground"
                          }`}
                        >
                          <input
                            type="checkbox"
                            className="sr-only"
                            checked={checked}
                            onChange={() => setCreateProfiles((prev) => toggleProfile(prev, profile))}
                          />
                          {PROFILE_LABEL[profile]}
                        </label>
                      )
                    })}
                  </div>
                  <p className="text-[12px] text-muted-foreground">
                    Sem escolha, o operador edita bots, CRM e criativos. Tokens e contas ficam com o dono.
                  </p>
                </div>
              ) : null}
              <Button type="submit" className="rounded-full" disabled={busy || usersUnread}>
                Criar conta
              </Button>
              </fieldset>
              {usersUnread ? (
                <p className="text-[12.5px] text-muted-foreground" data-users-create="unread" role="alert">
                  Não confirmei as contas no Worker.
                </p>
              ) : null}
            </form>
            {freshPassword ? <div className="mt-4"><SecretCopy label="Senha desta conta. Copia agora — não volta a aparecer." value={freshPassword} /></div> : null}
          </section>
        ) : (
          <p className="text-[13px] text-muted-foreground">Só o dono cria ou desliga contas.</p>
        )}

        <section className="surface min-w-0 p-5">
          <div className="flex items-center gap-2">
            <KeyRound className="size-4 text-muted-foreground" />
            <p className="text-[14px] font-medium">Tokens MCP</p>
          </div>
          <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
            O Claude Code e outros agentes falam com <code className="text-[12px]">https://www.abilion.lol/mcp</code> com um Bearer{" "}
            <code className="text-[12px]">abn_…</code>. O valor completo só aparece uma vez. O catálogo do que o agente
            faz — funis, leads, pixel, contas — está em{" "}
            <Link to="/configuracoes?tab=mcp" className="underline underline-offset-3">
              Configurações → MCP
            </Link>
            .
          </p>
          <form
            className="mt-4 flex flex-wrap items-end gap-2"
            onSubmit={(event) => {
              event.preventDefault()
              if (tokenLock.current || tokenBusy) return
              if (tokensUnread) {
                toast.error("Não confirmei os tokens.")
                return
              }
              tokenLock.current = true
              setTokenBusy(true)
              void createTokenRequest(tokenName.trim() || "Agente")
                .then((result) => {
                  setFreshToken(result.token)
                  toast.success("Token criado. Copia agora — não volta a aparecer.")
                  reload()
                })
                .catch((err: Error) => toast.error(err.message))
                .finally(() => {
                  tokenLock.current = false
                  setTokenBusy(false)
                })
            }}
          >
            <div className="min-w-[12rem] flex-1 space-y-1.5">
              <Label htmlFor="token-name">Nome do agente</Label>
              <Input
                id="token-name"
                value={tokenName}
                onChange={(event) => setTokenName(event.target.value)}
                maxLength={60}
                disabled={tokensUnread}
              />
            </div>
            <Button type="submit" className="rounded-full" disabled={tokenBusy || tokensUnread}>
              {tokenBusy ? "A gerar…" : "Gerar token"}
            </Button>
          </form>
          {tokensUnread ? (
            <p className="mt-2 text-[12.5px] text-muted-foreground" data-tokens-create="unread" role="alert">
              Não confirmei os tokens no Worker.
            </p>
          ) : null}
          {freshToken ? <div className="mt-4"><SecretCopy label="Copia e guarda. Depois disto só vês o prefixo." value={freshToken} /></div> : null}
          {!tokens && !tokensError ? (
            <p className="mt-4 text-[13px] text-muted-foreground">A carregar tokens…</p>
          ) : tokensError && !tokens ? (
            <p className="mt-4 text-[13px] text-muted-foreground" role="status">
              Não li os tokens.
            </p>
          ) : !tokens || tokens.length === 0 ? (
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
                    disabled={tokensUnread}
                    title={tokensUnread ? "Não confirmei os tokens no Worker." : undefined}
                    onClick={() => {
                      if (tokensUnread || !confirm("Revogar este token? Os agentes que o usam deixam de entrar.")) return
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
      <UserDrawer
        user={selected}
        actorId={me?.id}
        owner={owner}
        blocked={usersUnread}
        busy={busy}
        onClose={() => setSelectedId(null)}
        onApply={applyUser}
      />
    </div>
  )
}

function UserDrawer({
  user,
  actorId,
  owner,
  blocked,
  busy,
  onClose,
  onApply,
}: {
  user: ManagedUser | null
  actorId?: string
  owner: boolean
  blocked: boolean
  busy: boolean
  onClose: () => void
  onApply: (user: ManagedUser, password?: string) => void
}) {
  const panel = useRef<HTMLElement>(null)
  const [name, setName] = useState(user?.name ?? "")
  const [issuedPassword, setIssuedPassword] = useState("")
  const [confirm, setConfirm] = useState<"disable" | "enable" | "reset" | null>(null)
  const [patching, setPatching] = useState(false)
  const locks = user ? accountLocks(user, actorId) : null

  useEffect(() => {
    if (!user) return
    setName(user.name)
    setIssuedPassword("")
    setConfirm(null)
  }, [user?.id])

  useEffect(() => {
    if (!user) return
    const root = panel.current
    root?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose, user])

  if (!user || !locks) return null

  const assigned = user.role === "owner" ? (["administrator"] as AccessProfile[]) : profilesForUser(user)
  const canWrite = owner && !blocked

  const patch = (input: Parameters<typeof patchUserRequest>[0], ok: string) => {
    if (!canWrite || patching) return Promise.resolve()
    setPatching(true)
    return patchUserRequest(input)
      .then((result) => {
        onApply(result.user, result.password)
        if (result.password) setIssuedPassword(result.password)
        toast.success(ok)
        setConfirm(null)
      })
      .catch((err: Error) => toast.error(err.message))
      .finally(() => setPatching(false))
  }

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <button type="button" className="absolute inset-0 bg-black/40" aria-label="Fechar conta" onClick={onClose} />
      <aside
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="user-drawer-title"
        tabIndex={-1}
        className="relative z-10 flex h-full w-full max-w-md flex-col overflow-y-auto bg-card p-6 shadow-xl outline-none"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[12px] text-muted-foreground">{sessionHint(user)}</p>
            <h2 id="user-drawer-title" className="mt-1 text-[20px] font-medium tracking-tight">
              {user.name}
            </h2>
            <p className="mt-1 text-[13px] text-muted-foreground">{user.email}</p>
          </div>
          <StatusPill tone={user.disabled ? "danger" : user.role === "owner" ? "success" : "muted"}>
            {user.disabled ? "Desligada" : roleLabel(user.role)}
          </StatusPill>
        </div>

        <dl className="mt-5 grid grid-cols-2 gap-3 text-[12.5px]">
          <div className="rounded-xl bg-muted/50 px-3 py-2.5">
            <dt className="text-muted-foreground">Sessões</dt>
            <dd className="mt-0.5 font-medium">{user.sessionCount}</dd>
          </div>
          <div className="rounded-xl bg-muted/50 px-3 py-2.5">
            <dt className="text-muted-foreground">Tokens MCP</dt>
            <dd className="mt-0.5 font-medium">{user.tokenCount}</dd>
          </div>
          <div className="rounded-xl bg-muted/50 px-3 py-2.5">
            <dt className="text-muted-foreground">Criada</dt>
            <dd className="mt-0.5 font-medium">{timeAgo(user.createdAt)}</dd>
          </div>
          <div className="rounded-xl bg-muted/50 px-3 py-2.5">
            <dt className="text-muted-foreground">Senha</dt>
            <dd className="mt-0.5 font-medium">{user.passwordChangedAt ? timeAgo(user.passwordChangedAt) : "Ainda a inicial"}</dd>
          </div>
        </dl>

        {user.seeded ? (
          <p className="mt-4 text-[12.5px] text-muted-foreground">Conta inicial da Abilion: o papel de dono não muda e a conta não desliga.</p>
        ) : null}

        {canWrite ? (
          <form
            className="mt-5 space-y-4"
            onSubmit={(event) => {
              event.preventDefault()
              const next = name.trim()
              if (!next || next === user.name) return
              void patch({ id: user.id, name: next }, "Nome actualizado.")
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="edit-user-name">Nome</Label>
              <div className="flex gap-2">
                <Input id="edit-user-name" value={name} maxLength={80} onChange={(event) => setName(event.target.value)} />
                <Button type="submit" variant="outline" className="rounded-full" disabled={patching || !name.trim() || name.trim() === user.name}>
                  Guardar
                </Button>
              </div>
            </div>
          </form>
        ) : (
          <p className="mt-5 text-[13px] text-muted-foreground">{owner ? "Não confirmei as contas no Worker." : "Só o dono altera contas."}</p>
        )}

        {canWrite && locks.canChangeRole ? (
          <div className="mt-5 space-y-1.5">
            <Label htmlFor="edit-user-role">Papel</Label>
            <select
              id="edit-user-role"
              value={user.role}
              disabled={patching}
              onChange={(event) => {
                const next = event.target.value === "owner" ? "owner" : "operator"
                void patch({ id: user.id, role: next }, next === "owner" ? "Passou a dono." : "Passou a operador.")
              }}
              className="flex h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
            >
              <option value="operator">Operador</option>
              <option value="owner">Dono</option>
            </select>
          </div>
        ) : null}

        {user.role !== "owner" ? (
          <div className="mt-5 space-y-2">
            <p className="text-[13px] font-medium">Acesso</p>
            <ul className="space-y-2">
              {ASSIGNABLE_PROFILES.map((profile) => {
                const checked = assigned.includes(profile)
                return (
                  <li key={profile}>
                    <label className="flex items-start gap-2.5 rounded-xl border px-3 py-2.5">
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={checked}
                        disabled={!canWrite || !locks.canChangeProfiles || patching}
                        onChange={() => {
                          const current = assigned.filter((item) => item !== "administrator")
                          void patch({ id: user.id, profiles: toggleProfile(current, profile) }, "Acesso actualizado.")
                        }}
                      />
                      <span>
                        <span className="block text-[13px] font-medium">{PROFILE_LABEL[profile]}</span>
                        <span className="block text-[12px] text-muted-foreground">{PROFILE_HELP[profile]}</span>
                      </span>
                    </label>
                  </li>
                )
              })}
            </ul>
            <p className="text-[12px] text-muted-foreground">
              Sem escolha, o operador edita bots, CRM e criativos. Tokens e contas ficam com o dono.
            </p>
          </div>
        ) : (
          <p className="mt-5 text-[12.5px] text-muted-foreground">{PROFILE_HELP.administrator}</p>
        )}

        {issuedPassword ? <div className="mt-5"><SecretCopy label="Senha nova. Copia agora — não volta a aparecer." value={issuedPassword} /></div> : null}

        {canWrite ? (
          <div className="mt-6 flex flex-wrap gap-2">
            {locks.canResetPassword ? (
              <Button type="button" variant="outline" className="rounded-full" disabled={patching} onClick={() => setConfirm("reset")}>
                Redefinir senha
              </Button>
            ) : (
              <p className="text-[12.5px] text-muted-foreground">A tua senha muda em Conta, não aqui.</p>
            )}
            {locks.canDisable ? (
              <Button
                type="button"
                variant={user.disabled ? "outline" : "destructive"}
                className="rounded-full"
                disabled={patching}
                onClick={() => setConfirm(user.disabled ? "enable" : "disable")}
              >
                {user.disabled ? "Reactivar" : "Desligar"}
              </Button>
            ) : null}
          </div>
        ) : null}

        <ConfirmActionDialog
          open={confirm === "reset"}
          onOpenChange={(open) => !open && setConfirm(null)}
          title="Redefinir senha"
          description="Gero uma senha nova. As sessões e os tokens MCP desta pessoa deixam de entrar."
          confirmLabel="Gerar senha"
          busy={patching || busy}
          onConfirm={() => {
            void patch({ id: user.id, resetPassword: true }, "Senha nova gerada. Copia agora.")
          }}
        />
        <ConfirmActionDialog
          open={confirm === "disable"}
          onOpenChange={(open) => !open && setConfirm(null)}
          title="Desligar conta"
          description="As sessões e os tokens MCP desta pessoa deixam de entrar."
          confirmLabel="Desligar"
          destructive
          busy={patching || busy}
          onConfirm={() => {
            void patch({ id: user.id, disabled: true }, "Conta desligada.")
          }}
        />
        <ConfirmActionDialog
          open={confirm === "enable"}
          onOpenChange={(open) => !open && setConfirm(null)}
          title="Reactivar conta"
          description="A pessoa volta a poder entrar com a senha actual."
          confirmLabel="Reactivar"
          busy={patching || busy}
          onConfirm={() => {
            void patch({ id: user.id, disabled: false }, "Conta reactivada.")
          }}
        />
      </aside>
    </div>
  )
}
