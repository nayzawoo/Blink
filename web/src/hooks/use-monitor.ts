import { useCallback, useEffect, useState } from "react"

import { fetchHistory, fetchStatus, settingsConfigured, type Settings } from "@/lib/api"
import type { HistoryPoint, LiveSample, ServerKey, StatusSnapshot } from "@/lib/types"

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unexpected error"
}

function toSample(status: StatusSnapshot): LiveSample {
  return {
    ts: Date.now(),
    cpu_pct: status.cpu_pct,
    mem_used_pct: status.mem.used_pct,
    disk_used_pct: status.disk.used_pct,
  }
}

export function useMonitor(server: ServerKey, settings: Settings) {
  const [status, setStatus] = useState<StatusSnapshot | null>(null)
  const [history, setHistory] = useState<HistoryPoint[]>([])
  const [live, setLive] = useState<LiveSample[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [historyLoading, setHistoryLoading] = useState(false)

  const configured = settingsConfigured(settings)

  const refreshStatus = useCallback(async () => {
    if (!configured) return
    try {
      const next = await fetchStatus(server, settings)
      const sample = toSample(next)
      setStatus(next)
      setLive((previous) => {
        const cutoff = sample.ts - 60_000
        return [...previous.filter((item) => item.ts >= cutoff), sample].slice(-60)
      })
      setError(null)
    } catch (cause) {
      setError(errorMessage(cause))
    } finally {
      setLoading(false)
    }
  }, [configured, server, settings])

  const refreshHistory = useCallback(async () => {
    if (!configured) return
    setHistoryLoading(true)
    try {
      const next = await fetchHistory(server, settings)
      setHistory(next)
      setError(null)
    } catch (cause) {
      setError(errorMessage(cause))
    } finally {
      setHistoryLoading(false)
    }
  }, [configured, server, settings])

  useEffect(() => {
    if (!configured) {
      queueMicrotask(() => {
        setStatus(null)
        setHistory([])
        setLive([])
        setError(null)
        setLoading(true)
      })
      return
    }

    queueMicrotask(() => void refreshStatus())
    const interval = window.setInterval(() => void refreshStatus(), Math.max(500, settings.refreshMs))
    return () => window.clearInterval(interval)
  }, [configured, refreshStatus, settings.refreshMs])

  useEffect(() => {
    if (!configured) return

    queueMicrotask(() => void refreshHistory())
    const interval = window.setInterval(() => void refreshHistory(), 60_000)
    return () => window.clearInterval(interval)
  }, [configured, refreshHistory])

  return {
    status,
    history,
    live,
    error,
    loading,
    historyLoading,
    refreshStatus,
    refreshHistory,
  }
}
