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
    // Wallet rejected, simulation failed before sending, RPC error, etc.
    return {
      ok: false,
      error: humanError(err),
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

function humanError(err: unknown): string {
  if (err instanceof Error) {
    const msg = err.message;
    if (/User rejected|user denied|reject/i.test(msg)) {
      return "Wallet rejected the signature request.";
    }
    if (/insufficient/i.test(msg)) {
      return "Insufficient balance to pay fees.";
    }
    if (/simulate|preflight/i.test(msg)) {
      return `Transaction would fail on-chain: ${msg}`;
    }
    return msg;
  }
  return String(err);
}
