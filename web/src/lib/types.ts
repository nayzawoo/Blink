export type ServerKey = "chat" | "set"

export interface ServiceState {
  name: string
  up: boolean
}

export interface ProcessInfo {
  pid: number
  name: string
  cpu_pct: number
}

export interface UsageStatus {
  used_bytes: number
  total_bytes: number
  used_pct: number
}

export interface StatusSnapshot {
  agent: string
  host: string
  ok: boolean
  cpu_pct: number
  cpu_cores: number[]
  mem: UsageStatus
  disk: UsageStatus
  services: ServiceState[]
  top_processes: ProcessInfo[]
  updated_at: string
}

export interface HistoryPoint {
  ts: string
  cpu_pct: number
  mem_used_pct: number
  disk_used_pct: number
  services: Record<string, boolean>
}

export interface LiveSample {
  ts: number
  cpu_pct: number
  mem_used_pct: number
  disk_used_pct: number
}

export interface StickCommandResult {
  id: string
  cmd: string
  created_at: string
}

export interface RatesResponse {
  payoneer: {
    buy_current: number
    buy_kbz_special?: number | null
    buy_previous?: number | null
  }
  shared?: { last_updated?: string | null } | null
  wise?: { buy_current?: number | null } | null
}
