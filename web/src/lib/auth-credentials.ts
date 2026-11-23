/**
 * Static login verifier.
 *
 * This file intentionally contains only PBKDF2-SHA256 output, never the
 * plaintext username or password. The browser derives hashes from the login
 * form with the same salt, iterations and domain labels, then compares them
 * in constant time.
 *
 * This is a client-side gate for convenience/privacy from casual browsing;
 * it is not a substitute for server-side authentication.
 */
export const AUTH_CREDENTIALS = {
  version: 1,
  algorithm: "PBKDF2-SHA256",
  iterations: 310_000,
  keyLength: 32,
  salt: "QodJnlTADhiTtwQoPlPHrw==",
  usernameHash: "P3rklKLWBHaVIf7RY/XfPZaZSyfNVdarBjED8/1Shxc=",
  passwordHash: "ACAtRKtCaBroRqxb3/tZ68HOZ76b9JkAKjQhjlBh7y0=",
  usernameLabel: "blink:username:v1",
  passwordLabel: "blink:password:v1",
} as const
