import { safeAppPath } from "./safe-path.ts"

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function authShell(title: string, body: string) {
  return `<!doctype html>
<html lang="pt">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)} · Abilion</title>
<meta name="description" content="Estúdio Abilion. Sem cadastro público.">
<style>
  html,body{margin:0;background:#0b0d12;color:#f4f4f5;font-family:ui-sans-serif,system-ui,sans-serif}
  main{box-sizing:border-box;min-height:100vh;display:grid;place-items:center;padding:1.5rem}
  .card{width:100%;max-width:22rem;padding:1.5rem;border:1px solid #27272a;border-radius:12px;background:#18181b}
  .brand{margin:0;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#38bdf8}
  h1{margin:8px 0 0;font-size:22px;letter-spacing:-.03em}
  label{display:block;margin:16px 0 6px;font-size:13px}
  input{box-sizing:border-box;width:100%;height:40px;padding:0 12px;border:1px solid #3f3f46;border-radius:8px;background:#09090b;color:#fafafa;font-size:14px}
  input:focus{outline:2px solid #38bdf8;outline-offset:1px}
  button{width:100%;height:40px;margin-top:20px;border:0;border-radius:8px;background:#38bdf8;color:#082f49;font-size:14px;font-weight:600}
  button:focus-visible{outline:2px solid #e0f2fe;outline-offset:2px}
  .err{margin:12px 0 0;font-size:13px;color:#fca5a5}
  .ok{margin:12px 0 0;font-size:13px;color:#a1a1aa}
  nav{margin-top:16px;font-size:13px}
  nav a{color:#7dd3fc}
  .hint{margin:8px 0 0;font-size:13px;color:#a1a1aa;line-height:1.5}
</style>
</head>
<body>
<main id="conteudo" tabindex="-1">
<div class="card">${body}</div>
</main>
</body>
</html>`
}

/** HTML do /login no Worker: e-mail e senha no primeiro byte, sem esperar o SPA. */
export function authLoginDocument(input: { next?: string | null; error?: string } = {}) {
  const next = safeAppPath(input.next)
  const error = (input.error || "").trim().slice(0, 180)
  return authShell(
    "Entrar",
    `<p class="brand">Abilion</p>
<h1>Entrar</h1>
<p class="hint">Victor e Gabriel definem a senha no primeiro acesso. As outras contas vêm de Utilizadores.</p>
${error ? `<p id="login-error" role="alert" class="err">${escapeHtml(error)}</p>` : ""}
<form method="post" action="/api/auth/login" accept-charset="utf-8">
<input type="hidden" name="next" value="${escapeHtml(next)}">
<label for="email">E-mail</label>
<input id="email" name="email" type="email" autocomplete="email" required>
<label for="password">Senha</label>
<input id="password" name="password" type="password" autocomplete="current-password" minlength="6" required>
<button type="submit">Entrar</button>
</form>
<nav><a href="${escapeHtml(next === "/" ? "/forgot" : `/forgot?next=${encodeURIComponent(next)}`)}">Esqueceu a senha?</a> · <a href="/privacidade">Privacidade</a></nav>`
  )
}

export function authForgotDocument(input: { next?: string | null; error?: string; done?: string } = {}) {
  const next = safeAppPath(input.next)
  const loginHref = next === "/" ? "/login" : `/login?next=${encodeURIComponent(next)}`
  const error = (input.error || "").trim().slice(0, 180)
  const done = (input.done || "").trim().slice(0, 240)
  return authShell(
    "Redefinir senha",
    `<p class="brand">Abilion</p>
<h1>Redefinir senha</h1>
<p class="hint">Localmente gera um link. Em produção não há e-mail — troca a senha em Configurações → Conta.</p>
${error ? `<p id="forgot-error" role="alert" class="err">${escapeHtml(error)}</p>` : ""}
${done ? `<p id="forgot-done" role="status" class="ok">${escapeHtml(done)}</p>` : ""}
<form method="post" action="/api/auth/forgot" accept-charset="utf-8">
<input type="hidden" name="next" value="${escapeHtml(next)}">
<label for="email">E-mail</label>
<input id="email" name="email" type="email" autocomplete="email" required>
<button type="submit">Gerar link</button>
</form>
<nav><a href="${escapeHtml(loginHref)}">Voltar ao login</a></nav>`
  )
}

export function authPrivacyDocument() {
  return authShell(
    "Privacidade",
    `<p class="brand">Abilion</p>
<h1>Política de privacidade</h1>
<p class="hint">O Abilion é um CRM interno. Não há cadastro público. A sessão fica num cookie HttpOnly abilion_session. O pixel /t.js grava visita e visitor id. Em produção “Esqueceu a senha?” não envia e-mail.</p>
<nav><a href="/login">Voltar ao login</a> · <a href="/l">Landing</a></nav>`
  )
}

export function wantsAuthHtml(request: Request) {
  const type = request.headers.get("content-type") || ""
  return type.includes("application/x-www-form-urlencoded")
}
