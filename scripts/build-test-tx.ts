#!/usr/bin/env tsx
/**
 * Build real-shaped Solana transactions for manual /scan testing.
 *
 * Usage:
 *   pnpm exec tsx scripts/build-test-tx.ts <type> [--payer <base58>]
 *
 * Types:
 *   onchain-drainer  — calls one of the addresses seeded in the on-chain
 *                      registry. Triggers the full on-chain match flow.
 *   approve          — real SPL Token unlimited Approve. Triggers FULL_TOKEN_APPROVAL.
 *   complex          — 6-instruction bundle. Triggers MULTI_INSTRUCTION_COMPLEXITY.
 *   transfer         — vanilla SOL transfer. Should be Safe.
 *
 * Without --payer: uses a deterministic mock payer. Tx is ANALYSIS-ONLY —
 *                  no real wallet can sign it.
 * With    --payer: uses the given pubkey as fee payer. The matching wallet
 *                  CAN sign it. The blockhash is still a placeholder, so
 *                  before sending you'd need to refresh it (the /scan flow
 *                  with the sample buttons handles this server-side).
 *
 * Output: base64 transaction string. Pipe to clipboard or paste into /scan:
 *
 *   pnpm exec tsx scripts/build-test-tx.ts onchain-drainer
 *   pnpm exec tsx scripts/build-test-tx.ts onchain-drainer --payer 9xQe...
 */

import {
  ComputeBudgetProgram,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import { createApproveInstruction } from "@solana/spl-token";

const PLACEHOLDER_BLOCKHASH = "11111111111111111111111111111111";

function deterministicKeypair(seedByte: number): Keypair {
  return Keypair.fromSeed(new Uint8Array(32).fill(seedByte));
}

function serialize(tx: Transaction): string {
  return tx
    .serialize({ requireAllSignatures: false, verifySignatures: false })
    .toString("base64");
}

/** Resolve --payer arg to a PublicKey if provided, otherwise return the mock. */
function resolvePayer(mockSeed: number): PublicKey {
  const idx = process.argv.indexOf("--payer");
  if (idx === -1 || !process.argv[idx + 1]) {
    return deterministicKeypair(mockSeed).publicKey;
  }
  try {
    return new PublicKey(process.argv[idx + 1]!);
  } catch {
    console.error(`--payer value is not a valid base58 pubkey: ${process.argv[idx + 1]}`);
    process.exit(1);
  }
}

function buildOnchainDrainer(): string {
  // Seed=9 was attested confirmed in seed-registry.ts at severity=3.
  // The /scan analyzer will fetch the on-chain registry, see this match,
  // and fire the KNOWN_DRAINER_PROGRAM flag with evidence.source="onchain".
  const payer = resolvePayer(1);
  const drainer = deterministicKeypair(9).publicKey;

  const tx = new Transaction({
    feePayer: payer,
    recentBlockhash: PLACEHOLDER_BLOCKHASH,
  });
  tx.add(
    ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }),
    new TransactionInstruction({
      programId: drainer,
      keys: [{ pubkey: payer, isSigner: true, isWritable: true }],
      data: Buffer.from([1, 2, 3, 4]),
    }),
  );
  return serialize(tx);
}

function buildApprove(): string {
  // Real SPL Token Approve with u64::MAX → FULL_TOKEN_APPROVAL high.
  const payer = resolvePayer(2);
  const tokenAccount = deterministicKeypair(3).publicKey;
  const delegate = deterministicKeypair(4).publicKey;

  const tx = new Transaction({
    feePayer: payer,
    recentBlockhash: PLACEHOLDER_BLOCKHASH,
  });
  tx.add(
    createApproveInstruction(
      tokenAccount,
      delegate,
      payer,
      BigInt("18446744073709551615"), // u64::MAX
    ),
  );
  return serialize(tx);
}

function buildComplex(): string {
  // 6 calls to an unknown program → triggers UNKNOWN_PROGRAM + MULTI_INSTRUCTION_COMPLEXITY.
  const payer = resolvePayer(5);
  const dest = deterministicKeypair(6).publicKey;
  const unknown = deterministicKeypair(7).publicKey;

  const tx = new Transaction({
    feePayer: payer,
    recentBlockhash: PLACEHOLDER_BLOCKHASH,
  });
  tx.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }));
  for (let i = 0; i < 6; i++) {
    tx.add(
      new TransactionInstruction({
        programId: unknown,
        keys: [
          { pubkey: payer, isSigner: true, isWritable: true },
          { pubkey: dest, isSigner: false, isWritable: true },
        ],
        data: Buffer.from([i, 0, 0, 0]),
      }),
    );
  }
  return serialize(tx);
}

function buildTransfer(): string {
  // Routine SOL transfer. Should produce a Safe verdict.
  const payer = resolvePayer(8);
  const dest = deterministicKeypair(9).publicKey;
  const tx = new Transaction({
    feePayer: payer,
    recentBlockhash: PLACEHOLDER_BLOCKHASH,
  });
  tx.add(
    ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }),
    SystemProgram.transfer({
      fromPubkey: payer,
      toPubkey: dest,
      lamports: 100_000,
    }),
  );
  return serialize(tx);
}

const builders: Record<string, () => string> = {
  "onchain-drainer": buildOnchainDrainer,
  approve: buildApprove,
  complex: buildComplex,
  transfer: buildTransfer,
};

const type = process.argv[2];
if (!type || !(type in builders)) {
  console.error("Usage: tsx scripts/build-test-tx.ts <type>");
  console.error("Types: " + Object.keys(builders).join(", "));
  process.exit(1);
}

console.log(builders[type]!());
