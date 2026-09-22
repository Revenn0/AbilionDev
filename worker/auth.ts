import { authForgotDocument, authLoginDocument, authResetDocument, wantsAuthHtml } from "../src/lib/auth-pages.ts"
import { sanitizeAccessProfiles, type AccessProfile } from "../src/lib/platform.ts"
import { safeAppPath } from "../src/lib/safe-path.ts"
import { readJsonObject } from "./json-body.ts"

export const OPERATORS = [
  { email: "victor@abilion.com", name: "Victor Junger" },
  { email: "gabriel@abilion.com", name: "Gabriel" },
] as const

const COOKIE = "abilion_session"
const DAY = 60 * 60 * 24
const SESSION_TTL_MS = 7 * DAY * 1000
const RESET_TTL_MS = 60 * 60 * 1000
const SESSION_CAP = 5
export const USER_CAP = 40
export const TOKEN_CAP = 20
const PBKDF2_ITERATIONS = 100_000

export const AUTH_REVOKED_CAP = 2000
export const AUTH_REVOKED_API_CAP = 2000
export const AUTH_SPENT_RESET_CAP = 200

export type UserRole = "owner" | "operator"

export type ApiToken = {
  id: string
  name: string
  hash: string
  prefix: string
  createdAt: string
}

export type StoredUser = {
  id: string
  email: string
  name: string
  passwordHash: string
  createdAt: string
  passwordUpdatedAt?: number
  accountUpdatedAt?: number
  /** E-mails iniciais da Abilion que esta conta deixou. Continuam reservados. */
  aliases?: string[]
  role?: UserRole
  profiles?: AccessProfile[]
  disabled?: boolean
  tokens?: ApiToken[]
}

export type PublicUser = {
  id: string
  email: string
  name: string
  role: UserRole
  profiles?: AccessProfile[]
}

export type ManagedUser = PublicUser & {
  disabled: boolean
  createdAt: string
  seeded: boolean
  tokenCount: number
  sessionCount: number
  lastSeenAt?: string
  passwordChangedAt?: string
}

export type Session = {
  token: string
  userId: string
  expiresAt: number
  issuedAt: number
}

export type ResetRecord = {
  userId: string
  expiresAt: number
}

export type AuthThrottle = {
  count: number
  resetAt: number
  hits?: string[]
}

export type AuthSnapshot = {
  users: StoredUser[]
  sessions: Session[]
  resets: Record<string, ResetRecord>
  throttles?: Record<string, AuthThrottle>
  revoked?: string[]
  revokedApi?: string[]
  spentResets?: string[]
}

export type AuthStore = {
  load(): Promise<AuthSnapshot>
  save(next: AuthSnapshot): Promise<void>
}

const encoder = new TextEncoder()

function hex(bytes: Uint8Array) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("")
}

function fromHex(value: string) {
  const bytes = new Uint8Array(value.length / 2)
  for (let i = 0; i < bytes.length; i++) bytes[i] = Number.parseInt(value.slice(i * 2, i * 2 + 2), 16)
  return bytes
}

export function randomToken(bytes = 24) {
  return hex(crypto.getRandomValues(new Uint8Array(bytes)))
}

function timingEqual(left: Uint8Array, right: Uint8Array) {
  if (left.length !== right.length) return false
  let diff = 0
  for (let i = 0; i < left.length; i++) diff |= left[i] ^ right[i]
  return diff === 0
}

export async function hashPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"])
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: PBKDF2_ITERATIONS },
    key,
    256
  )
  return `pbkdf2:${PBKDF2_ITERATIONS}:${hex(salt)}:${hex(new Uint8Array(bits))}`
}

export async function verifyPassword(password: string, stored: string) {
  if (!stored.startsWith("pbkdf2:")) return false
  const [, iter, saltHex, hashHex] = stored.split(":")
  if (!iter || !saltHex || !hashHex) return false
  const salt = fromHex(saltHex)
  const expected = fromHex(hashHex)
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"])
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: Number(iter) || PBKDF2_ITERATIONS },
    key,
    expected.length * 8
  )
  return timingEqual(new Uint8Array(bits), expected)
}

export function isOperatorEmail(email: string) {
  return OPERATORS.some((item) => item.email === email)
}

export function holdsOperatorSeat(user: Pick<StoredUser, "email" | "aliases">) {
  if (isOperatorEmail(user.email)) return true
  return (user.aliases ?? []).some((item) => isOperatorEmail(item))
}

export function emailInUse(users: StoredUser[], email: string, exceptId = "") {
  const value = normalizeEmail(email)
  if (!value) return false
  return users.some(
    (user) =>
      user.id !== exceptId &&
      (normalizeEmail(user.email) === value || (user.aliases ?? []).some((item) => normalizeEmail(item) === value))
  )
}

export function operatorName(email: string) {
  return OPERATORS.find((item) => item.email === email)?.name ?? email
}

export function userRole(user: Pick<StoredUser, "email" | "role" | "aliases">): UserRole {
  if (holdsOperatorSeat(user)) return "owner"
  return user.role === "owner" ? "owner" : "operator"
}

export function isOwner(user: Pick<PublicUser, "role" | "email">) {
  return user.role === "owner" || isOperatorEmail(user.email)
}

export function publicUser(user: StoredUser): PublicUser {
  const role = userRole(user)
  const profiles = role === "owner" ? [] : sanitizeAccessProfiles(user.profiles)
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role,
    ...(profiles.length ? { profiles } : {}),
  }
}

export function liveSessionsFor(userId: string, sessions: Session[] = [], now = Date.now()) {
  return sessions.filter((item) => item.userId === userId && item.expiresAt > now)
}

export function publicManagedUser(user: StoredUser, sessions: Session[] = [], now = Date.now()): ManagedUser {
  const live = liveSessionsFor(user.id, sessions, now)
  const lastIssued = live.reduce((max, item) => Math.max(max, item.issuedAt), 0)
  return {
    ...publicUser(user),
    disabled: Boolean(user.disabled) && !holdsOperatorSeat(user),
    createdAt: user.createdAt,
    seeded: holdsOperatorSeat(user),
    tokenCount: (user.tokens ?? []).length,
    sessionCount: live.length,
    ...(lastIssued ? { lastSeenAt: new Date(lastIssued).toISOString() } : {}),
    ...(user.passwordUpdatedAt ? { passwordChangedAt: new Date(user.passwordUpdatedAt).toISOString() } : {}),
  }
}

export function publicApiToken(token: ApiToken) {
  return { id: token.id, name: token.name, prefix: token.prefix, createdAt: token.createdAt }
}

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase()
}

export function isValidEmail(value: string) {
  return value.length >= 6 && value.length <= 120 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

export function mergeTokens(left?: ApiToken[], right?: ApiToken[], drop: Iterable<string> = [], cap = TOKEN_CAP): ApiToken[] {
  const revoked = new Set([...drop].map((id) => id.trim()).filter(Boolean))
  const byId = new Map<string, ApiToken>()
  for (const token of [...(left ?? []), ...(right ?? [])]) {
    if (!token?.id || !token.hash) continue
    const id = token.id.trim().slice(0, 40)
    const hash = token.hash.trim().slice(0, 80)
    if (!id || !hash || revoked.has(id)) continue
    const prev = byId.get(id)
    const next: ApiToken = {
      id,
      name: (token.name || prev?.name || "Agente").trim().slice(0, 60) || "Agente",
      hash,
      prefix: (token.prefix || prev?.prefix || "abn_").trim().slice(0, 24),
      createdAt: token.createdAt || prev?.createdAt || new Date().toISOString(),
    }
    if (!prev) {
      byId.set(id, next)
      continue
    }
    byId.set(id, (next.createdAt || "") >= (prev.createdAt || "") ? { ...prev, ...next } : { ...next, ...prev })
  }
  return [...byId.values()].sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || "")).slice(0, cap)
}

export function clipUsers(users: StoredUser[], cap = USER_CAP): StoredUser[] {
  const seeded = users.filter((user) => user?.email && holdsOperatorSeat(user))
  const rest = users.filter((user) => user?.email && !holdsOperatorSeat(user)).slice(0, Math.max(0, cap - seeded.length))
  return [...seeded, ...rest]
}

function emptySnapshot(): AuthSnapshot {
  return { users: [], sessions: [], resets: {}, throttles: {}, revoked: [], revokedApi: [], spentResets: [] }
}

export function clipAuthTokens(ids: unknown, cap = AUTH_REVOKED_CAP): string[] {
  if (!Array.isArray(ids)) return []
  const out: string[] = []
  const seen = new Set<string>()
  for (const id of ids) {
    if (typeof id !== "string") continue
    const next = id.trim()
    if (!next || next.length > 128 || seen.has(next)) continue
    seen.add(next)
    out.push(next)
    if (out.length >= cap) break
  }
  return out
}

function uniqueHits(hits: string[], cap = 256) {
  const out: string[] = []
  const seen = new Set<string>()
  for (const hit of hits) {
    if (!hit || seen.has(hit)) continue
    seen.add(hit)
    out.push(hit)
    if (out.length >= cap) break
  }
  return out
}

export function mergeThrottles(
  left: Record<string, AuthThrottle>,
  right: Record<string, AuthThrottle>
): Record<string, AuthThrottle> {
  const out: Record<string, AuthThrottle> = { ...left }
  for (const [key, item] of Object.entries(right)) {
    const prev = out[key]
    if (!prev) {
      out[key] = item
      continue
    }
    if (item.resetAt === prev.resetAt) {
      const hits = uniqueHits([...(prev.hits ?? []), ...(item.hits ?? [])])
      out[key] = {
        count: Math.max(prev.count, item.count, hits.length),
        resetAt: prev.resetAt,
        hits: hits.length ? hits : undefined,
      }
      continue
    }
    out[key] = item.resetAt > prev.resetAt ? item : prev
  }
  return out
}

function capSessions(sessions: Session[], cap = SESSION_CAP): Session[] {
  const byUser = new Map<string, Session[]>()
  for (const session of sessions) {
    const list = byUser.get(session.userId) ?? []
    list.push(session)
    byUser.set(session.userId, list)
  }
  const out: Session[] = []
  for (const list of byUser.values()) {
    out.push(...list.sort((a, b) => b.issuedAt - a.issuedAt).slice(0, cap))
  }
  return out
}

function passwordAt(user: StoredUser | undefined) {
  return user?.passwordUpdatedAt ?? 0
}

function accountAt(user: StoredUser | undefined) {
  return user?.accountUpdatedAt ?? 0
}

function reservedOperatorAliases(values: Array<string | undefined>, email: string) {
  const out: string[] = []
  for (const item of values) {
    const value = normalizeEmail(item || "")
    if (!value || value === email || !isOperatorEmail(value) || out.includes(value)) continue
    out.push(value)
  }
  return out.slice(0, 8)
}

function preferUser(prev: StoredUser, next: StoredUser): StoredUser {
  const prevAt = passwordAt(prev)
  const nextAt = passwordAt(next)
  const winner =
    nextAt > prevAt
      ? { ...prev, ...next, passwordHash: next.passwordHash, passwordUpdatedAt: nextAt }
      : prevAt > nextAt
        ? { ...next, ...prev, id: prev.id, passwordHash: prev.passwordHash, passwordUpdatedAt: prevAt }
        : { ...prev, ...next, id: prev.id, passwordHash: next.passwordHash || prev.passwordHash }
  const prevAcc = accountAt(prev)
  const nextAcc = accountAt(next)
  const account = nextAcc > prevAcc ? next : prevAcc > nextAcc ? prev : winner
  const email = normalizeEmail((nextAcc > prevAcc ? next.email : prev.email) || prev.email)
  const aliases = reservedOperatorAliases([prev.email, next.email, ...(prev.aliases ?? []), ...(next.aliases ?? [])], email)
  const seeded = isOperatorEmail(email) || aliases.length > 0
  return {
    ...winner,
    id: prev.id,
    email,
    aliases: aliases.length ? aliases : undefined,
    role: seeded ? "owner" : account.role === "owner" ? "owner" : "operator",
    profiles: seeded || account.role === "owner" ? undefined : sanitizeAccessProfiles(account.profiles),
    disabled: seeded ? false : nextAcc !== prevAcc ? Boolean(account.disabled) : Boolean(prev.disabled || next.disabled),
    accountUpdatedAt: Math.max(prevAcc, nextAcc, winner.accountUpdatedAt ?? 0) || undefined,
    tokens: mergeTokens(prev.tokens, next.tokens),
  }
}

export function mergeAuthSnapshots(left: AuthSnapshot, right: AuthSnapshot): AuthSnapshot {
  const remap = new Map<string, string>()
  const absorbed = new Set<string>()
  const byId = new Map<string, StoredUser>()
  const emailOwner = new Map<string, string>()

  const seatForAlias = (email: string) => {
    for (const [id, user] of byId) {
      if ((user.aliases ?? []).some((item) => normalizeEmail(item) === email)) return id
    }
    return ""
  }

  const reindex = (previous: StoredUser, merged: StoredUser) => {
    const previousEmail = normalizeEmail(previous.email)
    if (emailOwner.get(previousEmail) === previous.id) emailOwner.delete(previousEmail)
    byId.set(merged.id, merged)
    emailOwner.set(normalizeEmail(merged.email), merged.id)
  }

  const adopt = (user: StoredUser) => {
    const email = normalizeEmail(user.email)
    if (!user.id || !email) return
    const normalized = email === user.email ? user : { ...user, email }
    const sameId = byId.get(normalized.id)
    if (sameId) {
      let merged = preferUser(sameId, normalized)
      const taken = emailOwner.get(merged.email)
      if (taken && taken !== sameId.id) {
        const aliases = reservedOperatorAliases(
          [sameId.email, normalized.email, ...(sameId.aliases ?? []), ...(normalized.aliases ?? [])],
          sameId.email
        ).filter((item) => {
          const owner = emailOwner.get(item)
          return !owner || owner === sameId.id
        })
        merged = { ...merged, email: sameId.email, aliases: aliases.length ? aliases : undefined }
      }
      reindex(sameId, merged)
      return
    }
    const sameEmailId = emailOwner.get(email)
    if (sameEmailId) {
      if (sameEmailId !== normalized.id) remap.set(normalized.id, sameEmailId)
      const prev = byId.get(sameEmailId)
      if (!prev) return
      reindex(prev, preferUser(prev, { ...normalized, id: sameEmailId }))
      return
    }
    const aliasId = seatForAlias(email)
    if (aliasId && aliasId !== normalized.id) {
      remap.set(normalized.id, aliasId)
      absorbed.add(normalized.id)
      return
    }
    byId.set(normalized.id, normalized)
    emailOwner.set(email, normalized.id)
  }

  for (const user of left.users) {
    if (user?.id && user.email) adopt(user)
  }
  for (const user of right.users) {
    if (user?.id && user.email) adopt(user)
  }

  const users = clipUsers([...byId.values()])
  const winAt = new Map(users.map((user) => [user.id, passwordAt(user)]))
  const freshByUser = new Map<string, Set<string> | null>()
  const tokensFor = (userId: string) => {
    if (freshByUser.has(userId)) return freshByUser.get(userId) ?? null
    const winner = winAt.get(userId) ?? 0
    if (!winner) {
      freshByUser.set(userId, null)
      return null
    }
    const tokens = new Set<string>()
    for (const snap of [left, right]) {
      if (!snap.users.some((item) => (remap.get(item.id) ?? item.id) === userId && passwordAt(item) === winner)) continue
      for (const session of snap.sessions) {
        if ((remap.get(session.userId) ?? session.userId) === userId) tokens.add(session.token)
      }
    }
    freshByUser.set(userId, tokens)
    return tokens
  }

  const sessions = new Map<string, Session>()
  for (const session of [...left.sessions, ...right.sessions]) {
    if (!session?.token || absorbed.has(session.userId)) continue
    const userId = remap.get(session.userId) ?? session.userId
    const allowed = tokensFor(userId)
    if (allowed && !allowed.has(session.token)) continue
    sessions.set(session.token, { ...session, userId })
  }
  const now = Date.now()
  const liveSessions = [...left.sessions, ...right.sessions].filter((item) => item?.token && item.expiresAt > now).map((item) => item.token)
  const liveApi = [...left.users, ...right.users].flatMap((user) => (user.tokens ?? []).map((item) => item.id))
  const liveResets = [...Object.keys(left.resets ?? {}), ...Object.keys(right.resets ?? {})]
  const revoked = clipAuthTokens(
    [
      ...liveSessions.filter((token) => (left.revoked ?? []).includes(token) || (right.revoked ?? []).includes(token)),
      ...(right.revoked ?? []),
      ...(left.revoked ?? []),
    ],
    AUTH_REVOKED_CAP
  )
  const revokedApi = clipAuthTokens(
    [
      ...liveApi.filter((id) => (left.revokedApi ?? []).includes(id) || (right.revokedApi ?? []).includes(id)),
      ...(right.revokedApi ?? []),
      ...(left.revokedApi ?? []),
    ],
    AUTH_REVOKED_API_CAP
  )
  const spentResets = clipAuthTokens(
    [
      ...liveResets.filter((token) => (left.spentResets ?? []).includes(token) || (right.spentResets ?? []).includes(token)),
      ...(right.spentResets ?? []),
      ...(left.spentResets ?? []),
    ],
    AUTH_SPENT_RESET_CAP
  )
  const drop = new Set(revoked)
  const dropApi = new Set(revokedApi)
  const resetByUser = new Map<string, { token: string; rec: ResetRecord }>()
  for (const [token, rec] of [...Object.entries(left.resets ?? {}), ...Object.entries(right.resets ?? {})]) {
    if (!rec || typeof rec.userId !== "string" || spentResets.includes(token)) continue
    const userId = remap.get(rec.userId) ?? rec.userId
    const prev = resetByUser.get(userId)
    if (!prev || rec.expiresAt >= prev.rec.expiresAt) resetByUser.set(userId, { token, rec: { ...rec, userId } })
  }

  return {
    users: users.map((user) => ({
      ...user,
      tokens: mergeTokens(user.tokens, [], dropApi),
    })),
    sessions: capSessions(
      [...sessions.values()].filter((item) => !drop.has(item.token) && item.expiresAt > now)
    ),
    resets: Object.fromEntries([...resetByUser.values()].map((item) => [item.token, item.rec])),
    throttles: mergeThrottles(left.throttles ?? {}, right.throttles ?? {}),
    revoked,
    revokedApi,
    spentResets,
  }
}

const memoryThrottles = new Map<string, AuthThrottle>()

export function consumeMemoryThrottle(key: string, limit: number, windowMs: number, now = Date.now()) {
  const current = memoryThrottles.get(key)
  if (!current || current.resetAt <= now) {
    memoryThrottles.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }
  if (current.count >= limit) return false
  memoryThrottles.set(key, { ...current, count: current.count + 1 })
  return true
}

export function consumeThrottle(
  snapshot: AuthSnapshot,
  key: string,
  limit: number,
  windowMs: number,
  now = Date.now(),
  hit?: string
) {
  const throttles = { ...(snapshot.throttles ?? {}) }
  const current = throttles[key]
  if (!current || current.resetAt <= now) {
    throttles[key] = { count: 1, resetAt: now + windowMs, hits: hit ? [hit] : undefined }
    return { ok: true as const, snapshot: { ...snapshot, throttles } }
  }
  if (hit) {
    const hits = current.hits ?? []
    const existing = hits.indexOf(hit)
    if (existing >= 0) return { ok: existing < limit, snapshot }
    if (hits.length >= limit || current.count >= limit) return { ok: false as const, snapshot }
    const nextHits = uniqueHits([...hits, hit], Math.max(256, limit + 8))
    throttles[key] = { count: Math.max(current.count + 1, nextHits.length), resetAt: current.resetAt, hits: nextHits }
    return { ok: nextHits.indexOf(hit) >= 0 && nextHits.indexOf(hit) < limit, snapshot: { ...snapshot, throttles } }
  }
  if (current.count >= limit) return { ok: false as const, snapshot }
  throttles[key] = { ...current, count: current.count + 1 }
  return { ok: true as const, snapshot: { ...snapshot, throttles } }
}

export function clearThrottle(snapshot: AuthSnapshot, key: string): AuthSnapshot {
  const throttles = { ...(snapshot.throttles ?? {}) }
  delete throttles[key]
  return { ...snapshot, throttles }
}

export async function consumeKvThrottle(
  kv: { get(key: string, type: "json"): Promise<unknown>; put(key: string, value: string): Promise<void> },
  key: string,
  limit: number,
  windowMs: number,
  now = Date.now(),
  bucket = "track:throttles"
) {
  const read = async () => {
    const raw = await kv.get(bucket, "json")
    return raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, AuthThrottle>) : {}
  }
  const live = (map: Record<string, AuthThrottle>) =>
    Object.fromEntries(Object.entries(map).filter(([, item]) => item.resetAt > now))
  const hit = crypto.randomUUID()
  for (let attempt = 0; attempt < 16; attempt++) {
    const throttles = live(await read())
    const gated = consumeThrottle({ users: [], sessions: [], resets: {}, throttles }, key, limit, windowMs, now, hit)
    if (!gated.ok) return false
    const next = live(gated.snapshot.throttles ?? {})
    const latest = live(await read())
    const merged = live(mergeThrottles(latest, next))
    await kv.put(bucket, JSON.stringify(merged))
    const verify = live(await read())
    const settled = live(mergeThrottles(verify, merged))
    if (JSON.stringify(settled) !== JSON.stringify(verify)) {
      await kv.put(bucket, JSON.stringify(settled))
    }
    const stored = settled[key]
    if (!stored) continue
    const hits = stored.hits ?? []
    const index = hits.indexOf(hit)
    if (index >= 0) return index < limit
    if (!hits.length && stored.count <= limit) return true
  }
  return false
}

export async function confirmKvThrottle(
  kv: { get(key: string, type: "json"): Promise<unknown>; put(key: string, value: string): Promise<void> },
  key: string,
  limit: number,
  windowMs: number,
  now = Date.now(),
  bucket = "track:throttles"
) {
  try {
    return { unread: false as const, allowed: await consumeKvThrottle(kv, key, limit, windowMs, now, bucket) }
  } catch {
    return { unread: true as const, allowed: false }
  }
}

export function clientIp(request: Request) {
  const forwarded = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || ""
  return forwarded.split(",")[0]?.trim() || "local"
}

const ACCOUNTS_UNREAD = "Não confirmei as contas."

class AuthPersistUnread extends Error {
  override name = "AuthPersistUnread"
  constructor() {
    super(ACCOUNTS_UNREAD)
  }
}

/** KV throw não é snapshot vazio: forgot/login não fingem primeiro acesso. */
async function readAuthSnapshot(store: AuthStore): Promise<{ snapshot: AuthSnapshot; unread: boolean }> {
  try {
    return { snapshot: structuredClone(prune(await store.load())), unread: false }
  } catch {
    return { snapshot: emptySnapshot(), unread: true }
  }
}

async function persistAuthSnapshot(store: AuthStore, snapshot: AuthSnapshot) {
  try {
    await store.save(snapshot)
  } catch {
    throw new AuthPersistUnread()
  }
}

function authPersistUnreadResponse(request: Request) {
  const path = new URL(request.url).pathname
  if (wantsAuthHtml(request)) {
    if (path.endsWith("/forgot")) return authHtml(authForgotDocument({ error: ACCOUNTS_UNREAD }), 503)
    if (path.endsWith("/reset")) return authHtml(authResetDocument({ error: ACCOUNTS_UNREAD }), 503)
    return authHtml(authLoginDocument({ error: ACCOUNTS_UNREAD }), 503)
  }
  return json({ error: ACCOUNTS_UNREAD }, 503)
}

function prune(snapshot: AuthSnapshot, now = Date.now()): AuthSnapshot {
  const revoked = clipAuthTokens(snapshot.revoked, AUTH_REVOKED_CAP)
  const revokedApi = clipAuthTokens(snapshot.revokedApi, AUTH_REVOKED_API_CAP)
  const spentResets = clipAuthTokens(snapshot.spentResets, AUTH_SPENT_RESET_CAP)
  const drop = new Set(revoked)
  const dropApi = new Set(revokedApi)
  return {
    users: snapshot.users.map((user) => ({
      ...user,
      tokens: mergeTokens(user.tokens, [], dropApi),
    })),
    sessions: snapshot.sessions.filter((item) => item.expiresAt > now && !drop.has(item.token)),
    resets: Object.fromEntries(
      Object.entries(snapshot.resets).filter(([token, item]) => item.expiresAt > now && !spentResets.includes(token))
    ),
    throttles: Object.fromEntries(Object.entries(snapshot.throttles ?? {}).filter(([, item]) => item.resetAt > now)),
    revoked,
    revokedApi,
    spentResets,
  }
}

export async function ensureOperatorUsers(store: AuthStore, password: string) {
  if (password.length < 6) return
  const loaded = await readAuthSnapshot(store)
  if (loaded.unread) return
  const snapshot = loaded.snapshot
  let changed = false
  for (const operator of OPERATORS) {
    const current = snapshot.users.find(
      (user) => user.email === operator.email || (user.aliases ?? []).some((item) => normalizeEmail(item) === operator.email)
    )
    if (!current) {
      snapshot.users.push({
        id: randomToken(8),
        email: operator.email,
        name: operator.name,
        passwordHash: await hashPassword(password),
        createdAt: new Date().toISOString(),
        passwordUpdatedAt: Date.now(),
        role: "owner",
        disabled: false,
      })
      changed = true
      continue
    }
    if (current.email === operator.email && current.name !== operator.name) {
      current.name = operator.name
      changed = true
    }
    if (current.role !== "owner" || current.disabled) {
      current.role = "owner"
      current.disabled = false
      changed = true
    }
  }
  if (changed) await persistAuthSnapshot(store, snapshot)
}

function readCookie(request: Request) {
  const header = request.headers.get("cookie") || ""
  const match = header.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${COOKIE}=`))
  return match ? decodeURIComponent(match.slice(COOKIE.length + 1)) : ""
}

function cookieHeader(token: string | null, secure: boolean) {
  if (!token) {
    return `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure ? "; Secure" : ""}`
  }
  return `${COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * DAY}${secure ? "; Secure" : ""}`
}

function json(data: unknown, status = 200, headers?: Record<string, string>) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
      ...headers,
    },
  })
}

type AuthBody = {
  email?: string
  password?: string
  currentPassword?: string
  token?: string
  next?: string
}

function authHtml(page: string, status = 200, headers?: Record<string, string>) {
  return new Response(page, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      ...headers,
    },
  })
}

async function readBody(request: Request): Promise<{ ok: true; body: AuthBody } | { ok: false; response: Response }> {
  const type = request.headers.get("content-type") || ""
  if (type.includes("application/x-www-form-urlencoded")) {
    const text = await request.text()
    if (text.length > 8_192) return { ok: false, response: json({ error: "Pedido demasiado grande." }, 413) }
    const params = new URLSearchParams(text)
    return {
      ok: true,
      body: {
        email: params.get("email") || "",
        password: params.get("password") || "",
        currentPassword: params.get("currentPassword") || "",
        token: params.get("token") || "",
        next: params.get("next") || "",
      },
    }
  }
  const parsed = await readJsonObject<AuthBody>(request, 8_192)
  if (!parsed.ok) {
    return {
      ok: false,
      response: json({ error: parsed.status === 413 ? "Pedido demasiado grande." : "JSON inválido." }, parsed.status),
    }
  }
  return { ok: true, body: parsed.value }
}

function loginFail(request: Request, error: string, status: number, body?: AuthBody) {
  if (wantsAuthHtml(request)) return authHtml(authLoginDocument({ next: body?.next, error }), status)
  return json({ error }, status)
}

function resetFail(request: Request, error: string, status: number, body?: AuthBody) {
  if (wantsAuthHtml(request)) return authHtml(authResetDocument({ token: body?.token, next: body?.next, error }), status)
  return json({ error }, status)
}

function resetLoginPath(next?: string) {
  const path = safeAppPath(next)
  return path === "/" ? "/login" : `/login?next=${encodeURIComponent(path)}`
}

export function retainUserSessions(sessions: Session[], userId: string, next: Session, cap = SESSION_CAP) {
  const others = sessions.filter((item) => item.userId !== userId)
  const mine = sessions
    .filter((item) => item.userId === userId)
    .sort((a, b) => b.issuedAt - a.issuedAt)
    .slice(0, Math.max(cap - 1, 0))
  return [...others, ...mine, next]
}

export function readBearer(request: Request) {
  const header = request.headers.get("authorization") || ""
  const match = /^Bearer\s+(\S+)/i.exec(header)
  return match?.[1]?.trim() || ""
}

export function requestHasAuth(request: Request) {
  return Boolean(readCookie(request) || readBearer(request))
}

export async function hashApiToken(token: string) {
  const bits = await crypto.subtle.digest("SHA-256", encoder.encode(token))
  return hex(new Uint8Array(bits))
}

export function mintApiToken(name: string) {
  const id = randomToken(8)
  const secret = randomToken(24)
  const token = `abn_${id}_${secret}`
  return {
    id,
    token,
    prefix: token.slice(0, 16),
    name: name.trim().slice(0, 60) || "Agente",
  }
}

export function rememberRevokedApi(snapshot: AuthSnapshot, ids: Iterable<string>): AuthSnapshot {
  return {
    ...snapshot,
    revokedApi: clipAuthTokens([...ids, ...(snapshot.revokedApi ?? [])], AUTH_REVOKED_API_CAP),
  }
}

export function dropUserApiTokens(snapshot: AuthSnapshot, user: StoredUser) {
  const ids = (user.tokens ?? []).map((item) => item.id)
  const next = rememberRevokedApi(snapshot, ids)
  snapshot.revokedApi = next.revokedApi
  user.tokens = []
}

export function dropUserSessions(snapshot: AuthSnapshot, user: StoredUser) {
  const dropped = snapshot.sessions.filter((item) => item.userId === user.id)
  snapshot.revoked = clipAuthTokens([...dropped.map((item) => item.token), ...(snapshot.revoked ?? [])], AUTH_REVOKED_CAP)
  snapshot.sessions = snapshot.sessions.filter((item) => item.userId !== user.id)
  for (const [token, rec] of Object.entries(snapshot.resets)) {
    if (rec.userId !== user.id) continue
    snapshot.spentResets = clipAuthTokens([token, ...(snapshot.spentResets ?? [])], AUTH_SPENT_RESET_CAP)
    delete snapshot.resets[token]
  }
}

export async function setManagedUserPassword(snapshot: AuthSnapshot, user: StoredUser, password: string) {
  user.passwordHash = await hashPassword(password)
  user.passwordUpdatedAt = Date.now()
  dropUserSessions(snapshot, user)
  dropUserApiTokens(snapshot, user)
}

export async function findUserByApiToken(snapshot: AuthSnapshot, token: string) {
  if (!token.startsWith("abn_") || token.length > 200) return null
  const hash = await hashApiToken(token)
  const id = token.split("_")[1] || ""
  const dropApi = new Set(snapshot.revokedApi ?? [])
  if (id && dropApi.has(id)) return null
  for (const user of snapshot.users) {
    if (user.disabled) continue
    const rec = (user.tokens ?? []).find((item) => item.hash === hash && (!id || item.id === id) && !dropApi.has(item.id))
    if (rec) return { user, token: rec }
  }
  return null
}

/** Cookie/bearer com snapshot sem contas: unread, não logout. */
export async function readActor(
  request: Request,
  store: AuthStore
): Promise<{ user: PublicUser | null; unread: boolean }> {
  const cookie = readCookie(request)
  const bearer = readBearer(request)
  if (!cookie && !bearer) return { user: null, unread: false }
  const loaded = await readAuthSnapshot(store)
  if (loaded.unread) return { user: null, unread: true }
  const snapshot = loaded.snapshot
  if (!snapshot.users.length) return { user: null, unread: true }
  if (cookie) {
    const session = snapshot.sessions.find((item) => item.token === cookie)
    const user = session ? snapshot.users.find((item) => item.id === session.userId) : null
    if (user && !user.disabled) return { user: publicUser(user), unread: false }
  }
  if (bearer) {
    const found = await findUserByApiToken(snapshot, bearer)
    if (found) return { user: publicUser(found.user), unread: false }
  }
  return { user: null, unread: false }
}

export async function requestActor(request: Request, store: AuthStore): Promise<PublicUser | null> {
  return (await readActor(request, store)).user
}

export async function sessionUser(request: Request, store: AuthStore) {
  return requestActor(request, store)
}

export async function gateActor(
  request: Request,
  store: AuthStore
): Promise<{ ok: true; user: PublicUser } | { ok: false; response: Response }> {
  const read = await readActor(request, store)
  if (read.unread) return { ok: false, response: json({ error: ACCOUNTS_UNREAD }, 503) }
  if (!read.user) return { ok: false, response: json({ error: "Sessão expirada." }, 401) }
  return { ok: true, user: read.user }
}

export async function handleAuth(request: Request, store: AuthStore, env?: { ABILION_OPERATOR_PASSWORD?: string; ABILION_ENV?: string }) {
  try {
    return await routeAuth(request, store, env)
  } catch (error) {
    if (error instanceof AuthPersistUnread) return authPersistUnreadResponse(request)
    throw error
  }
}

async function routeAuth(request: Request, store: AuthStore, env?: { ABILION_OPERATOR_PASSWORD?: string; ABILION_ENV?: string }) {
  const url = new URL(request.url)
  const path = url.pathname
  const secure = url.protocol === "https:"
  if (path === "/api/auth/login" && request.method === "POST" && env?.ABILION_OPERATOR_PASSWORD) {
    await ensureOperatorUsers(store, env.ABILION_OPERATOR_PASSWORD.trim())
  }

  if (path === "/api/auth/login" && request.method === "POST") {
    const parsed = await readBody(request)
    if (!parsed.ok) return parsed.response
    const body = parsed.body
    const email = (body.email || "").trim().toLowerCase()
    const password = body.password || ""
    if (!email || password.length < 6) {
      return loginFail(request, "Informe um e-mail e uma senha com 6+ caracteres.", 400, body)
    }
    const loaded = await readAuthSnapshot(store)
    if (loaded.unread) return loginFail(request, ACCOUNTS_UNREAD, 503, body)
    let snapshot = loaded.snapshot
    const guard = consumeThrottle(snapshot, `login:${clientIp(request)}:${email}`, 8, 15 * 60 * 1000)
    snapshot = guard.snapshot
    if (!guard.ok) {
      await persistAuthSnapshot(store, snapshot)
      return loginFail(request, "Muitas tentativas. Espera uns minutos e tenta de novo.", 429, body)
    }
    let user = snapshot.users.find((item) => item.email === email)
    if (!user) {
      const retired = snapshot.users.some((item) => (item.aliases ?? []).some((alias) => normalizeEmail(alias) === email))
      if (retired || !isOperatorEmail(email)) {
        await persistAuthSnapshot(store, snapshot)
        return loginFail(request, "E-mail ou senha inválidos.", 401, body)
      }
      user = {
        id: randomToken(8),
        email,
        name: operatorName(email),
        passwordHash: await hashPassword(password),
        createdAt: new Date().toISOString(),
        passwordUpdatedAt: Date.now(),
        role: "owner",
        disabled: false,
      }
      snapshot.users.push(user)
    } else if (user.disabled) {
      await persistAuthSnapshot(store, snapshot)
      return loginFail(request, "E-mail ou senha inválidos.", 401, body)
    } else if (!(await verifyPassword(password, user.passwordHash))) {
      await persistAuthSnapshot(store, snapshot)
      return loginFail(request, "E-mail ou senha inválidos.", 401, body)
    }
    const now = Date.now()
    const token = randomToken()
    snapshot = clearThrottle(snapshot, `login:${clientIp(request)}:${email}`)
    snapshot.sessions = retainUserSessions(snapshot.sessions, user.id, {
      token,
      userId: user.id,
      expiresAt: now + SESSION_TTL_MS,
      issuedAt: now,
    })
    await persistAuthSnapshot(store, snapshot)
    if (wantsAuthHtml(request)) {
      return new Response(null, {
        status: 303,
        headers: {
          location: safeAppPath(body.next),
          "set-cookie": cookieHeader(token, secure),
          "cache-control": "no-store",
        },
      })
    }
    return json({ user: publicUser(user) }, 200, { "set-cookie": cookieHeader(token, secure) })
  }

  if (path === "/api/auth/logout" && request.method === "POST") {
    const token = readCookie(request)
    const loaded = await readAuthSnapshot(store)
    if (!loaded.unread && loaded.snapshot.users.length) {
      const snapshot = loaded.snapshot
      if (token) snapshot.revoked = clipAuthTokens([token, ...(snapshot.revoked ?? [])], AUTH_REVOKED_CAP)
      snapshot.sessions = snapshot.sessions.filter((item) => item.token !== token)
      await persistAuthSnapshot(store, snapshot)
    }
    return json({ ok: true }, 200, { "set-cookie": cookieHeader(null, secure) })
  }

  if (path === "/api/auth/me" && request.method === "GET") {
    const read = await readActor(request, store)
    if (read.unread) return json({ error: ACCOUNTS_UNREAD }, 503)
    return json({ user: read.user })
  }

  if (path === "/api/auth/forgot" && request.method === "POST") {
    const parsed = await readBody(request)
    if (!parsed.ok) return parsed.response
    const email = (parsed.body.email || "").trim().toLowerCase()
    const html = wantsAuthHtml(request)
    if (!email) {
      return html
        ? authHtml(authForgotDocument({ next: parsed.body.next, error: "Informe o e-mail." }), 400)
        : json({ error: "Informe o e-mail." }, 400)
    }
    const loaded = await readAuthSnapshot(store)
    if (loaded.unread) {
      return html
        ? authHtml(authForgotDocument({ next: parsed.body.next, error: ACCOUNTS_UNREAD }), 503)
        : json({ error: ACCOUNTS_UNREAD }, 503)
    }
    let snapshot = loaded.snapshot
    if (!snapshot.users.length) {
      return html
        ? authHtml(
            authForgotDocument({
              next: parsed.body.next,
              done: "Em produção não enviamos e-mail. Entra e troca a senha em Configurações → Conta.",
            })
          )
        : json({ ok: true })
    }
    const guard = consumeThrottle(snapshot, `forgot:${clientIp(request)}`, 5, 15 * 60 * 1000)
    snapshot = guard.snapshot
    if (!guard.ok) {
      await persistAuthSnapshot(store, snapshot)
      return html
        ? authHtml(authForgotDocument({ next: parsed.body.next, error: "Muitas tentativas. Espera uns minutos e tenta de novo." }), 429)
        : json({ error: "Muitas tentativas. Espera uns minutos e tenta de novo." }, 429)
    }
    const user = snapshot.users.find((item) => item.email === email)
    let resetToken = ""
    if (user && !user.disabled) {
      for (const [key, rec] of Object.entries(snapshot.resets)) {
        if (rec.userId === user.id) delete snapshot.resets[key]
      }
      resetToken = randomToken()
      snapshot.resets[resetToken] = { userId: user.id, expiresAt: Date.now() + RESET_TTL_MS }
    }
    await persistAuthSnapshot(store, snapshot)
    if (user && resetToken && env?.ABILION_ENV !== "production") {
      const resetPath = `/reset?token=${resetToken}`
      return html
        ? authHtml(authForgotDocument({ next: parsed.body.next, done: `Link gerado. Abre ${resetPath}` }))
        : json({ ok: true, resetPath })
    }
    return html
      ? authHtml(
          authForgotDocument({
            next: parsed.body.next,
            done: "Em produção não enviamos e-mail. Entra e troca a senha em Configurações → Conta.",
          })
        )
      : json({ ok: true })
  }

  if (path === "/api/auth/password" && request.method === "POST") {
    const token = readCookie(request)
    const loaded = await readAuthSnapshot(store)
    if (loaded.unread) return json({ error: ACCOUNTS_UNREAD }, 503)
    let snapshot = loaded.snapshot
    if (token && !snapshot.users.length) return json({ error: ACCOUNTS_UNREAD }, 503)
    const session = snapshot.sessions.find((item) => item.token === token)
    const user = session ? snapshot.users.find((item) => item.id === session.userId) : null
    if (!user) return json({ error: "Sessão expirada." }, 401)
    const guard = consumeThrottle(snapshot, `password:${clientIp(request)}:${user.id}`, 5, 15 * 60 * 1000)
    snapshot = guard.snapshot
    if (!guard.ok) {
      await persistAuthSnapshot(store, snapshot)
      return json({ error: "Muitas tentativas. Espera uns minutos e tenta de novo." }, 429)
    }
    const parsed = await readBody(request)
    if (!parsed.ok) return parsed.response
    const body = parsed.body
    const currentPassword = body.currentPassword || ""
    const password = body.password || ""
    if (!(await verifyPassword(currentPassword, user.passwordHash))) {
      await persistAuthSnapshot(store, snapshot)
      return json({ error: "Senha atual inválida." }, 400)
    }
    if (password.length < 6) {
      await persistAuthSnapshot(store, snapshot)
      return json({ error: "A nova senha precisa de 6+ caracteres." }, 400)
    }
    user.passwordHash = await hashPassword(password)
    user.passwordUpdatedAt = Date.now()
    snapshot = clearThrottle(snapshot, `password:${clientIp(request)}:${user.id}`)
    const dropped = snapshot.sessions.filter((item) => item.userId === user.id && item.token !== token)
    snapshot.revoked = clipAuthTokens([...dropped.map((item) => item.token), ...(snapshot.revoked ?? [])], AUTH_REVOKED_CAP)
    snapshot.sessions = snapshot.sessions.filter((item) => item.userId !== user.id || item.token === token)
    dropUserApiTokens(snapshot, user)
    await persistAuthSnapshot(store, snapshot)
    return json({ ok: true })
  }

  if (path === "/api/auth/email" && request.method === "POST") {
    const token = readCookie(request)
    const loaded = await readAuthSnapshot(store)
    if (loaded.unread) return json({ error: ACCOUNTS_UNREAD }, 503)
    let snapshot = loaded.snapshot
    if (token && !snapshot.users.length) return json({ error: ACCOUNTS_UNREAD }, 503)
    const session = snapshot.sessions.find((item) => item.token === token)
    const user = session ? snapshot.users.find((item) => item.id === session.userId) : null
    if (!user) return json({ error: "Sessão expirada." }, 401)
    const guard = consumeThrottle(snapshot, `email:${clientIp(request)}:${user.id}`, 5, 15 * 60 * 1000)
    snapshot = guard.snapshot
    if (!guard.ok) {
      await persistAuthSnapshot(store, snapshot)
      return json({ error: "Muitas tentativas. Espera uns minutos e tenta de novo." }, 429)
    }
    const parsed = await readBody(request)
    if (!parsed.ok) return parsed.response
    const currentPassword = parsed.body.currentPassword || ""
    const email = normalizeEmail(parsed.body.email || "")
    if (!(await verifyPassword(currentPassword, user.passwordHash))) {
      await persistAuthSnapshot(store, snapshot)
      return json({ error: "Senha atual inválida." }, 400)
    }
    if (!isValidEmail(email)) {
      await persistAuthSnapshot(store, snapshot)
      return json({ error: "Informa um e-mail válido." }, 400)
    }
    if (emailInUse(snapshot.users, email, user.id)) {
      await persistAuthSnapshot(store, snapshot)
      return json({ error: "Já existe uma conta com este e-mail." }, 409)
    }
    if (email !== user.email) {
      const aliases = reservedOperatorAliases([user.email, ...(user.aliases ?? [])], email)
      user.email = email
      user.aliases = aliases.length ? aliases : undefined
      user.accountUpdatedAt = Date.now()
      if (holdsOperatorSeat(user)) {
        user.role = "owner"
        user.disabled = false
      }
    }
    snapshot = clearThrottle(snapshot, `email:${clientIp(request)}:${user.id}`)
    await persistAuthSnapshot(store, snapshot)
    return json({ ok: true, user: publicUser(user) })
  }

  if (path === "/api/auth/reset" && request.method === "POST") {
    const parsed = await readBody(request)
    if (!parsed.ok) return parsed.response
    const body = parsed.body
    const token = body.token || ""
    const password = body.password || ""
    if (!token || password.length < 6) return resetFail(request, "Token ou senha inválidos.", 400, body)
    const loaded = await readAuthSnapshot(store)
    if (loaded.unread) return resetFail(request, ACCOUNTS_UNREAD, 503, body)
    let snapshot = loaded.snapshot
    const guard = consumeThrottle(snapshot, `reset:${clientIp(request)}`, 5, 15 * 60 * 1000)
    snapshot = guard.snapshot
    if (!guard.ok) {
      await persistAuthSnapshot(store, snapshot)
      return resetFail(request, "Muitas tentativas. Espera uns minutos e tenta de novo.", 429, body)
    }
    const rec = snapshot.resets[token]
    if (!rec) {
      await persistAuthSnapshot(store, snapshot)
      return resetFail(request, "Link expirado ou inválido.", 400, body)
    }
    const user = snapshot.users.find((item) => item.id === rec.userId)
    if (!user || user.disabled) {
      snapshot.spentResets = clipAuthTokens([token, ...(snapshot.spentResets ?? [])], AUTH_SPENT_RESET_CAP)
      delete snapshot.resets[token]
      await persistAuthSnapshot(store, snapshot)
      return resetFail(request, "Link expirado ou inválido.", 400, body)
    }
    user.passwordHash = await hashPassword(password)
    user.passwordUpdatedAt = Date.now()
    const dropped = snapshot.sessions.filter((item) => item.userId === user.id)
    snapshot.revoked = clipAuthTokens([...dropped.map((item) => item.token), ...(snapshot.revoked ?? [])], AUTH_REVOKED_CAP)
    snapshot.spentResets = clipAuthTokens([token, ...(snapshot.spentResets ?? [])], AUTH_SPENT_RESET_CAP)
    snapshot.sessions = snapshot.sessions.filter((item) => item.userId !== user.id)
    dropUserApiTokens(snapshot, user)
    delete snapshot.resets[token]
    await persistAuthSnapshot(store, snapshot)
    if (wantsAuthHtml(request)) {
      return new Response(null, {
        status: 303,
        headers: {
          location: resetLoginPath(body.next),
          "cache-control": "no-store",
        },
      })
    }
    return json({ ok: true })
  }

  return json({ error: "not_found" }, 404)
}

export function kvAuthStore(kv: { get(key: string, type: "json"): Promise<unknown>; put(key: string, value: string): Promise<void> }): AuthStore {
  return {
    async load() {
      const raw = await kv.get("snapshot", "json")
      if (!raw || typeof raw !== "object") return emptySnapshot()
      const value = raw as Partial<AuthSnapshot>
      return structuredClone({
        users: Array.isArray(value.users) ? value.users : [],
        sessions: Array.isArray(value.sessions) ? value.sessions : [],
        resets: value.resets && typeof value.resets === "object" ? value.resets : {},
        throttles: value.throttles && typeof value.throttles === "object" ? value.throttles : {},
        revoked: clipAuthTokens(value.revoked, AUTH_REVOKED_CAP),
        revokedApi: clipAuthTokens(value.revokedApi, AUTH_REVOKED_API_CAP),
        spentResets: clipAuthTokens(value.spentResets, AUTH_SPENT_RESET_CAP),
      })
    },
    async save(next) {
      const current = await this.load()
      await kv.put("snapshot", JSON.stringify(mergeAuthSnapshots(current, next)))
    },
  }
}

export function memoryAuthStore(initial?: AuthSnapshot): AuthStore {
  let snapshot = initial ?? emptySnapshot()
  return {
    async load() {
      return structuredClone(snapshot)
    },
    async save(next) {
      snapshot = structuredClone(next)
    },
  }
}
