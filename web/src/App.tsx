import { useState } from "react"
import { Activity, Moon, Settings, Sun, WifiOff } from "lucide-react"

import { RatesCard } from "@/components/rates-card"
import { RemotePanel } from "@/components/remote-panel"
import { ServerCard } from "@/components/server-card"
import { SettingsDialog } from "@/components/settings-dialog"
import { useTheme } from "@/components/theme-provider"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useMonitor } from "@/hooks/use-monitor"
import { loadSettings, saveSettings, settingsConfigured, type Settings as AppSettings } from "@/lib/api"
import { cn } from "@/lib/utils"

function isDown(data: ReturnType<typeof useMonitor>): boolean {
  if (!data.status) return false
  return !data.status.ok || data.status.services.some((service) => !service.up)
}

export default function App() {
  const [settings, setSettings] = useState<AppSettings>(loadSettings)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const { theme, setTheme } = useTheme()

  const chat = useMonitor("chat", settings)
  const map = useMonitor("set", settings)
  const configured = settingsConfigured(settings)
  const anyDown = isDown(chat) || isDown(map)

  const persistSettings = (next: AppSettings) => {
    saveSettings(next)
    setSettings(next)
  }

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <img src="/logo.svg" alt="" className="size-9 rounded-xl" />
            <div>
              <h1 className="font-heading text-lg leading-tight font-semibold">Blink</h1>
              <p className="text-xs text-muted-foreground">Server status & IoT remote</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge
              variant={anyDown ? "destructive" : configured ? "secondary" : "outline"}
              className={cn(!anyDown && configured && "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400")}
            >
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  anyDown ? "bg-red-500" : configured ? "bg-emerald-500" : "bg-muted-foreground"
                )}
              />
              {anyDown ? "Alarm" : configured ? "All systems" : "Not configured"}
            </Badge>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              aria-label="Toggle theme"
              title="Toggle theme (D)"
            >
              {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setSettingsOpen(true)}>
              <Settings className="size-4" />
              <span className="hidden sm:inline">Settings</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-5 px-4 py-6 pb-20">
        {!configured && (
          <Card>
            <CardHeader>
              <CardTitle>Connect your agents</CardTitle>
              <CardDescription>
                Add your Blink API key to start polling both monitors. The default endpoints use the
                development proxy; change them in Settings for your own reverse proxy.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => setSettingsOpen(true)}>
                <Settings className="size-4" />
                Open settings
              </Button>
            </CardContent>
          </Card>
        )}

        {configured && anyDown && (
          <Alert variant="destructive">
            <WifiOff className="size-4" />
            <AlertTitle>Service down</AlertTitle>
            <AlertDescription>
              At least one monitored service is unreachable. Check the server cards below for details.
            </AlertDescription>
          </Alert>
        )}

        <section className="grid gap-5 lg:grid-cols-2">
          <ServerCard server="chat" data={chat} />
          <ServerCard server="set" data={map} />
        </section>

        <section className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(320px,400px)]">
          <RatesCard />
          <RemotePanel settings={settings} />
        </section>

        <footer className="flex items-center justify-center gap-2 pt-2 text-[11px] text-muted-foreground">
          <Activity className="size-3" />
          Blink PWA · polling every {(settings.refreshMs / 1000).toFixed(1)}s
        </footer>
      </main>

      {settingsOpen && (
        <SettingsDialog
          open
          onOpenChange={setSettingsOpen}
          settings={settings}
          onSave={persistSettings}
        />
      )}
    </div>
  )
}
