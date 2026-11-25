import { useCallback, useEffect, useRef, useState } from "react"

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

export function useMonitor(server: ServerKey, settings: Settings, online = true) {
  const [status, setStatus] = useState<StatusSnapshot | null>(null)
  const [history, setHistory] = useState<HistoryPoint[]>([])
  const [live, setLive] = useState<LiveSample[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [historyLoading, setHistoryLoading] = useState(false)
  const statusInFlight = useRef(false)
  const historyInFlight = useRef(false)

  const configured = settingsConfigured(settings)

  const refreshStatus = useCallback(async () => {
    if (!configured || !online || statusInFlight.current) return
    statusInFlight.current = true
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
      statusInFlight.current = false
      setLoading(false)
    }
  }, [configured, online, server, settings])

  const refreshHistory = useCallback(async () => {
    if (!configured || !online || historyInFlight.current) return
    historyInFlight.current = true
    setHistoryLoading(true)
    try {
      const next = await fetchHistory(server, settings)
      setHistory(next)
      setError(null)
    } catch (cause) {
      setError(errorMessage(cause))
    } finally {
      historyInFlight.current = false
      setHistoryLoading(false)
    }
  }, [configured, online, server, settings])

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

    if (!online) return

    const pollIfVisible = () => {
      if (document.visibilityState === "visible") {
        void refreshStatus()
      }
    }

    queueMicrotask(pollIfVisible)
    const interval = window.setInterval(pollIfVisible, Math.max(500, settings.refreshMs))
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        void refreshStatus()
      }
    }
    document.addEventListener("visibilitychange", handleVisibility)
    return () => {
      window.clearInterval(interval)
      document.removeEventListener("visibilitychange", handleVisibility)
    }
  }, [configured, online, refreshStatus, settings.refreshMs])

  useEffect(() => {
    if (!configured || !online) return

    const pollIfVisible = () => {
      if (document.visibilityState === "visible") {
        void refreshHistory()
      }
    }

    queueMicrotask(pollIfVisible)
    const interval = window.setInterval(pollIfVisible, 60_000)
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        void refreshHistory()
      }
    }
    document.addEventListener("visibilitychange", handleVisibility)
    return () => {
      window.clearInterval(interval)
      document.removeEventListener("visibilitychange", handleVisibility)
    }
  }, [configured, online, refreshHistory])

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
