import { Activity, Cpu, MapPin, MessageSquare, RefreshCw, Server } from "lucide-react"

import { HistoryChart, RadialGauge, Sparkline } from "@/components/charts"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { formatBytes, formatPercent, formatRelativeTime } from "@/lib/format"
import type { ServerKey } from "@/lib/types"
import type { useMonitor } from "@/hooks/use-monitor"
import { cn } from "@/lib/utils"

const SERVER_META = {
  chat: {
    title: "Chat Server",
    subtitle: "chat-agent",
    icon: MessageSquare,
  },
  set: {
    title: "Map Server",
    subtitle: "set-agent",
    icon: MapPin,
  },
} as const

interface ServerCardProps {
  server: ServerKey
  data: ReturnType<typeof useMonitor>
}

export function ServerCard({ server, data }: ServerCardProps) {
  const { status, history, live, error, loading, historyLoading, refreshStatus, refreshHistory } = data
  const meta = SERVER_META[server]
  const Icon = meta.icon
  const hasDownService = status
    ? !status.ok || status.services.some((service) => !service.up)
    : false
  const state = !status ? "unknown" : hasDownService ? "down" : "up"
  const cpuSamples = live.map((sample) => sample.cpu_pct)

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon className="size-4 text-muted-foreground" />
          {meta.title}
        </CardTitle>
        <CardDescription>
          {status ? (
            <>
              {meta.subtitle} · {status.host} · updated {formatRelativeTime(status.updated_at)}
            </>
          ) : (
            <>{meta.subtitle} · waiting for first sample</>
          )}
        </CardDescription>
        <CardAction>
          <div className="flex items-center gap-2">
            <Badge
              variant={state === "up" ? "secondary" : state === "down" ? "destructive" : "outline"}
              className={cn(
                state === "up" && "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
                state === "up" && "hover:bg-emerald-500/20"
              )}
            >
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  state === "up" && "bg-emerald-500",
                  state === "down" && "bg-red-500",
                  state === "unknown" && "bg-muted-foreground"
                )}
              />
              {state === "up" ? "Online" : state === "down" ? "Down" : "Unknown"}
            </Badge>
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={() => void refreshStatus()}
              aria-label={`Refresh ${meta.title}`}
              title="Refresh status"
            >
              <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
            </Button>
          </div>
        </CardAction>
      </CardHeader>

      <CardContent>
        {error && (
          <div className="mb-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error}
          </div>
        )}

        {!status ? (
          <div className="space-y-3">
            <div className="flex justify-center gap-4">
              {[0, 1, 2].map((index) => (
                <Skeleton key={index} className="size-20 rounded-full" />
              ))}
            </div>
            <Skeleton className="h-20 w-full rounded-md" />
          </div>
        ) : (
          <Tabs defaultValue="live">
            <TabsList className="w-full justify-start">
              <TabsTrigger value="live">
                <Activity className="size-3.5" />
                Live
              </TabsTrigger>
              <TabsTrigger value="history">1h history</TabsTrigger>
              <TabsTrigger value="processes">Processes</TabsTrigger>
            </TabsList>

            <TabsContent value="live" className="mt-4 space-y-5">
              <div className="flex flex-wrap items-start justify-around gap-3">
                <RadialGauge
                  value={status.cpu_pct}
                  label="CPU"
                  strokeClassName="stroke-sky-500"
                  sublabel={`${status.cpu_cores.length} cores`}
                />
                <RadialGauge
                  value={status.mem.used_pct}
                  label="RAM"
                  strokeClassName="stroke-violet-500"
                  sublabel={`${formatBytes(status.mem.used_bytes)} / ${formatBytes(status.mem.total_bytes)}`}
                />
                <RadialGauge
                  value={status.disk.used_pct}
                  label="Disk"
                  strokeClassName="stroke-amber-500"
                  sublabel={`${formatBytes(status.disk.used_bytes)} / ${formatBytes(status.disk.total_bytes)}`}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="inline-flex items-center gap-1.5 font-medium text-muted-foreground">
                    <Cpu className="size-3.5" /> CPU cores
                  </span>
                  <span className="tabular-nums text-muted-foreground">{formatPercent(status.cpu_pct)} global</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {status.cpu_cores.map((core, index) => (
                    <div
                      key={index}
                      className="flex h-10 w-3 items-end overflow-hidden rounded-sm bg-muted"
                      title={`Core ${index}: ${formatPercent(core)}`}
                    >
                      <div
                        className="w-full bg-sky-500/80 transition-[height] duration-500"
                        style={{ height: `${Math.max(2, Math.min(100, core))}%` }}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-muted-foreground">CPU · last 60s</span>
                  <span className="tabular-nums text-muted-foreground">{live.length} samples</span>
                </div>
                <div className="h-16 rounded-md bg-muted/40 p-2">
                  <Sparkline values={cpuSamples} className="h-full text-sky-500" fillClassName="fill-sky-500/10" />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="history" className="mt-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{history.length} samples</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void refreshHistory()}
                  disabled={historyLoading}
                >
                  <RefreshCw className={cn("size-3.5", historyLoading && "animate-spin")} />
                  Refresh
                </Button>
              </div>
              <HistoryChart history={history} />
            </TabsContent>

            <TabsContent value="processes" className="mt-4">
              {status.top_processes.length === 0 ? (
                <p className="py-6 text-center text-xs text-muted-foreground">No process data yet.</p>
              ) : (
                <div className="divide-y rounded-md border">
                  {status.top_processes.map((process) => (
                    <div key={process.pid} className="flex items-center gap-3 px-3 py-2 text-xs">
                      <span className="w-10 shrink-0 tabular-nums text-muted-foreground">#{process.pid}</span>
                      <span className="min-w-0 flex-1 truncate font-medium">{process.name}</span>
                      <span className="tabular-nums text-muted-foreground">{formatPercent(process.cpu_pct)}</span>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </CardContent>

      <CardFooter className="flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {status?.services.length ? (
            status.services.map((service) => (
              <Badge key={service.name} variant="outline" className="gap-1.5">
                <span className={cn("size-1.5 rounded-full", service.up ? "bg-emerald-500" : "bg-red-500")} />
                {service.name === "set" ? "Map" : service.name}
                <span className="text-muted-foreground">{service.up ? "up" : "down"}</span>
              </Badge>
            ))
          ) : (
            <span className="text-xs text-muted-foreground">No service checks configured</span>
          )}
        </div>
        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
          <Server className="size-3" />
          {status?.agent ?? "—"}
        </span>
      </CardFooter>
    </Card>
  )
}
