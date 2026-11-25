import { ENCRYPTED_SECRETS } from "./encrypted-secrets"

export interface EmbeddedSecrets {
  blinkApiKey: string
  stickIrToken: string
}

const encoder = new TextEncoder()
const decoder = new TextDecoder()

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

export async function decryptEmbeddedSecrets(password: string): Promise<EmbeddedSecrets | null> {
  if (!ENCRYPTED_SECRETS.ciphertext || !globalThis.crypto?.subtle) {
    return null
  }

  const baseKey = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveKey"])
  const salt = concatBytes(fromBase64(ENCRYPTED_SECRETS.salt), encoder.encode(ENCRYPTED_SECRETS.label))
  const aesKey = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: toArrayBuffer(salt),
      iterations: ENCRYPTED_SECRETS.iterations,
      hash: "SHA-256",
    },
    baseKey,
    { name: "AES-GCM", length: ENCRYPTED_SECRETS.keyLength * 8 },
    false,
    ["decrypt"]
  )

  const decrypted = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: toArrayBuffer(fromBase64(ENCRYPTED_SECRETS.iv)),
    },
    aesKey,
    toArrayBuffer(fromBase64(ENCRYPTED_SECRETS.ciphertext))
  )

  const parsed = JSON.parse(decoder.decode(decrypted)) as Partial<EmbeddedSecrets>
  return {
    blinkApiKey: typeof parsed.blinkApiKey === "string" ? parsed.blinkApiKey.trim() : "",
    stickIrToken: typeof parsed.stickIrToken === "string" ? parsed.stickIrToken.trim() : "",
  }
}
