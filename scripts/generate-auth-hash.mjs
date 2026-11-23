#!/usr/bin/env node
import { pbkdf2Sync, randomBytes } from "node:crypto"

const username = process.env.BLINK_USERNAME
const password = process.env.BLINK_PASSWORD

if (!username || !password) {
  console.error("Set BLINK_USERNAME and BLINK_PASSWORD in the environment first.")
  console.error("Example: BLINK_USERNAME=... BLINK_PASSWORD=... make auth-hash")
  process.exit(1)
}

const salt = randomBytes(16)
const iterations = 310_000
const keyLength = 32
const derive = (value, label) =>
  pbkdf2Sync(value, Buffer.concat([salt, Buffer.from(label)]), iterations, keyLength, "sha256").toString("base64")

console.log(`export const AUTH_CREDENTIALS = {
  version: 1,
  algorithm: "PBKDF2-SHA256",
  iterations: ${iterations},
  keyLength: ${keyLength},
  salt: "${salt.toString("base64")}",
  usernameHash: "${derive(username, "blink:username:v1")}",
  passwordHash: "${derive(password, "blink:password:v1")}",
  usernameLabel: "blink:username:v1",
  passwordLabel: "blink:password:v1",
} as const
`)
