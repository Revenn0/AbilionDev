document.querySelectorAll("[data-toggle-password]").forEach((button) => {
  button.addEventListener("click", () => {
    const id = button.getAttribute("data-toggle-password")
    const input = id ? document.getElementById(id) : null
    if (!(input instanceof HTMLInputElement)) return
    const hide = input.type === "text"
    input.type = hide ? "password" : "text"
    button.setAttribute("aria-label", hide ? "Mostrar senha" : "Ocultar senha")
    button.textContent = hide ? "Mostrar" : "Ocultar"
  })
})
