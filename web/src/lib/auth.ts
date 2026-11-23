import { AUTH_CREDENTIALS } from "./auth-credentials"

const SESSION_KEY = "blink.auth.session.v1"
const encoder = new TextEncoder()

function fromBase64(value: string): Uint8Array {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}

function concatBytes(a: Uint8Array, b: Uint8Array): Uint8Array {
  const result = new Uint8Array(a.length + b.length)
  result.set(a, 0)
  result.set(b, a.length)
  return result
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(buffer).set(bytes)
  return buffer
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let difference = 0
  for (let index = 0; index < a.length; index += 1) {
    difference |= a[index] ^ b[index]
  }
  return difference === 0
}

async function derive(value: string, label: string): Promise<Uint8Array> {
  if (!globalThis.crypto?.subtle) {
    throw new Error("Web Crypto is unavailable. Use HTTPS or localhost.")
  }

  const key = await crypto.subtle.importKey("raw", encoder.encode(value), "PBKDF2", false, ["deriveBits"])
  const salt = concatBytes(fromBase64(AUTH_CREDENTIALS.salt), encoder.encode(label))
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: toArrayBuffer(salt),
      iterations: AUTH_CREDENTIALS.iterations,
      hash: "SHA-256",
    },
    key,
    AUTH_CREDENTIALS.keyLength * 8
  )

  return new Uint8Array(bits)
}

export async function verifyCredentials(username: string, password: string): Promise<boolean> {
  const [usernameHash, passwordHash] = await Promise.all([
    derive(username.trim(), AUTH_CREDENTIALS.usernameLabel),
    derive(password, AUTH_CREDENTIALS.passwordLabel),
  ])

  const usernameMatches = constantTimeEqual(usernameHash, fromBase64(AUTH_CREDENTIALS.usernameHash))
  const passwordMatches = constantTimeEqual(passwordHash, fromBase64(AUTH_CREDENTIALS.passwordHash))

  return usernameMatches && passwordMatches
}

export function isAuthenticated(): boolean {
  try {
    return sessionStorage.getItem(SESSION_KEY) === String(AUTH_CREDENTIALS.version)
  } catch {
    return false
  }
}

export function markAuthenticated(): void {
  sessionStorage.setItem(SESSION_KEY, String(AUTH_CREDENTIALS.version))
}

export function clearAuthentication(): void {
  sessionStorage.removeItem(SESSION_KEY)
}
