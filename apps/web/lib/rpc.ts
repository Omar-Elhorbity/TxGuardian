import { Connection } from "@solana/web3.js";

/**
 * Server-side Solana connection. Cached at the module level so each Vercel
 * function invocation reuses one HTTP keep-alive client during its warm window.
 *
 * SECURITY: never read RPC_URL on the client. This module is server-only — do
 * not import it from a client component.
 */
let cached: Connection | null = null;

export function getConnection(): Connection {
  if (cached) return cached;
  const url = process.env.RPC_URL ?? "https://api.devnet.solana.com";
  cached = new Connection(url, "processed");
  return cached;
}
