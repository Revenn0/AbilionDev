import { nameFromEmail } from "./format.ts"

const PARTICLES = new Set(["de", "da", "das", "do", "dos", "e", "em", "del", "di", "du"])

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

export function displayContact(value: string) {
  const trimmed = value.trim()
  return isPhoneLikeName(trimmed) ? formatPhoneContact(trimmed) : trimmed
}

/** Nome apresentável. Contacto (telefone / @user) não se inventa nem se substitui. */
export function resolveLeadName(name?: string, contact?: string) {
  const rawName = (name ?? "").trim()
  const rawContact = (contact ?? "").trim()
  if (rawName && !isPhoneLikeName(rawName)) {
    const resolved = resolvePersonName(rawName)
    if (resolved) return resolved
  }
  if (rawName && isPhoneLikeName(rawName)) return formatPhoneContact(rawName)
  if (rawContact && isPhoneLikeName(rawContact)) return formatPhoneContact(rawContact)
  if (rawContact && isEmailName(rawContact)) return nameFromEmail(rawContact)
  return resolvePersonName(rawName || rawContact) || "Lead"
}
