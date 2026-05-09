import type { Connection, VersionedTransaction } from "@solana/web3.js";
import type { SimulationDelta } from "./types";

/**
 * Wrap connection.simulateTransaction with safe defaults. We never need
 * sigVerify=true (we are analyzing, not sending) and we always replace the
 * recent blockhash so transactions with stale blockhashes still simulate.
 *
 * Returns a SimulationDelta that summarizes ok/error. Token balance deltas
 * are left as a future enrichment — would require pre-fetching the signer's
 * token accounts and re-simulating with `accounts.addresses`. The spoof rule
 * does a static intent check; this wrapper exists so the developer "Raw data"
 * toggle has something to show.
 */
export async function simulateSafely(
  vtx: VersionedTransaction,
  connection: Connection,
  timeoutMs = 5_000,
): Promise<SimulationDelta> {
  const empty: SimulationDelta = {
    tokenDeltas: {},
    solDelta: 0n,
    ok: false,
  };

  try {
    const result = await Promise.race([
      connection.simulateTransaction(vtx, {
        sigVerify: false,
        replaceRecentBlockhash: true,
        commitment: "processed",
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Simulation timeout")), timeoutMs),
      ),
    ]);

    if (result.value.err) {
      return {
        tokenDeltas: {},
        solDelta: 0n,
        ok: false,
        error:
          typeof result.value.err === "string"
            ? result.value.err
            : JSON.stringify(result.value.err),
      };
    }

    return {
      tokenDeltas: {},
      solDelta: 0n,
      ok: true,
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Simulation failed for unknown reason";
    return { ...empty, error: message };
  }
}
