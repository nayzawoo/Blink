#!/usr/bin/env node
import { createCipheriv, pbkdf2Sync, randomBytes } from "node:crypto"

const password = process.env.BLINK_PASSWORD
const blinkApiKey = (process.env.BLINK_API_KEY || "").trim()
const stickIrToken = (process.env.STICK_IR_TOKEN || "").trim()

if (!password || (!blinkApiKey && !stickIrToken)) {
  console.error("Set BLINK_PASSWORD and at least one of BLINK_API_KEY / STICK_IR_TOKEN.")
  console.error("Example: BLINK_PASSWORD=... BLINK_API_KEY=... STICK_IR_TOKEN=... make secrets-encrypt")
  process.exit(1)
}

const salt = randomBytes(16)
const iv = randomBytes(12)
const iterations = 310_000
const keyLength = 32
const label = "blink:secrets:v1"

const key = pbkdf2Sync(password, Buffer.concat([salt, Buffer.from(label)]), iterations, keyLength, "sha256")
const plaintext = Buffer.from(JSON.stringify({ blinkApiKey, stickIrToken }), "utf8")

const cipher = createCipheriv("aes-256-gcm", key, iv)
const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()])
const authTag = cipher.getAuthTag()
const ciphertext = Buffer.concat([encrypted, authTag])

console.log(`/**
 * Encrypted default API secrets (PBKDF2-SHA256 + AES-256-GCM).
 *
 * Regenerate with:
 *   BLINK_PASSWORD=... BLINK_API_KEY=... STICK_IR_TOKEN=... make secrets-encrypt
 *
 * Contains only ciphertext, salt, and IV — decrypted in the browser upon login
 * using the dashboard password. Never commit plaintext tokens here.
 */
export const ENCRYPTED_SECRETS = {
  version: 1,
  kdf: "PBKDF2-SHA256",
  cipher: "AES-256-GCM",
  iterations: ${iterations},
  keyLength: ${keyLength},
  label: "${label}",
  salt: "${salt.toString("base64")}",
  iv: "${iv.toString("base64")}",
  ciphertext: "${ciphertext.toString("base64")}",
} as const
`)
