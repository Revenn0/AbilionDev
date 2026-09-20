import { readJsonObject } from "./json-body.ts"
import {
  AUTH_REVOKED_CAP,
  clipAuthTokens,
  hashApiToken,
  hashPassword,
  isOperatorEmail,
  isOwner,
  isValidEmail,
  mintApiToken,
  normalizeEmail,
  operatorName,
  publicApiToken,
  publicManagedUser,
  randomToken,
  rememberRevokedApi,
  TOKEN_CAP,
  USER_CAP,
  type AuthStore,
  type AuthSnapshot,
  type PublicUser,
  type StoredUser,
  type UserRole,
} from "./auth.ts"

function dropUserApiTokens(snapshot: AuthSnapshot, user: StoredUser) {
  const ids = (user.tokens ?? []).map((item) => item.id)
  const next = rememberRevokedApi(snapshot, ids)
  snapshot.revokedApi = next.revokedApi
  user.tokens = []
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  })
}

function ownerCount(users: StoredUser[]) {
  return users.filter((user) => !user.disabled && (user.role === "owner" || isOperatorEmail(user.email))).length
}

async function storedOf(store: AuthStore, actor: PublicUser) {
  const snapshot = await store.load()
  return snapshot.users.find((item) => item.id === actor.id) ?? null
}

export async function handleUsers(request: Request, store: AuthStore, actor: PublicUser) {
  const url = new URL(request.url)
  if (url.pathname !== "/api/users") return json({ error: "not_found" }, 404)

  if (request.method === "GET") {
    const snapshot = await store.load()
    return json({
      ok: true,
      users: snapshot.users.map(publicManagedUser),
      cap: USER_CAP,
      me: actor,
    })
  }

  if (request.method === "POST") {
    if (!isOwner(actor)) return json({ error: "Só o dono cria contas." }, 403)
    const parsed = await readJsonObject<{ email?: string; name?: string; password?: string; role?: UserRole }>(request, 8_192)
    if (!parsed.ok) return json({ error: parsed.status === 413 ? "Pedido demasiado grande." : "JSON inválido." }, parsed.status)
    const email = normalizeEmail(parsed.value.email || "")
    const password = parsed.value.password || ""
    const name = (parsed.value.name || operatorName(email) || email.split("@")[0] || "Operador").trim().slice(0, 80)
    const role: UserRole = parsed.value.role === "owner" || isOperatorEmail(email) ? "owner" : "operator"
    if (!isValidEmail(email)) return json({ error: "Informa um e-mail válido." }, 400)
    if (password.length < 6) return json({ error: "A senha precisa de 6+ caracteres." }, 400)
    const snapshot = await store.load()
    if (snapshot.users.some((item) => item.email === email)) return json({ error: "Já existe uma conta com este e-mail." }, 409)
    if (snapshot.users.length >= USER_CAP) return json({ error: `O estúdio aceita no máximo ${USER_CAP} contas.` }, 400)
    const user: StoredUser = {
      id: randomToken(8),
      email,
      name: name || email,
      passwordHash: await hashPassword(password),
      createdAt: new Date().toISOString(),
      passwordUpdatedAt: Date.now(),
      accountUpdatedAt: Date.now(),
      role,
      disabled: false,
      tokens: [],
    }
    snapshot.users.push(user)
    await store.save(snapshot)
    return json({ ok: true, user: publicManagedUser(user) }, 201)
  }

  if (request.method === "PATCH") {
    if (!isOwner(actor)) return json({ error: "Só o dono altera contas." }, 403)
    const parsed = await readJsonObject<{
      id?: string
      name?: string
      role?: UserRole
      disabled?: boolean
    }>(request, 8_192)
    if (!parsed.ok) return json({ error: parsed.status === 413 ? "Pedido demasiado grande." : "JSON inválido." }, parsed.status)
    const id = (parsed.value.id || "").trim()
    if (!id) return json({ error: "Falta o id da conta." }, 400)
    const snapshot = await store.load()
    const user = snapshot.users.find((item) => item.id === id)
    if (!user) return json({ error: "Esta conta já não existe." }, 404)
    if (typeof parsed.value.name === "string") {
      const name = parsed.value.name.trim().slice(0, 80)
      if (!name) return json({ error: "Informa o nome." }, 400)
      user.name = name
    }
    if (parsed.value.role === "owner" || parsed.value.role === "operator") {
      if (isOperatorEmail(user.email) && parsed.value.role !== "owner") {
        return json({ error: "As contas iniciais da Abilion ficam como dono." }, 400)
      }
      if (parsed.value.role === "operator" && ownerCount(snapshot.users) <= 1 && (user.role === "owner" || isOperatorEmail(user.email))) {
        return json({ error: "Mantém pelo menos um dono." }, 400)
      }
      user.role = parsed.value.role
    }
    if (typeof parsed.value.disabled === "boolean") {
      if (user.id === actor.id) return json({ error: "Não desligues a tua própria conta." }, 400)
      if (isOperatorEmail(user.email)) return json({ error: "As contas iniciais da Abilion não desligam." }, 400)
      if (parsed.value.disabled && ownerCount(snapshot.users) <= 1 && (user.role === "owner" || isOperatorEmail(user.email))) {
        return json({ error: "Mantém pelo menos um dono activo." }, 400)
      }
      user.disabled = parsed.value.disabled
      if (user.disabled) {
        const dropped = snapshot.sessions.filter((item) => item.userId === user.id)
        snapshot.revoked = clipAuthTokens([...dropped.map((item) => item.token), ...(snapshot.revoked ?? [])], AUTH_REVOKED_CAP)
        snapshot.sessions = snapshot.sessions.filter((item) => item.userId !== user.id)
        dropUserApiTokens(snapshot, user)
      }
    }
    user.accountUpdatedAt = Date.now()
    await store.save(snapshot)
    return json({ ok: true, user: publicManagedUser(user) })
  }

  return json({ error: "not_found" }, 404)
}

export async function handleTokens(request: Request, store: AuthStore, actor: PublicUser) {
  const url = new URL(request.url)
  if (url.pathname !== "/api/tokens") return json({ error: "not_found" }, 404)

  if (request.method === "GET") {
    const user = await storedOf(store, actor)
    if (!user) return json({ error: "Sessão expirada." }, 401)
    return json({
      ok: true,
      tokens: (user.tokens ?? []).map(publicApiToken),
      cap: TOKEN_CAP,
    })
  }

  if (request.method === "POST") {
    const parsed = await readJsonObject<{ name?: string }>(request, 4_096)
    if (!parsed.ok) return json({ error: parsed.status === 413 ? "Pedido demasiado grande." : "JSON inválido." }, parsed.status)
    const snapshot = await store.load()
    const user = snapshot.users.find((item) => item.id === actor.id)
    if (!user) return json({ error: "Sessão expirada." }, 401)
    if ((user.tokens ?? []).length >= TOKEN_CAP) {
      return json({ error: `Cada conta aceita no máximo ${TOKEN_CAP} tokens.` }, 400)
    }
    const taken = new Set([...(snapshot.revokedApi ?? []), ...(user.tokens ?? []).map((item) => item.id)])
    let minted = mintApiToken(parsed.value.name || "Agente")
    for (let attempt = 0; attempt < 8 && taken.has(minted.id); attempt++) {
      minted = mintApiToken(parsed.value.name || "Agente")
    }
    if (taken.has(minted.id)) return json({ error: "Não gerei o token. Tenta outra vez." }, 409)
    const rec = {
      id: minted.id,
      name: minted.name,
      hash: await hashApiToken(minted.token),
      prefix: minted.prefix,
      createdAt: new Date().toISOString(),
    }
    user.tokens = [...(user.tokens ?? []), rec]
    await store.save(snapshot)
    return json({ ok: true, token: minted.token, item: publicApiToken(rec) }, 201)
  }

  if (request.method === "DELETE") {
    const id = url.searchParams.get("id")?.trim() || ""
    if (!id) return json({ error: "Falta o id do token." }, 400)
    const snapshot = await store.load()
    const user = snapshot.users.find((item) => item.id === actor.id)
    if (!user) return json({ error: "Sessão expirada." }, 401)
    user.tokens = (user.tokens ?? []).filter((item) => item.id !== id)
    const next = rememberRevokedApi(snapshot, [id])
    snapshot.revokedApi = next.revokedApi
    await store.save(snapshot)
    return json({ ok: true })
  }

  return json({ error: "not_found" }, 404)
}
