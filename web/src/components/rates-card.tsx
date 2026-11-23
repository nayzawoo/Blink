import { useEffect, useState } from "react"
import { ArrowDownRight, ArrowUpRight, CircleDollarSign, RefreshCw } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { fetchRates } from "@/lib/api"
import { formatRelativeTime } from "@/lib/format"
import type { RatesResponse } from "@/lib/types"
import { cn } from "@/lib/utils"

export function RatesCard() {
  const [rates, setRates] = useState<RatesResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [updatedAt, setUpdatedAt] = useState<number | null>(null)

  const refresh = async () => {
    setLoading(true)
    try {
      setRates(await fetchRates())
      setUpdatedAt(Date.now())
      setError(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to load rates")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    queueMicrotask(() => void refresh())
    const interval = window.setInterval(() => void refresh(), 10 * 60_000)
    return () => window.clearInterval(interval)
  }, [])

  const current = rates?.payoneer.buy_current
  const previous = rates?.payoneer.buy_previous
  const delta = current !== undefined && previous !== undefined && previous !== null ? current - previous : null

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CircleDollarSign className="size-4 text-muted-foreground" />
          Exchange Rates
        </CardTitle>
        <CardDescription>
          Payoneer / Wise · updated {formatRelativeTime(updatedAt)}
        </CardDescription>
        <CardAction>
          <Button variant="ghost" size="icon" className="size-7" onClick={() => void refresh()} title="Refresh rates">
            <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-3">
        {error && <p className="text-xs text-destructive">{error}</p>}
        {!rates ? (
          <p className="text-xs text-muted-foreground">Loading rates…</p>
        ) : (
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Payoneer buy</p>
              <p className="text-3xl font-semibold tabular-nums">{current ?? "—"}</p>
            </div>
            {delta !== null && (
              <Badge variant={delta >= 0 ? "secondary" : "destructive"}>
                {delta >= 0 ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
                {Math.abs(delta)} vs previous
              </Badge>
            )}
            {rates.wise?.buy_current !== undefined && rates.wise.buy_current !== null && (
              <div className="text-right">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Wise buy</p>
                <p className="text-xl font-medium tabular-nums">{rates.wise.buy_current}</p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
