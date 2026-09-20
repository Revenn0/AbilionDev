import { useEffect, useRef, useState } from "react"
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

export function RenameFunnelDialog({
  open,
  name,
  onOpenChange,
  onSave,
}: {
  open: boolean
  name: string
  onOpenChange: (open: boolean) => void
  onSave: (name: string) => void
}) {
  const [value, setValue] = useState(name)
  const [error, setError] = useState("")
  const lock = useRef(false)

  useEffect(() => {
    if (open) {
      setValue(name)
      setError("")
      lock.current = false
    }
  }, [open, name])

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    if (lock.current) return
    const next = value.trim()
    if (!next) {
      setError("Informa o nome do funil.")
      return
    }
    lock.current = true
    onSave(next)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Alterar nome</DialogTitle>
          <DialogDescription>O nome aparece na lista e no editor do funil.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="funnel-name">Nome</Label>
            <Input
              id="funnel-name"
              value={value}
              onChange={(event) => {
                setValue(event.target.value)
                setError("")
              }}
              autoFocus
              maxLength={80}
              placeholder="Nome do funil"
              aria-invalid={Boolean(error)}
              aria-describedby={error ? "funnel-name-error" : undefined}
            />
            {error ? (
              <p id="funnel-name-error" role="alert" className="text-[12px] text-destructive">
                {error}
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit">Guardar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
