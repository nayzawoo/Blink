/**
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
  iterations: 310000,
  keyLength: 32,
  label: "blink:secrets:v1",
  salt: "Pw1hAMO21JoGwuiDGGbwXA==",
  iv: "/c2xRd0YYTp/DyOS",
  ciphertext: "yryFaA6VAVsOfdetX+p/D8jL8EnHT44FSty85H1qc6PRerVsrOq4MaEPoazL/SnZHs9VNQS2PpdPpv4rqgipbE4/D4zL4jfFCq/dR6lUoiCGcArMra3yywWz10vrxq8oesIBe73K7x5vQ9Q/V7aO6fff5DQ6TMo7MM6UE/zCt7LnCE4=",
} as const

