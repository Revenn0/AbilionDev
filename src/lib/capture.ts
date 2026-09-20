export function normalizeTelegramContact(contact: string) {
  const handle = contact.trim()
  if (!handle) return ""
  if (/^tg:\d+$/.test(handle)) return handle
  if (/^@?[A-Za-z][A-Za-z0-9_]{2,31}$/.test(handle)) return `@${handle.replace(/^@/, "")}`
  return handle
}

export function contactLookups(contact: string) {
  const raw = contact.trim()
  if (!raw) return []
  const digits = raw.replace(/\D/g, "")
  return [...new Set([raw, raw.replace(/^@/, ""), normalizeTelegramContact(raw), digits.length >= 8 ? digits : ""].filter(Boolean))]
}

export function validateCapture(name: string, contact: string) {
  const errors: { name?: string; contact?: string } = {}
  if (!name.trim()) errors.name = "Informa o nome do lead."
  const handle = contact.trim()
  if (!handle) errors.contact = "Informa o @user ou o contacto do Telegram."
  else if (!/^@?[A-Za-z][A-Za-z0-9_]{2,31}$/.test(handle) && !/^tg:\d+$/.test(handle)) {
    errors.contact = "Usa @user do Telegram ou tg:id."
  }
  return { ok: !errors.name && !errors.contact, errors, contact: handle ? normalizeTelegramContact(handle) : handle }
}
