export function validateCapture(name: string, contact: string) {
  const errors: { name?: string; contact?: string } = {}
  if (!name.trim()) errors.name = "Informa o nome do lead."
  const handle = contact.trim()
  if (!handle) errors.contact = "Informa o @user ou o contacto do Telegram."
  else if (!/^@?[A-Za-z0-9_]{3,32}$/.test(handle) && !/^tg:\d+$/.test(handle)) {
    errors.contact = "Usa @user do Telegram ou tg:id."
  }
  return { ok: !errors.name && !errors.contact, errors }
}
