#!/usr/bin/env tsx
/**
 * Build real-shaped Solana transactions for manual /scan testing.
 *
 * Usage:
 *   pnpm exec tsx scripts/build-test-tx.ts <type>
 *
 * Types:
 *   onchain-drainer  — calls one of the addresses seeded in the on-chain
 *                      registry. Triggers the full on-chain match flow.
 *   approve          — real SPL Token unlimited Approve. Triggers FULL_TOKEN_APPROVAL.
 *   complex          — 6-instruction bundle. Triggers MULTI_INSTRUCTION_COMPLEXITY.
 *   transfer         — vanilla SOL transfer. Should be Safe.
 *
 * Output: base64 transaction string. Pipe to clipboard or paste into /scan:
 *
 *   pnpm exec tsx scripts/build-test-tx.ts onchain-drainer | tee >(xclip -sel clip)
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

function buildOnchainDrainer(): string {
  // Seed=9 was attested confirmed in seed-registry.ts at severity=3.
  // The /scan analyzer will fetch the on-chain registry, see this match,
  // and fire the KNOWN_DRAINER_PROGRAM flag with evidence.source="onchain".
  const payer = deterministicKeypair(1);
  const drainer = deterministicKeypair(9).publicKey;

  const tx = new Transaction({
    feePayer: payer.publicKey,
    recentBlockhash: PLACEHOLDER_BLOCKHASH,
  });
  tx.add(
    ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }),
    new TransactionInstruction({
      programId: drainer,
      keys: [
        { pubkey: payer.publicKey, isSigner: true, isWritable: true },
      ],
      data: Buffer.from([1, 2, 3, 4]),
    }),
  );
  return serialize(tx);
}

function buildApprove(): string {
  // Real SPL Token Approve with u64::MAX → FULL_TOKEN_APPROVAL high.
  const payer = deterministicKeypair(2);
  const tokenAccount = deterministicKeypair(3).publicKey;
  const delegate = deterministicKeypair(4).publicKey;

  const tx = new Transaction({
    feePayer: payer.publicKey,
    recentBlockhash: PLACEHOLDER_BLOCKHASH,
  });
  tx.add(
    createApproveInstruction(
      tokenAccount,
      delegate,
      payer.publicKey,
      BigInt("18446744073709551615"), // u64::MAX
    ),
  );
  return serialize(tx);
}

function buildComplex(): string {
  // 6 calls to an unknown program → triggers UNKNOWN_PROGRAM + MULTI_INSTRUCTION_COMPLEXITY.
  const payer = deterministicKeypair(5);
  const dest = deterministicKeypair(6);
  const unknown = deterministicKeypair(7).publicKey;

  const tx = new Transaction({
    feePayer: payer.publicKey,
    recentBlockhash: PLACEHOLDER_BLOCKHASH,
  });
  tx.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }));
  for (let i = 0; i < 6; i++) {
    tx.add(
      new TransactionInstruction({
        programId: unknown,
        keys: [
          { pubkey: payer.publicKey, isSigner: true, isWritable: true },
          { pubkey: dest.publicKey, isSigner: false, isWritable: true },
        ],
        data: Buffer.from([i, 0, 0, 0]),
      }),
    );
  }
  return serialize(tx);
}

function buildTransfer(): string {
  // Routine SOL transfer. Should produce a Safe verdict.
  const payer = deterministicKeypair(8);
  const dest = deterministicKeypair(9);
  const tx = new Transaction({
    feePayer: payer.publicKey,
    recentBlockhash: PLACEHOLDER_BLOCKHASH,
  });
  tx.add(
    ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }),
    SystemProgram.transfer({
      fromPubkey: payer.publicKey,
      toPubkey: dest.publicKey,
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
