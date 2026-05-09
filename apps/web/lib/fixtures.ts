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
 * Sample transaction builders. Server-side only.
 *
 * Two modes:
 *
 *   - **Analysis mode** (no `payer` / no `recentBlockhash`): deterministic
 *     mock-payer + placeholder blockhash. Cannot be signed by a real wallet
 *     but is identical across calls — used by the /scan "Try a sample"
 *     buttons when no wallet is connected.
 *
 *   - **Signable mode** (caller provides `payer` + `recentBlockhash`): the
 *     connected wallet's pubkey is the fee payer and the tx carries a fresh
 *     blockhash. The wallet can sign + submit it.
 *
 * Even in signable mode the samples NEVER refer to mainnet tokens; they call
 * mock programs / mock token accounts on devnet, so submission would fail at
 * the on-chain step. That's intentional — the demo proves the analyzer's
 * verdict was correct without doing actual harm.
 */

const PLACEHOLDER_BLOCKHASH = "11111111111111111111111111111111";

function deterministicKeypair(seedByte: number): Keypair {
  return Keypair.fromSeed(new Uint8Array(32).fill(seedByte));
}

function serializeUnsigned(tx: Transaction): string {
  return tx
    .serialize({ requireAllSignatures: false, verifySignatures: false })
    .toString("base64");
}

export interface BuildOptions {
  /** Override the fee payer (e.g. with a connected wallet's pubkey). */
  payer?: PublicKey;
  /** Recent blockhash from a live RPC. Required for signable transactions. */
  recentBlockhash?: string;
}

/**
 * SAFE — a routine SOL transfer with a compute budget instruction. All
 * programs are on the well-known allowlist.
 */
export function buildSafeFixture(opts: BuildOptions = {}): string {
  const payer = opts.payer ?? deterministicKeypair(1).publicKey;
  const dest = deterministicKeypair(2).publicKey;

  const tx = new Transaction({
    feePayer: payer,
    recentBlockhash: opts.recentBlockhash ?? PLACEHOLDER_BLOCKHASH,
  });
  tx.add(
    ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }),
    SystemProgram.transfer({
      fromPubkey: payer,
      toPubkey: dest,
      lamports: 100_000,
    }),
  );

  return serializeUnsigned(tx);
}

/**
 * CAUTION — multi-instruction transaction touching an unknown program.
 * Triggers UNKNOWN_PROGRAM and MULTI_INSTRUCTION_COMPLEXITY.
 */
export function buildCautionFixture(opts: BuildOptions = {}): string {
  const payer = opts.payer ?? deterministicKeypair(3).publicKey;
  const dest = deterministicKeypair(4).publicKey;
  const unknownProgram = deterministicKeypair(5).publicKey;

  const tx = new Transaction({
    feePayer: payer,
    recentBlockhash: opts.recentBlockhash ?? PLACEHOLDER_BLOCKHASH,
  });

  tx.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }));

  for (let i = 0; i < 5; i++) {
    tx.add(
      new TransactionInstruction({
        programId: unknownProgram,
        keys: [
          { pubkey: payer, isSigner: true, isWritable: true },
          { pubkey: dest, isSigner: false, isWritable: true },
        ],
        data: Buffer.from([i, 0, 0, 0]),
      }),
    );
  }

  return serializeUnsigned(tx);
}

/**
 * DANGER — SPL Token Approve with u64::MAX to a delegate, plus an unknown
 * program call and a high priority fee. Triggers FULL_TOKEN_APPROVAL,
 * UNKNOWN_PROGRAM, and UNUSUAL_FEE.
 */
export function buildDangerFixture(opts: BuildOptions = {}): string {
  const payer = opts.payer ?? deterministicKeypair(6).publicKey;
  const tokenAccount = deterministicKeypair(7).publicKey;
  const delegate = deterministicKeypair(8).publicKey;
  const unknownProgram = deterministicKeypair(9).publicKey;

  const tx = new Transaction({
    feePayer: payer,
    recentBlockhash: opts.recentBlockhash ?? PLACEHOLDER_BLOCKHASH,
  });

  tx.add(
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 5_000_000 }),
    new TransactionInstruction({
      programId: unknownProgram,
      keys: [{ pubkey: payer, isSigner: true, isWritable: true }],
      data: Buffer.from([1, 2, 3, 4, 5]),
    }),
    createApproveInstruction(
      tokenAccount,
      delegate,
      payer,
      BigInt("18446744073709551615"), // u64::MAX
    ),
  );

  return serializeUnsigned(tx);
}

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
