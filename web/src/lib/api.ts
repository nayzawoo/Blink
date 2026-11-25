import type { RatesResponse, ServerKey, StickCommandResult, StatusSnapshot, HistoryPoint } from "./types"

export interface Settings {
  blinkApiKey: string
  chatBaseUrl: string
  setBaseUrl: string
  stickIrBaseUrl: string
  stickIrToken: string
  refreshMs: number
}

export const DEFAULT_SETTINGS: Settings = {
  blinkApiKey: "",
  chatBaseUrl: "/chat-api",
  setBaseUrl: "/set-api",
  stickIrBaseUrl: "/stick-api",
  stickIrToken: "",
  refreshMs: 1500,
}

const SETTINGS_KEY = "blink.settings.v1"
const RATES_URL =
  "https://myanexchanger-rates-default-rtdb.asia-southeast1.firebasedatabase.app/.json"

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return { ...DEFAULT_SETTINGS }
    const parsed = JSON.parse(raw) as Partial<Settings>
    return { ...DEFAULT_SETTINGS, ...parsed }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function saveSettings(settings: Settings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
}

export function settingsConfigured(settings: Settings): boolean {
  return settings.blinkApiKey.trim().length > 0
}

function normalizeBase(base: string): string {
  return base.trim().replace(/\/+$/, "")
}

function baseUrlFor(server: ServerKey, settings: Settings): string {
  return normalizeBase(server === "chat" ? settings.chatBaseUrl : settings.setBaseUrl)
}

function authHeaders(token: string): Record<string, string> {
  return token.trim() ? { Authorization: `Bearer ${token.trim()}` } : {}
}

function timeoutSignal(ms: number): AbortSignal | undefined {
  return typeof AbortSignal !== "undefined" && "timeout" in AbortSignal
    ? AbortSignal.timeout(ms)
    : undefined
}

async function getJson<T>(url: string, token: string): Promise<T> {
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      ...authHeaders(token),
    },
    cache: "no-store",
    signal: timeoutSignal(8000),
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}`.trim())
  }

  return (await response.json()) as T
}

export function fetchStatus(server: ServerKey, settings: Settings): Promise<StatusSnapshot> {
  return getJson<StatusSnapshot>(`${baseUrlFor(server, settings)}/status`, settings.blinkApiKey)
}

export function fetchHistory(server: ServerKey, settings: Settings): Promise<HistoryPoint[]> {
  return getJson<HistoryPoint[]>(`${baseUrlFor(server, settings)}/history?range=1h`, settings.blinkApiKey)
}

export async function sendStickCommand(
  cmd: string,
  settings: Settings
): Promise<StickCommandResult> {
  const token = settings.stickIrToken.trim()
  if (!token) throw new Error("Stick IR token is not configured")

  const response = await fetch(`${normalizeBase(settings.stickIrBaseUrl)}/commands`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ cmd }),
    signal: timeoutSignal(8000),
  })

  if (response.status === 401) throw new Error("Stick IR token was rejected (401)")
  if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`.trim())

  return (await response.json()) as StickCommandResult
}

export function fetchRates(): Promise<RatesResponse> {
  return getJson<RatesResponse>(RATES_URL, "")
}

export async function fetchPushPublicKey(settings: Settings): Promise<string> {
  const data = await getJson<{ public_key: string }>(
    `${normalizeBase(settings.chatBaseUrl)}/push/public-key`,
    settings.blinkApiKey
  )
  return data.public_key
}

export async function subscribePush(
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  settings: Settings
): Promise<void> {
  const response = await fetch(`${normalizeBase(settings.chatBaseUrl)}/push/subscribe`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(settings.blinkApiKey),
    },
    body: JSON.stringify(subscription),
    signal: timeoutSignal(8000),
  })
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}`.trim())
  }
}

export async function unsubscribePush(endpoint: string, settings: Settings): Promise<void> {
  const response = await fetch(`${normalizeBase(settings.chatBaseUrl)}/push/unsubscribe`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(settings.blinkApiKey),
    },
    body: JSON.stringify({ endpoint }),
    signal: timeoutSignal(8000),
  })
  if (!response.ok && response.status !== 404) {
    throw new Error(`HTTP ${response.status} ${response.statusText}`.trim())
  }
}

export async function sendTestPush(settings: Settings): Promise<{ delivered: number }> {
  const response = await fetch(`${normalizeBase(settings.chatBaseUrl)}/push/test`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      ...authHeaders(settings.blinkApiKey),
    },
    signal: timeoutSignal(10_000),
  })
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}`.trim())
  }
  return (await response.json()) as { delivered: number }
}

export const STICK_COMMANDS = [
  { cmd: "power", label: "Power", tone: "danger" },
  { cmd: "source", label: "Source", tone: "default" },
  { cmd: "mute", label: "Mute", tone: "default" },
  { cmd: "prev", label: "Prev", tone: "default" },
  { cmd: "vol_up", label: "Vol +", tone: "default" },
  { cmd: "vol_down", label: "Vol −", tone: "default" },
  { cmd: "ch_up", label: "CH +", tone: "default" },
  { cmd: "ch_down", label: "CH −", tone: "default" },
  ...Array.from({ length: 10 }, (_, index) => ({
    cmd: String(index),
    label: String(index),
    tone: "digit" as const,
  })),
] as const
