import { useState, type FormEvent } from "react"
import { ShieldAlert } from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"
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
import type { Settings } from "@/lib/api"

interface SettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  settings: Settings
  onSave: (settings: Settings) => void
}

export function SettingsDialog({ open, onOpenChange, settings, onSave }: SettingsDialogProps) {
  const [draft, setDraft] = useState<Settings>(settings)

  const update = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    onSave({
      ...draft,
      blinkApiKey: draft.blinkApiKey.trim(),
      chatBaseUrl: draft.chatBaseUrl.trim(),
      setBaseUrl: draft.setBaseUrl.trim(),
      stickIrBaseUrl: draft.stickIrBaseUrl.trim(),
      stickIrToken: draft.stickIrToken.trim(),
      refreshMs: Math.min(60_000, Math.max(500, Number(draft.refreshMs) || 1500)),
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Dashboard settings</DialogTitle>
          <DialogDescription>
            Endpoints and tokens are saved in this browser only. Nothing is sent anywhere except the
            configured servers.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4 py-2">
          <Alert>
            <ShieldAlert className="size-4" />
            <AlertDescription>
              Use a browser profile you trust. Tokens in localStorage are readable by scripts running
              on this origin.
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label htmlFor="blinkApiKey">Blink API key</Label>
            <Input
              id="blinkApiKey"
              type="password"
              autoComplete="off"
              placeholder="matches BLINK_API_KEY on the agents"
              value={draft.blinkApiKey}
              onChange={(event) => update("blinkApiKey", event.target.value)}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="chatBaseUrl">Chat monitor base URL</Label>
              <Input
                id="chatBaseUrl"
                placeholder="/chat-api"
                value={draft.chatBaseUrl}
                onChange={(event) => update("chatBaseUrl", event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="setBaseUrl">Map monitor base URL</Label>
              <Input
                id="setBaseUrl"
                placeholder="/set-api"
                value={draft.setBaseUrl}
                onChange={(event) => update("setBaseUrl", event.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="stickIrBaseUrl">Stick IR base URL</Label>
              <Input
                id="stickIrBaseUrl"
                placeholder="/stick-api"
                value={draft.stickIrBaseUrl}
                onChange={(event) => update("stickIrBaseUrl", event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="stickIrToken">Stick IR token</Label>
              <Input
                id="stickIrToken"
                type="password"
                autoComplete="off"
                placeholder="Bearer token for /api/stick/ir/commands"
                value={draft.stickIrToken}
                onChange={(event) => update("stickIrToken", event.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="refreshMs">Status refresh interval (ms)</Label>
            <Input
              id="refreshMs"
              type="number"
              min={500}
              max={60000}
              step={100}
              value={draft.refreshMs}
              onChange={(event) => update("refreshMs", Number(event.target.value))}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">Save settings</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
