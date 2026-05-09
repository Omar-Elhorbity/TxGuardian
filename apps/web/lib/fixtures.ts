import {
  ComputeBudgetProgram,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import { createApproveInstruction } from "@solana/spl-token";

/**
 * Demo fixture builders. Every call produces a deterministic base64 tx so
 * the demo replays cleanly. Server-side only — these never run on the client.
 *
 * The fixtures are NOT signed and are NEVER intended to be sent on-chain.
 * They exist solely to exercise the analyzer with realistic shapes.
 */

const PLACEHOLDER_BLOCKHASH = "11111111111111111111111111111111";

function deterministicKeypair(seedByte: number): Keypair {
  return Keypair.fromSeed(new Uint8Array(32).fill(seedByte));
}

function serializeUnsigned(tx: Transaction): string {
  return tx.serialize({
    requireAllSignatures: false,
    verifySignatures: false,
  }).toString("base64");
}

/**
 * SAFE — a routine SOL transfer with a compute budget instruction.
 * All programs are on the well-known allowlist.
 */
export function buildSafeFixture(): string {
  const payer = deterministicKeypair(1);
  const dest = deterministicKeypair(2);

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

  return serializeUnsigned(tx);
}

/**
 * CAUTION — multi-instruction transaction touching an unknown program.
 * Triggers UNKNOWN_PROGRAM and MULTI_INSTRUCTION_COMPLEXITY.
 */
export function buildCautionFixture(): string {
  const payer = deterministicKeypair(3);
  const dest = deterministicKeypair(4);
  const unknownProgram = deterministicKeypair(5).publicKey;

  const tx = new Transaction({
    feePayer: payer.publicKey,
    recentBlockhash: PLACEHOLDER_BLOCKHASH,
  });

  tx.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }));

  // Five interactions with an unverified program — clears the complexity
  // threshold while staying well under the wire-size cap.
  for (let i = 0; i < 5; i++) {
    tx.add(
      new TransactionInstruction({
        programId: unknownProgram,
        keys: [
          { pubkey: payer.publicKey, isSigner: true, isWritable: true },
          { pubkey: dest.publicKey, isSigner: false, isWritable: true },
        ],
        data: Buffer.from([i, 0, 0, 0]),
      }),
    );
  }

  return serializeUnsigned(tx);
}

/**
 * DANGER — the demo hero. SPL Token Approve with u64::MAX to a delegate +
 * an unknown program call + a high priority fee. Triggers FULL_TOKEN_APPROVAL,
 * UNKNOWN_PROGRAM, and UNUSUAL_FEE.
 */
export function buildDangerFixture(): string {
  const payer = deterministicKeypair(6);
  const tokenAccount = deterministicKeypair(7).publicKey;
  const delegate = deterministicKeypair(8).publicKey;
  const unknownProgram = deterministicKeypair(9).publicKey;

  const tx = new Transaction({
    feePayer: payer.publicKey,
    recentBlockhash: PLACEHOLDER_BLOCKHASH,
  });

  tx.add(
    ComputeBudgetProgram.setComputeUnitPrice({
      microLamports: 5_000_000,
    }),
    new TransactionInstruction({
      programId: unknownProgram,
      keys: [
        { pubkey: payer.publicKey, isSigner: true, isWritable: true },
      ],
      data: Buffer.from([1, 2, 3, 4, 5]),
    }),
    createApproveInstruction(
      tokenAccount,
      delegate,
      payer.publicKey,
      BigInt("18446744073709551615"), // u64::MAX
    ),
  );

  return serializeUnsigned(tx);
}

/**
 * Public catalog. Used by the /api/fixtures route.
 */
export const FIXTURES = {
  safe: {
    title: "Safe — SOL transfer",
    description: "A routine SOL transfer. All programs recognized.",
    build: buildSafeFixture,
  },
  caution: {
    title: "Caution — unknown program",
    description: "Multiple calls into a program not on the allowlist.",
    build: buildCautionFixture,
  },
  danger: {
    title: "Danger — unlimited approval",
    description: "Approves UNLIMITED token authority to an unknown delegate.",
    build: buildDangerFixture,
  },
} as const;

export type FixtureId = keyof typeof FIXTURES;
