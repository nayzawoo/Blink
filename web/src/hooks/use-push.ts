import { useCallback, useEffect, useState } from "react"

import {
  fetchPushPublicKey,
  sendTestPush,
  settingsConfigured,
  subscribePush,
  unsubscribePush,
  type Settings,
} from "@/lib/api"

function urlBase64ToUint8Array(base64Url: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4)
  const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/")
  const raw = atob(base64)
  const buffer = new ArrayBuffer(raw.length)
  const bytes = new Uint8Array(buffer)
  for (let index = 0; index < raw.length; index += 1) {
    bytes[index] = raw.charCodeAt(index)
  }
  return bytes
}

function isIosBrowserTab(): boolean {
  if (typeof navigator === "undefined" || typeof window === "undefined") return false
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent)
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  return isIos && !standalone
}

export function usePushNotifications(settings: Settings) {
  const supported =
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window

  const [subscribed, setSubscribed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const needsHomeScreenInstall = isIosBrowserTab()
  const configured = settingsConfigured(settings)

  useEffect(() => {
    if (!supported) return
    let active = true
    void navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => {
        if (active) setSubscribed(sub !== null)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [supported])

  const enable = useCallback(async () => {
    if (!supported) {
      setError(
        needsHomeScreenInstall
          ? "On iOS, add Blink to your Home Screen first, then open it from the icon."
          : "Web Push is not supported in this browser."
      )
      return false
    }
    if (!configured) {
      setError("Configure Blink API key first.")
      return false
    }

    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const permission = await Notification.requestPermission()
      if (permission !== "granted") {
        throw new Error("Notification permission was denied.")
      }

      const publicKey = await fetchPushPublicKey(settings)
      const registration = await navigator.serviceWorker.ready
      let subscription = await registration.pushManager.getSubscription()
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        })
      }

      const json = subscription.toJSON()
      const p256dh = json.keys?.p256dh
      const auth = json.keys?.auth
      if (!subscription.endpoint || !p256dh || !auth) {
        throw new Error("Browser returned an incomplete push subscription.")
      }

      await subscribePush({ endpoint: subscription.endpoint, keys: { p256dh, auth } }, settings)
      setSubscribed(true)
      setNotice("Push alerts enabled on this device.")
      return true
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to enable push notifications")
      return false
    } finally {
      setBusy(false)
    }
  }, [configured, needsHomeScreenInstall, settings, supported])

  const disable = useCallback(async () => {
    if (!supported) return
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()
      if (subscription) {
        await unsubscribePush(subscription.endpoint, settings).catch(() => {})
        await subscription.unsubscribe()
      }
      setSubscribed(false)
      setNotice("Push alerts disabled on this device.")
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to disable push notifications")
    } finally {
      setBusy(false)
    }
  }, [settings, supported])

  const sendTest = useCallback(async () => {
    if (!configured) return
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const result = await sendTestPush(settings)
      setNotice(`Test notification sent (${result.delivered} device${result.delivered === 1 ? "" : "s"}).`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to send test notification")
    } finally {
      setBusy(false)
    }
  }, [configured, settings])

  return {
    supported,
    needsHomeScreenInstall,
    subscribed,
    busy,
    error,
    notice,
    enable,
    disable,
    sendTest,
  }
}
