import { useState } from "react"
import { Link } from "react-router-dom"
import { Copy, Terminal } from "lucide-react"
import { Button } from "@/components/ui/button"
import { StatusPill } from "@/components/layout/chrome"
import { workerUrl } from "@/lib/channel"
import {
  MCP_LIMITS,
  MCP_PUBLIC_URL,
  MCP_RESOURCES,
  MCP_TOOLS,
  mcpClaudeSnippet,
  mcpDirectHint,
  mcpGroupedTools,
} from "@/lib/mcp-catalog.ts"
import { toast } from "sonner"

export function McpPane() {
  const hint = mcpDirectHint(workerUrl())
  const groups = mcpGroupedTools()
  const [copied, setCopied] = useState<"url" | "snippet" | "">("")

  const copy = (value: string, which: "url" | "snippet") => {
    void navigator.clipboard.writeText(value).then(() => {
      setCopied(which)
      toast.success(which === "url" ? "URL do MCP copiado." : "Snippet do Claude copiado.")
    })
  }

  return (
    <div id="mcp" data-settings-mcp className="grid max-w-3xl gap-3">
      <section className="surface p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[14px] font-medium">Onde o agente entra</p>
            <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
              O MCP do Abilion é JSON-RPC no Worker. Claude Code e outros agentes falam com este URL, com um Bearer{" "}
              <code className="text-foreground">abn_…</code> gerado em Utilizadores. A sessão do painel também entra.
            </p>
          </div>
          <StatusPill>{MCP_TOOLS.length} ferramentas</StatusPill>
        </div>
        <dl className="mt-5 space-y-2 text-[12.5px]">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <dt className="text-muted-foreground">Produção</dt>
            <dd className="break-all font-medium" data-mcp-url>
              {hint.publicUrl}
            </dd>
          </div>
          {hint.sameHost ? null : (
            <div className="flex flex-wrap items-start justify-between gap-2">
              <dt className="text-muted-foreground">Este estúdio</dt>
              <dd className="break-all font-medium">{hint.studioUrl}</dd>
            </div>
          )}
          <div className="flex flex-wrap items-start justify-between gap-2">
            <dt className="text-muted-foreground">Alias</dt>
            <dd className="break-all font-medium">{hint.alias}</dd>
          </div>
        </dl>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" variant="outline" className="rounded-full" onClick={() => copy(MCP_PUBLIC_URL, "url")}>
            <Copy className="size-3.5" />
            {copied === "url" ? "Copiado" : "Copiar URL"}
          </Button>
          <Button asChild className="rounded-full">
            <Link to="/utilizadores">Gerar token em Utilizadores</Link>
          </Button>
        </div>
      </section>

      <section className="surface p-6">
        <p className="text-[14px] font-medium">O que o agente pode fazer</p>
        <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
          Isto é o catálogo que o Worker já expõe em <code className="text-foreground">tools/list</code>. Não há ferramenta
          inventada aqui — o que não aparece, o agente não faz.
        </p>
        <div className="mt-5 space-y-5">
          {groups.map((group) => (
            <div key={group.id} data-mcp-group={group.id}>
              <p className="text-[13px] font-medium">{group.label}</p>
              <p className="mt-0.5 text-[12px] text-muted-foreground">{group.hint}</p>
              <ul className="mt-2 divide-y divide-border overflow-hidden rounded-xl border border-border">
                {group.items.map((item) => (
                  <li key={item.name} className="px-3.5 py-2.5">
                    <code className="text-[12.5px] font-medium text-foreground">{item.name}</code>
                    <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">{item.description}</p>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-5">
          <p className="text-[13px] font-medium">Recurso</p>
          <p className="mt-0.5 text-[12px] text-muted-foreground">Leitura à parte das ferramentas, no mesmo servidor.</p>
          <ul className="mt-2 divide-y divide-border overflow-hidden rounded-xl border border-border">
            {MCP_RESOURCES.map((item) => (
              <li key={item.uri} className="px-3.5 py-2.5">
                <code className="text-[12.5px] font-medium">{item.uri}</code>
                <p className="mt-1 text-[12.5px] text-muted-foreground">{item.hint}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="surface p-6">
        <p className="text-[14px] font-medium">O que o agente não faz</p>
        <ul className="mt-3 space-y-2 text-[12.5px] leading-relaxed text-muted-foreground">
          {MCP_LIMITS.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section className="surface p-6">
        <div className="flex items-center gap-2">
          <Terminal className="size-4 text-muted-foreground" />
          <p className="text-[14px] font-medium">Claude Code</p>
        </div>
        <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
          Cola isto em <code className="text-foreground">mcp/claude.example.json</code> ou no config do Claude. O token
          sai de Utilizadores — o valor completo só aparece uma vez.
        </p>
        <pre className="mt-4 overflow-x-auto rounded-xl bg-muted/60 p-3 text-[11.5px] leading-relaxed">{mcpClaudeSnippet()}</pre>
        <Button type="button" variant="outline" className="mt-3 rounded-full" onClick={() => copy(mcpClaudeSnippet(), "snippet")}>
          <Copy className="size-3.5" />
          {copied === "snippet" ? "Copiado" : "Copiar snippet"}
        </Button>
      </section>
    </div>
  )
}
