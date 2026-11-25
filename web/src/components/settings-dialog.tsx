import { useState, type FormEvent } from "react"
import { Bell, BellOff, BellRing, Send, ShieldAlert } from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
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
import type { usePushNotifications } from "@/hooks/use-push"
import type { Settings } from "@/lib/api"

interface SettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  settings: Settings
  onSave: (settings: Settings) => void
  push: ReturnType<typeof usePushNotifications>
}

export function SettingsDialog({ open, onOpenChange, settings, onSave, push }: SettingsDialogProps) {
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

          <div className="space-y-3 rounded-lg border p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                {push.subscribed ? <BellRing className="size-4 text-emerald-500" /> : <Bell className="size-4" />}
                Push notifications
              </div>
              <Badge variant={push.subscribed ? "secondary" : "outline"}>
                {push.subscribed ? "Enabled" : "Off"}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {push.needsHomeScreenInstall
                ? "On iOS, tap Share → Add to Home Screen, then open Blink from the Home Screen icon to enable Web Push."
                : "Receive instant alerts on this device when a monitored service goes down or recovers."}
            </p>
            {push.error && <p className="text-xs text-destructive">{push.error}</p>}
            {push.notice && <p className="text-xs text-emerald-600 dark:text-emerald-400">{push.notice}</p>}
            <div className="flex flex-wrap gap-2">
              {push.subscribed ? (
                <>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={push.busy}
                    onClick={() => void push.sendTest()}
                  >
                    <Send className="size-3.5" />
                    Send test
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={push.busy}
                    onClick={() => void push.disable()}
                  >
                    <BellOff className="size-3.5" />
                    Disable
                  </Button>
                </>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={push.busy || (!push.supported && !push.needsHomeScreenInstall)}
                  onClick={() => void push.enable()}
                >
                  <Bell className="size-3.5" />
                  Enable alerts
                </Button>
              )}
            </div>
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
