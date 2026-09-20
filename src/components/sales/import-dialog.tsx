import { useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { funnelImportLabel, importFunnel } from "@/lib/funnel-import"
import { importFunnelRequest } from "@/lib/funnel-import-api"
import type { SalesFunnel } from "@/lib/types"

export function ImportFunnelDialog({
  open,
  onOpenChange,
  onImported,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImported: (funnel: SalesFunnel) => void
}) {
  const [name, setName] = useState("")
  const [raw, setRaw] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const [hint, setHint] = useState("")
  const lock = useRef(false)

  const reset = () => {
    setName("")
    setRaw("")
    setError("")
    setHint("")
    lock.current = false
    setBusy(false)
  }

  const preview = (text: string) => {
    setRaw(text)
    setError("")
    const parsed = importFunnel(text, name || "Funil importado")
    if (!parsed.ok) {
      setHint("")
      return
    }
    setHint(`${funnelImportLabel(parsed.source)} · ${parsed.funnel.nodes.length} blocos`)
    if (!name.trim()) setName(parsed.funnel.name)
  }

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    if (lock.current || busy) return
    const parsed = importFunnel(raw, name || "Funil importado")
    if (!parsed.ok) {
      setError(parsed.error)
      return
    }
    lock.current = true
    setBusy(true)
    void importFunnelRequest({ payload: raw, name: name.trim() || parsed.funnel.name })
      .then((result) => {
        onImported(result.funnel)
        onOpenChange(false)
        reset()
      })
      .catch((err: Error) => {
        setError(err.message)
        lock.current = false
        setBusy(false)
      })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset()
        onOpenChange(next)
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Importar funil</DialogTitle>
          <DialogDescription>
            Cola o JSON do ManyChat, n8n, Typebot ou um funil Abilion. Também aceita uma lista de mensagens, uma por linha.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="import-name">Nome</Label>
            <Input
              id="import-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={80}
              placeholder="Nome do funil"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="import-file">Ficheiro JSON</Label>
            <Input
              id="import-file"
              type="file"
              accept="application/json,.json,.txt"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (!file) return
                void file.text().then(preview)
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="import-json">JSON ou mensagens</Label>
            <Textarea
              id="import-json"
              value={raw}
              onChange={(event) => preview(event.target.value)}
              rows={8}
              placeholder='{"messages":["Olá","Este é o segundo passo"]}'
              aria-invalid={Boolean(error)}
              aria-describedby={error ? "import-error" : hint ? "import-hint" : undefined}
            />
            {hint ? (
              <p id="import-hint" className="text-[12px] text-muted-foreground">
                {hint}
              </p>
            ) : null}
            {error ? (
              <p id="import-error" role="alert" className="text-[12px] text-destructive">
                {error}
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={busy || !raw.trim()}>
              {busy ? "A importar…" : "Importar rascunho"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
