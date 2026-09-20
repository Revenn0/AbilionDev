export function validateCapture(name: string, contact: string) {
  const errors: { name?: string; contact?: string } = {}
  if (!name.trim()) errors.name = "Informa o nome do lead."
  if (!contact.trim()) errors.contact = "Informa o @user ou o contacto do Telegram."
  return { ok: !errors.name && !errors.contact, errors }
}
