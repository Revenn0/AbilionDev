try {
  if (localStorage.getItem("abilion-theme") === "dark") {
    document.documentElement.classList.add("dark")
    document.documentElement.style.colorScheme = "dark"
  }
} catch {
  /* localStorage pode falhar em modo privado */
}
