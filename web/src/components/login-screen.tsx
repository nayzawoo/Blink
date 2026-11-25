import { useState, type FormEvent } from "react"
import { LoaderCircle, Lock, LogIn, Moon, Sun } from "lucide-react"

import { useTheme } from "@/components/theme-provider"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { loadSettings, saveSettings } from "@/lib/api"
import { markAuthenticated, verifyCredentials } from "@/lib/auth"
import { decryptEmbeddedSecrets } from "@/lib/secrets"

export function LoginScreen({ onSuccess }: { onSuccess: () => void }) {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const { theme, setTheme } = useTheme()

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const valid = await verifyCredentials(username, password)
      if (valid) {
        try {
          const embedded = await decryptEmbeddedSecrets(password)
          if (embedded) {
            const current = loadSettings()
            saveSettings({
              ...current,
              blinkApiKey: current.blinkApiKey.trim() || embedded.blinkApiKey,
              stickIrToken: current.stickIrToken.trim() || embedded.stickIrToken,
            })
          }
        } catch {
          // Keep manual settings flow if embedded secrets cannot be decrypted.
        }
        markAuthenticated()
        onSuccess()
      } else {
        setError("Invalid username or password.")
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to verify credentials.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-dvh items-center justify-center bg-background px-4 py-10">
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-4 right-4"
        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        aria-label="Toggle theme"
      >
        {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
      </Button>

      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <div className="mb-2 flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Lock className="size-5" />
          </div>
          <CardTitle className="text-xl">Blink</CardTitle>
          <CardDescription>Sign in to open the dashboard</CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={(event) => void submit(event)} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                name="username"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <LogIn className="size-4" />
              )}
              {loading ? "Verifying…" : "Sign in"}
            </Button>

            <p className="text-center text-[11px] leading-relaxed text-muted-foreground">
              Credentials are checked locally using a salted PBKDF2-SHA256 hash.
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
