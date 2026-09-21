/** Catálogo estático do MCP do Worker. Não é leftover: é o que `tools/list` já expõe. */

export const MCP_PUBLIC_URL = "https://www.abilion.lol/mcp"
export const MCP_PUBLIC_ALIAS = "https://www.abilion.lol/api/mcp"

export const MCP_TOOLS = [
  {
    name: "abilion_health",
    description: "Estado público do estúdio: se o bot Telegram já tem username.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "abilion_list_users",
    description: "Lista as contas do estúdio (dono e operadores).",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "abilion_create_user",
    description: "Cria uma conta. Só o dono. A senha fica definida já; o e-mail não é criado no login.",
    inputSchema: {
      type: "object",
      properties: {
        email: { type: "string" },
        name: { type: "string" },
        password: { type: "string", minLength: 6 },
        role: { type: "string", enum: ["owner", "operator"] },
      },
      required: ["email", "password"],
      additionalProperties: false,
    },
  },
  {
    name: "abilion_patch_user",
    description: "Desliga, reactiva ou muda o papel de uma conta. Só o dono. Donos iniciais não desligam.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
        disabled: { type: "boolean" },
        role: { type: "string", enum: ["owner", "operator"] },
      },
      required: ["id"],
      additionalProperties: false,
    },
  },
  {
    name: "abilion_list_funnels",
    description: "Lista os funis do quadro.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "abilion_get_funnel",
    description: "Devolve um funil completo (nós e arestas).",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
      additionalProperties: false,
    },
  },
  {
    name: "abilion_create_funnel",
    description: "Cria um funil de rascunho com o quadro padrão da Sté.",
    inputSchema: {
      type: "object",
      properties: { name: { type: "string" } },
      additionalProperties: false,
    },
  },
  {
    name: "abilion_import_funnel",
    description: "Importa um funil ManyChat, n8n, Typebot, JSON Abilion ou lista de mensagens. Fica em rascunho, a menos que publish seja true.",
    inputSchema: {
      type: "object",
      properties: {
        payload: {},
        name: { type: "string" },
        publish: { type: "boolean" },
      },
      required: ["payload"],
      additionalProperties: false,
    },
  },
  {
    name: "abilion_publish_funnel",
    description: "Publica um funil. A Sté passa a seguir este quadro.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
      additionalProperties: false,
    },
  },
  {
    name: "abilion_list_leads",
    description: "Lista leads (recorte). q= busca no KV e no Postgres. Página do KV junta o backup pelo id — leftover não tapa a ficha viva. Não devolve o histórico completo da conversa.",
    inputSchema: {
      type: "object",
      properties: {
        q: { type: "string" },
        cursor: { type: "string" },
        limit: { type: "number" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "abilion_get_lead",
    description:
      "Devolve uma ficha pelo id (falas e timeline). KV e Postgres juntam-se. Miss no KV + backup em baixo é erro, não «já não está». A lista compacta não substitui isto.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
      additionalProperties: false,
    },
  },
  {
    name: "abilion_get_settings",
    description: "Definições públicas do estúdio. Sem tokens nem chat da Ester.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "abilion_create_token",
    description: "Cria um token MCP/API (abn_…) para esta conta. Só aparece uma vez.",
    inputSchema: {
      type: "object",
      properties: { name: { type: "string" } },
      additionalProperties: false,
    },
  },
  {
    name: "abilion_revoke_token",
    description: "Revoga um token MCP/API desta conta. O id fica no tombstone do KV e não volta no merge.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
      additionalProperties: false,
    },
  },
  {
    name: "abilion_page_install_manual",
    description:
      "Manual para instalar o pixel numa landing. Passos: 1) publica o funil 2) cria um script (abilion_create_page_script) 3) cola <script src=https://www.abilion.lol/t.js?v=2&s=ID data-cta=[data-abilion-cta]> 4) o anúncio aponta para a landing, não t.me 5) /start fica fb_sID_vid. Sem scriptId devolve o script geral; com scriptId o snippet daquela página/funil.",
    inputSchema: {
      type: "object",
      properties: { scriptId: { type: "string" } },
      additionalProperties: false,
    },
  },
  {
    name: "abilion_list_page_scripts",
    description: "Lista os scripts de página (um por landing/funil) e o snippet de cada um.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "abilion_create_page_script",
    description: "Cria um script para outra página/funil. O funil precisa de um quadro publicado. Devolve o snippet e o manual.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        funnelId: { type: "string" },
        pageUrl: { type: "string" },
      },
      required: ["name", "funnelId"],
      additionalProperties: false,
    },
  },
  {
    name: "abilion_delete_page_script",
    description: "Remove um script de página. As landings que ainda o colam passam a usar o funil publicado.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
      additionalProperties: false,
    },
  },
  {
    name: "abilion_import_leads",
    description: "Importa uma lista (nome, contacto) para um grupo do CRM. groupName cria ou escolhe o destino; toGroup=true é o atalho da categoria Grupo.",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string" },
        category: { type: "string" },
        groupName: { type: "string" },
        groupUrl: { type: "string" },
        toGroup: { type: "boolean" },
      },
      required: ["text"],
      additionalProperties: false,
    },
  },
] as const

export type McpToolName = (typeof MCP_TOOLS)[number]["name"]

export const MCP_TOOL_GROUPS = [
  {
    id: "estudio",
    label: "Estúdio",
    hint: "Lê o estado público. Sem tokens, sem chat da Ester.",
    tools: ["abilion_health", "abilion_get_settings"] as const,
  },
  {
    id: "contas",
    label: "Contas",
    hint: "Equipa do painel. Criar ou desligar é só do dono.",
    tools: ["abilion_list_users", "abilion_create_user", "abilion_patch_user"] as const,
  },
  {
    id: "funis",
    label: "Funis",
    hint: "Quadro da Sté. Import fica em rascunho até publicares.",
    tools: ["abilion_list_funnels", "abilion_get_funnel", "abilion_create_funnel", "abilion_import_funnel", "abilion_publish_funnel"] as const,
  },
  {
    id: "leads",
    label: "Leads",
    hint: "CRM. A lista é um recorte; a ficha completa é get_lead. Importar pede grupo.",
    tools: ["abilion_list_leads", "abilion_get_lead", "abilion_import_leads"] as const,
  },
  {
    id: "pixel",
    label: "Pixel e landings",
    hint: "O mesmo manual do painel e de GET /api/install.",
    tools: ["abilion_page_install_manual", "abilion_list_page_scripts", "abilion_create_page_script", "abilion_delete_page_script"] as const,
  },
  {
    id: "tokens",
    label: "Tokens do agente",
    hint: "abn_… desta conta. O valor completo só aparece uma vez.",
    tools: ["abilion_create_token", "abilion_revoke_token"] as const,
  },
] as const

export const MCP_RESOURCES = [
  {
    uri: "abilion://install",
    name: "Manual de instalação do pixel",
    hint: "Os mesmos 5 passos do painel, do t.js e de GET /api/install. Com /{scriptId} o snippet daquela página.",
  },
] as const

export const MCP_LIMITS = [
  "Não fala no Telegram como a Sté — o quadro publicado é que fala.",
  "Não liga o token do bot, a ElevenLabs nem as chaves da IA.",
  "abilion_get_settings não devolve tokens nem o chat da Ester.",
  "abilion_list_leads não devolve o histórico completo da conversa.",
  "Lista importada não avança print, espera nem oferta.",
] as const

export function mcpToolByName(name: string) {
  return MCP_TOOLS.find((item) => item.name === name)
}

export function mcpGroupedTools() {
  return MCP_TOOL_GROUPS.map((group) => ({
    ...group,
    items: group.tools.map((name) => {
      const tool = mcpToolByName(name)
      return { name, description: tool?.description ?? "" }
    }),
  }))
}

export function mcpClaudeSnippet(url = MCP_PUBLIC_URL) {
  return `{
  "mcpServers": {
    "abilion": {
      "command": "npx",
      "args": ["tsx", "mcp/server.mts"],
      "env": {
        "ABILION_URL": "${url.replace(/\/mcp$/, "")}",
        "ABILION_TOKEN": "abn_…"
      }
    }
  }
}`
}

export function mcpDirectHint(origin: string) {
  const local = origin.replace(/\/$/, "")
  const live = `${local}/mcp`
  return {
    publicUrl: MCP_PUBLIC_URL,
    alias: MCP_PUBLIC_ALIAS,
    studioUrl: live,
    sameHost: live === MCP_PUBLIC_URL || live === MCP_PUBLIC_ALIAS,
  }
}
