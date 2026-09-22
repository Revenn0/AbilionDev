import { AlertTriangle, Inbox, LoaderCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export function PlatformFeedback({
  state,
  title,
  detail,
  onRetry,
  busy,
}: {
  state: "loading" | "error" | "empty"
  title: string
  detail?: string
  onRetry?: () => void
  busy?: boolean
}) {
  const Icon = state === "loading" ? LoaderCircle : state === "error" ? AlertTriangle : Inbox
  return (
    <div
      className="surface grid min-h-48 place-items-center px-6 py-10 text-center"
      role={state === "error" ? "alert" : "status"}
      aria-live="polite"
    >
      <div className="max-w-md">
        <Icon
          className={`mx-auto size-5 text-muted-foreground ${state === "loading" ? "animate-spin" : ""}`}
          strokeWidth={1.75}
        />
        <p className="mt-3 text-[14px] font-medium">{title}</p>
        {detail ? <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">{detail}</p> : null}
        {state === "error" && onRetry ? (
          <Button type="button" variant="outline" className="mt-4 rounded-full" disabled={busy} onClick={onRetry}>
            {busy ? "A tentar…" : "Tentar outra vez"}
          </Button>
        ) : null}
      </div>
    </div>
  )
}

export function ConfirmActionDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  busyLabel = "A concluir…",
  destructive,
  busy,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  confirmLabel: string
  busyLabel?: string
  destructive?: boolean
  busy?: boolean
  onConfirm: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={busy}>
              Cancelar
            </Button>
          </DialogClose>
          <Button
            type="button"
            variant={destructive ? "destructive" : "default"}
            disabled={busy}
            onClick={onConfirm}
          >
            {busy ? busyLabel : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
