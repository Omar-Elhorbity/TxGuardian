import {
  type Connection,
  PublicKey,
  VersionedTransaction,
} from "@solana/web3.js";
import type { WalletContextState } from "@solana/wallet-adapter-react";

/**
 * Result of attempting to sign and submit a base64 transaction with the
 * connected wallet. Either a confirmed signature, or a structured failure.
 */
export type SendOutcome =
  | { ok: true; signature: string }
  | { ok: false; error: string };

/**
 * Inspect a base64-serialized VersionedTransaction and return a reason if it
 * cannot reasonably be signed by `wallet`. Used to disable the Sign button
 * with an explanatory tooltip rather than failing at signing time.
 */
export function checkSignability(
  base64: string,
  walletPubkey: PublicKey | null,
): string | null {
  if (!walletPubkey) return "Connect a wallet first.";
  let tx: VersionedTransaction;
  try {
    tx = VersionedTransaction.deserialize(
      Buffer.from(base64.trim(), "base64"),
    );
  } catch {
    return "Could not parse the transaction.";
  }
  const keys = tx.message.staticAccountKeys;
  const numSigners = tx.message.header.numRequiredSignatures;
  if (numSigners === 0 || keys.length === 0) {
    return "Transaction has no signers.";
  }
  const feePayer = keys[0];
  if (!feePayer) return "Transaction has no fee payer.";
  if (!feePayer.equals(walletPubkey)) {
    return "Fee payer is not this wallet — wallet would refuse to sign.";
  }
  return null;
}

/**
 * Sign + send a base64-serialized transaction using the connected wallet.
 * Polls for confirmation up to 30 seconds.
 *
 * Failure handling: Phantom often returns a generic "Unexpected error" when
 * preflight simulation fails on the wallet side. To give the user something
 * actionable, we re-simulate ourselves on failure and surface the actual
 * error from the simulation logs.
 */
export async function signAndSend(
  base64: string,
  wallet: WalletContextState,
  connection: Connection,
): Promise<SendOutcome> {
  if (!wallet.connected || !wallet.publicKey) {
    return { ok: false, error: "Wallet is not connected." };
  }
  if (!wallet.sendTransaction) {
    return {
      ok: false,
      error: "Connected wallet does not support sendTransaction.",
    };
  }

  let vtx: VersionedTransaction;
  try {
    vtx = VersionedTransaction.deserialize(
      Buffer.from(base64.trim(), "base64"),
    );
  } catch (err) {
    return {
      ok: false,
      error: `Could not parse transaction: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  let signature: string;
  try {
    signature = await wallet.sendTransaction(vtx, connection, {
      skipPreflight: false,
    });
  } catch (err) {
    // Phantom and other wallets often return a generic message when preflight
    // fails. Re-simulate to extract the real reason.
    const simReason = await postMortemSimulate(vtx, connection);
    return {
      ok: false,
      error: simReason ?? humanError(err),
    };
  }

  // Best-effort confirmation. We don't block forever — if it doesn't confirm
  // in 30s the user can check Explorer themselves.
  try {
    const latest = await connection.getLatestBlockhash("confirmed");
    await connection.confirmTransaction(
      {
        signature,
        blockhash: latest.blockhash,
        lastValidBlockHeight: latest.lastValidBlockHeight,
      },
      "confirmed",
    );
  } catch {
    // Don't fail the outcome — the tx was submitted, confirmation just timed
    // out or had network issues. Caller still gets the signature for Explorer.
  }

  return { ok: true, signature };
}

/**
 * Run our own simulation after a wallet send fails, to extract the real
 * on-chain reason. Returns a human-readable message, or null if simulation
 * itself succeeded (in which case the failure was probably wallet/network).
 */
async function postMortemSimulate(
  vtx: VersionedTransaction,
  connection: Connection,
): Promise<string | null> {
  let result;
  try {
    result = await connection.simulateTransaction(vtx, {
      sigVerify: false,
      replaceRecentBlockhash: true,
      commitment: "processed",
    });
  } catch {
    return null;
  }
  const value = result.value;
  if (!value.err) return null;

  const errStr =
    typeof value.err === "string" ? value.err : JSON.stringify(value.err);
  const logs = value.logs ?? [];

  // Specific patterns in priority order.
  if (
    /AccountNotFound|account not found|Program (does not exist|not found)|invalid program id/i.test(
      errStr,
    ) ||
    logs.some((l) => /Program does not exist|invalid program/i.test(l))
  ) {
    return (
      "Transaction calls a program that doesn't exist on devnet. " +
      "If this is one of the sample transactions, that's expected — they " +
      "intentionally call mock programs to demonstrate detection. The chain " +
      "rejected what the scanner had already flagged."
    );
  }

  if (/InsufficientFunds|insufficient/i.test(errStr)) {
    return "Insufficient balance to pay fees or rent.";
  }

  if (/BlockhashNotFound|blockhash/i.test(errStr)) {
    return "Recent blockhash expired before sending. Refresh and retry.";
  }

  // Fallback: surface the raw err + the most informative log line if any.
  const firstFailureLog = logs.find((l) =>
    /failed|error|invalid/i.test(l),
  );
  if (firstFailureLog) {
    return `Simulation failed: ${firstFailureLog}`;
  }
  return `Simulation failed: ${errStr}`;
}

function humanError(err: unknown): string {
  if (err instanceof Error) {
    const msg = err.message;
    if (/User rejected|user denied|reject/i.test(msg)) {
      return "Wallet rejected the signature request.";
    }
    if (/insufficient/i.test(msg)) {
      return "Insufficient balance to pay fees.";
    }
    if (/Unexpected error/i.test(msg)) {
      // Phantom's catchall — we tried to extract a better reason via
      // postMortemSimulate; if we got here the simulation also succeeded
      // or didn't reveal anything specific.
      return (
        "Wallet returned 'Unexpected error' without details. " +
        "Most likely cause: the transaction would fail on-chain (e.g. " +
        "calls a program that doesn't exist on devnet). Check the wallet's " +
        "developer console for the underlying simulation log."
      );
    }
    if (/simulate|preflight/i.test(msg)) {
      return `Transaction would fail on-chain: ${msg}`;
    }
    return msg;
  }
  return String(err);
}
