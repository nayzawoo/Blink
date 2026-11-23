import { useRef, useState, type ComponentType } from "react"
import { ChevronDown, ChevronUp, Power, RotateCcw, Tv, Volume2, VolumeX } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { sendStickCommand, type Settings } from "@/lib/api"
import { formatClock, formatRelativeTime } from "@/lib/format"
import type { StickCommandResult } from "@/lib/types"
import { cn } from "@/lib/utils"

const ICONS: Record<string, ComponentType<{ className?: string }>> = {
  power: Power,
  source: Tv,
  mute: VolumeX,
  prev: RotateCcw,
  vol_up: Volume2,
  vol_down: Volume2,
  ch_up: ChevronUp,
  ch_down: ChevronDown,
}

export function RemotePanel({ settings }: { settings: Settings }) {
  const [lastResult, setLastResult] = useState<StickCommandResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(0)
  const pendingRef = useRef(0)
  const hasToken = settings.stickIrToken.trim().length > 0

  const send = async (cmd: string) => {
    pendingRef.current += 1
    setPending(pendingRef.current)
    try {
      const result = await sendStickCommand(cmd, settings)
      setLastResult(result)
      setError(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to send command")
    } finally {
      pendingRef.current -= 1
      setPending(pendingRef.current)
    }
  }

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Tv className="size-4 text-muted-foreground" />
          Samsung TV Remote
        </CardTitle>
        <CardDescription>Stick IR · latest command wins</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {!hasToken && (
          <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
            Add a Stick IR token in Settings to enable the remote.
          </div>
        )}
        {error && (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error}
          </div>
        )}

        <div className="grid grid-cols-4 gap-2">
          {["power", "source", "mute", "prev", "vol_up", "vol_down", "ch_up", "ch_down"].map((cmd) => {
            const Icon = ICONS[cmd]
            const label = {
              power: "Power",
              source: "Source",
              mute: "Mute",
              prev: "Prev",
              vol_up: "Vol +",
              vol_down: "Vol −",
              ch_up: "CH +",
              ch_down: "CH −",
            }[cmd]

            return (
              <Button
                key={cmd}
                variant={cmd === "power" ? "destructive" : "secondary"}
                className="h-14 flex-col gap-1"
                disabled={!hasToken}
                onClick={() => void send(cmd)}
                title={label}
              >
                {Icon && <Icon className={cn("size-4", cmd === "vol_down" && "rotate-180")} />}
                <span className="text-[11px]">{label}</span>
              </Button>
            )
          })}
        </div>

        <div className="grid grid-cols-3 gap-2">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9", "prev", "0", "source"].map((cmd, index) => {
            const isDigit = /\d/.test(cmd)
            return (
              <Button
                key={`${cmd}-${index}`}
                variant="outline"
                className={cn("h-11", isDigit && "text-base font-semibold")}
                disabled={!hasToken}
                onClick={() => void send(cmd)}
              >
                {cmd === "prev" ? <RotateCcw className="size-4" /> : cmd === "source" ? <Tv className="size-4" /> : cmd}
              </Button>
            )
          })}
        </div>
      </CardContent>

      <CardFooter className="flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {pending > 0 ? (
            <Badge variant="secondary">Sending {pending}…</Badge>
          ) : lastResult ? (
            <>
              <Badge variant="secondary">Sent {lastResult.cmd}</Badge>
              <span>{formatClock(lastResult.created_at)}</span>
            </>
          ) : (
            <span>Ready</span>
          )}
        </div>
        {lastResult && (
          <span className="text-[11px] text-muted-foreground">
            updated {formatRelativeTime(lastResult.created_at)}
          </span>
        )}
      </CardFooter>
    </Card>
  )
}
