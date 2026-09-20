import { nameFromEmail } from "./format.ts"

const PARTICLES = new Set(["de", "da", "das", "do", "dos", "e", "em", "del", "di", "du"])
const PLACEHOLDER = /^(lead|contato|contacto|cliente|whatsapp|unknown|sem nome|n\/a|na|teste)$/i
const NAME_FROM_TALK =
  /(?:meu nome(?:\s+(?:é|e|eh|é))|me chamo|pode me chamar de|eu sou (?:o|a))\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'’\s-]{1,40})/i

export function isPhoneLikeName(value: string) {
  const trimmed = value.trim()
  const digits = trimmed.replace(/\D/g, "")
  return digits.length >= 8 && /^[\d+\s()-]+$/.test(trimmed)
}

export function isEmailName(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}

export function formatPhoneContact(value: string) {
  const trimmed = value.trim()
  const digits = trimmed.replace(/\D/g, "")
  if (digits.length < 8) return trimmed
  const international = digits.startsWith("55") && digits.length >= 12
  const local = international ? digits.slice(2) : digits
  const prefix = international ? "+55 " : ""
  if (local.length === 11) return `${prefix}${local.slice(0, 2)} ${local.slice(2, 7)}-${local.slice(7)}`.trim()
  if (local.length === 10) return `${prefix}${local.slice(0, 2)} ${local.slice(2, 6)}-${local.slice(6)}`.trim()
  if (international) return `+55 ${local}`.trim()
  return trimmed
}

function letterCount(value: string) {
  return value.replace(/[^A-Za-zÀ-ÿ]/g, "").length
}

export function isResolvedPersonName(value: string) {
  const trimmed = value.trim()
  if (trimmed.length < 2) return false
  if (isPhoneLikeName(trimmed) || isEmailName(trimmed)) return false
  if (/^tg:/i.test(trimmed) || trimmed.startsWith("@")) return false
  if (PLACEHOLDER.test(trimmed)) return false
  return letterCount(trimmed) >= 2
}

export function resolvePersonName(value: string) {
  const cleaned = value.replace(/^[^A-Za-zÀ-ÿ@+]+/, "").replace(/\s+/g, " ").trim()
  if (!cleaned) return ""
  if (isPhoneLikeName(cleaned)) return formatPhoneContact(cleaned)
  if (isEmailName(cleaned)) return nameFromEmail(cleaned)
  return cleaned
    .split(" ")
    .map((part, index) => {
      const lower = part.toLocaleLowerCase("pt-BR")
      if (index > 0 && PARTICLES.has(lower)) return lower
      if (/['’]/.test(part)) {
        return part
          .split(/['’]/)
          .map((piece) => {
            const next = piece.toLocaleLowerCase("pt-BR")
            return next.charAt(0).toLocaleUpperCase("pt-BR") + next.slice(1)
          })
          .join("'")
      }
      return lower.charAt(0).toLocaleUpperCase("pt-BR") + lower.slice(1)
    })
    .join(" ")
}

function personPartFromMixed(value: string) {
  const trimmed = value.trim()
  const digits = trimmed.replace(/\D/g, "")
  if (digits.length < 8) return isResolvedPersonName(trimmed) ? trimmed : ""
  const stripped = trimmed.replace(/[\d+\s()-]{8,}/g, " ").replace(/\s+/g, " ").trim()
  return isResolvedPersonName(stripped) ? stripped : ""
}

export function nameFromMessages(messages?: Array<{ role?: string; text?: string }>) {
  if (!messages?.length) return ""
  for (const message of messages) {
    if (message.role && message.role !== "lead") continue
    const text = (message.text ?? "").replace(/\s+/g, " ").trim()
    const match = text.match(NAME_FROM_TALK)
    if (!match?.[1]) continue
    const extracted = match[1].replace(/[.,;!?].*$/, "").trim()
    if (isResolvedPersonName(extracted)) return extracted
  }
  return ""
}

function titledPerson(value: string) {
  if (!value || isPhoneLikeName(value)) return ""
  const resolved = resolvePersonName(value)
  return isResolvedPersonName(resolved) ? resolved : ""
}

export type LeadNameExtra = {
  email?: string
  messages?: Array<{ role?: string; text?: string }>
}

export function displayContact(value: string) {
  const trimmed = value.trim()
  return isPhoneLikeName(trimmed) ? formatPhoneContact(trimmed) : trimmed
}

export function foldSearch(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9@+]+/g, " ")
    .trim()
}

export type LeadSearchFields = {
  id: string
  name: string
  contact: string
  telegramChatId?: string
  campaign?: string
  lastMessage?: string
}

/** Worker exige 3+ caracteres. O painel passa 1 para a lista já hidratada. */
export function leadMatchesQuery(lead: LeadSearchFields, query: string, minLength = 3) {
  const raw = query.trim()
  if (raw.length < minLength) return false
  if (lead.id === raw) return true
  const needle = foldSearch(raw)
  if (!needle) return false
  const hay = foldSearch(
    [
      lead.name,
      lead.contact,
      lead.telegramChatId ?? "",
      displayContact(lead.contact),
      displayContact(lead.name),
      lead.campaign ?? "",
      lead.lastMessage ?? "",
    ].join(" ")
  )
  if (hay.includes(needle)) return true
  const digits = raw.replace(/\D/g, "")
  if (digits.length < 8) return false
  const contactDigits = `${lead.contact}${lead.name}${lead.telegramChatId ?? ""}`.replace(/\D/g, "")
  return contactDigits.includes(digits)
}

/** Nome apresentável. Contacto (telefone / @user) não se inventa nem se substitui. */
export function resolveLeadName(name?: string, contact?: string, extra?: LeadNameExtra) {
  const rawName = (name ?? "").trim()
  const rawContact = (contact ?? "").trim()
  const fromMixed = personPartFromMixed(rawName)
  const fromTalk = nameFromMessages(extra?.messages)
  const email = (extra?.email ?? "").trim()
  const fromEmail = email && isEmailName(email) ? nameFromEmail(email) : isEmailName(rawName) ? nameFromEmail(rawName) : ""
  const rawPerson = titledPerson(fromMixed)
  if (rawPerson) {
    if (rawPerson.split(" ").length === 1 && titledPerson(fromEmail).split(" ").length >= 2) return titledPerson(fromEmail)
    return rawPerson
  }
  const next = titledPerson(fromTalk) || titledPerson(fromEmail)
  if (next) return next
  if (rawName && isPhoneLikeName(rawName)) return formatPhoneContact(rawName)
  if (rawContact && isPhoneLikeName(rawContact)) return formatPhoneContact(rawContact)
  if (rawContact && isEmailName(rawContact)) return nameFromEmail(rawContact)
  return resolvePersonName(rawName || rawContact) || "Lead"
}

export function preferLeadName(primary: string, fallback: string, contact?: string, extra?: LeadNameExtra) {
  const left = titledPerson(primary)
  if (left) return left
  const right = titledPerson(fallback)
  if (right) return right
  return resolveLeadName(primary || fallback, contact, extra)
}
