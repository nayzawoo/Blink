export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B"
  const units = ["B", "KB", "MB", "GB", "TB"]
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / 1024 ** index
  return `${value >= 10 || index === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[index]}`
}

export function formatPercent(value: number): string {
  return `${clamp(value, 0, 100).toFixed(value >= 10 ? 0 : 1)}%`
}

export function formatRelativeTime(iso: string | number | null | undefined): string {
  if (iso === null || iso === undefined) return "never"
  const timestamp = typeof iso === "number" ? iso : Date.parse(iso)
  if (!Number.isFinite(timestamp)) return "unknown"

  const seconds = Math.round((Date.now() - timestamp) / 1000)
  if (Math.abs(seconds) < 5) return "just now"
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export function formatClock(iso: string | number): string {
  const date = typeof iso === "number" ? new Date(iso) : new Date(iso)
  if (Number.isNaN(date.getTime())) return "--:--:--"
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
}

export function downsample<T>(items: T[], limit: number): T[] {
  if (items.length <= limit) return items
  const step = items.length / limit
  return Array.from({ length: limit }, (_, index) => items[Math.floor(index * step)])
}
