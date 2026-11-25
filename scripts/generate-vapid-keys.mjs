#!/usr/bin/env node
import { generateKeyPairSync } from "node:crypto"

const { publicKey, privateKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" })
const pubJwk = publicKey.export({ format: "jwk" })
const privJwk = privateKey.export({ format: "jwk" })

// Uncompressed P-256 public key (0x04 || X || Y) in URL-safe base64 without padding
const rawPublic = Buffer.concat([
  Buffer.from([0x04]),
  Buffer.from(pubJwk.x, "base64url"),
  Buffer.from(pubJwk.y, "base64url"),
]).toString("base64url")

// Raw 32-byte P-256 private scalar in URL-safe base64 without padding
const rawPrivate = Buffer.from(privJwk.d, "base64url").toString("base64url")

console.log(`VAPID_PUBLIC_KEY=${rawPublic}`)
console.log(`VAPID_PRIVATE_KEY=${rawPrivate}`)
console.log(`VAPID_SUBJECT=mailto:admin@mm2d.xyz`)
