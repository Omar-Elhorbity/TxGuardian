import {
  Connection,
  PublicKey,
  type GetProgramAccountsFilter,
} from "@solana/web3.js";
import bs58 from "bs58";
import { createHash } from "node:crypto";

/**
 * Live devnet program id for the TxGuardian on-chain risk attestation
 * registry. Source: programs/txguardian-registry. Override via `programId`
 * arg if you've deployed your own copy.
 */
export const TXGUARDIAN_REGISTRY_PROGRAM_ID =
  "Dt6ccUKifBKegcxKGvgiHfyCDrJFeRwMmhvi7eCbFVS7";

export type AttestationStatus = "pending" | "confirmed" | "revoked";
export type AttestationSeverity = 1 | 2 | 3;

export interface OnChainAttestation {
  /** Solana program flagged by this attestation (base58). */
  targetProgram: string;
  /** 1 = low, 2 = medium, 3 = high. */
  severity: AttestationSeverity;
  /** Lifecycle status. */
  status: AttestationStatus;
  /** Submitter pubkey (base58). */
  submitter: string;
  /** Admin who confirmed or revoked. `null` while still pending. */
  attestedBy: string | null;
  /** Unix seconds. */
  submittedAt: number;
  /** Unix seconds at last status change. */
  updatedAt: number;
  /**
   * Free-form short reason text from the submitter. UNTRUSTED — do NOT
   * pass to any LLM verbatim and do NOT use as a key into any code path.
   * Surface in the UI with an "untrusted" label only.
   */
  reason: string;
}

/**
 * Anchor 0.30/0.32 default account discriminator: sha256("account:<Name>")[0..8].
 * Computed once at module load.
 */
const ATTESTATION_DISCRIMINATOR: Buffer = createHash("sha256")
  .update("account:Attestation")
  .digest()
  .subarray(0, 8);

/**
 * On-chain layout from programs/txguardian-registry/src/state.rs:
 *
 *   discriminator(8) | target_program(32) | severity(1) | status(1) |
 *   submitter(32) | attested_by(32) | created_at(8) | updated_at(8) |
 *   reason(64) | bump(1)
 */
const ACCOUNT_SIZE = 8 + 32 + 1 + 1 + 32 + 32 + 8 + 8 + 64 + 1; // 187
const STATUS_OFFSET = 8 + 32 + 1; // 41
const STATUS_PENDING_BYTE = 0;
const STATUS_CONFIRMED_BYTE = 1;
const STATUS_REVOKED_BYTE = 2;

const PENDING_PUBKEY_B58 = "11111111111111111111111111111111";

function deserialize(data: Buffer | Uint8Array): OnChainAttestation | null {
  const buf = Buffer.from(data);
  if (buf.length !== ACCOUNT_SIZE) return null;
  if (!buf.subarray(0, 8).equals(ATTESTATION_DISCRIMINATOR)) return null;

  const targetProgram = new PublicKey(buf.subarray(8, 40)).toBase58();
  const severityByte = buf.readUInt8(40);
  if (severityByte < 1 || severityByte > 3) return null;
  const severity = severityByte as AttestationSeverity;

  const statusByte = buf.readUInt8(41);
  const status: AttestationStatus =
    statusByte === STATUS_PENDING_BYTE
      ? "pending"
      : statusByte === STATUS_CONFIRMED_BYTE
        ? "confirmed"
        : statusByte === STATUS_REVOKED_BYTE
          ? "revoked"
          : "pending"; // unknown status defaults to pending (defensive)

  const submitter = new PublicKey(buf.subarray(42, 74)).toBase58();
  const attestedByRaw = new PublicKey(buf.subarray(74, 106)).toBase58();
  const createdAt = Number(buf.readBigInt64LE(106));
  const updatedAt = Number(buf.readBigInt64LE(114));

  // Reason is a fixed [u8; 64] null-padded utf-8 string.
  const reasonBytes = buf.subarray(122, 186);
  const nullIndex = reasonBytes.indexOf(0);
  const reason = (
    nullIndex === -1 ? reasonBytes : reasonBytes.subarray(0, nullIndex)
  ).toString("utf8");

  return {
    targetProgram,
    severity,
    status,
    submitter,
    attestedBy: attestedByRaw === PENDING_PUBKEY_B58 ? null : attestedByRaw,
    submittedAt: createdAt,
    updatedAt,
    reason,
  };
}

const CACHE_TTL_MS = 60_000;
const confirmedCache: Map<string, { value: OnChainAttestation[]; expiry: number }> =
  new Map();
const allCache: Map<string, { value: OnChainAttestation[]; expiry: number }> =
  new Map();

function buildBaseFilters(): GetProgramAccountsFilter[] {
  return [
    { dataSize: ACCOUNT_SIZE },
    {
      memcmp: {
        offset: 0,
        bytes: bs58.encode(ATTESTATION_DISCRIMINATOR),
      },
    },
  ];
}

/**
 * Fetch CONFIRMED attestations from the registry. Cached for 60s by RPC URL.
 *
 * Best-effort: any RPC error returns an empty array so the SDK's deterministic
 * verdict path stays unaffected. The drainer rule already has a hardcoded
 * fallback list — losing the on-chain feed degrades coverage, never correctness.
 */
export async function fetchConfirmedAttestations(
  connection: Connection,
  programId: string = TXGUARDIAN_REGISTRY_PROGRAM_ID,
): Promise<OnChainAttestation[]> {
  const cacheKey = `${connection.rpcEndpoint}|${programId}`;
  const hit = confirmedCache.get(cacheKey);
  if (hit && hit.expiry > Date.now()) return hit.value;

  try {
    const filters: GetProgramAccountsFilter[] = [
      ...buildBaseFilters(),
      {
        memcmp: {
          offset: STATUS_OFFSET,
          bytes: bs58.encode(Buffer.from([STATUS_CONFIRMED_BYTE])),
        },
      },
    ];
    const accounts = await connection.getProgramAccounts(
      new PublicKey(programId),
      { filters },
    );
    const attestations = accounts
      .map(({ account }) => deserialize(account.data))
      .filter((a): a is OnChainAttestation => a !== null);

    confirmedCache.set(cacheKey, {
      value: attestations,
      expiry: Date.now() + CACHE_TTL_MS,
    });
    return attestations;
  } catch {
    return [];
  }
}

/**
 * Fetch ALL attestations regardless of status (pending + confirmed + revoked).
 * Used by the /registry page; not by the rule engine. Cached separately.
 */
export async function fetchAllAttestations(
  connection: Connection,
  programId: string = TXGUARDIAN_REGISTRY_PROGRAM_ID,
): Promise<OnChainAttestation[]> {
  const cacheKey = `${connection.rpcEndpoint}|${programId}`;
  const hit = allCache.get(cacheKey);
  if (hit && hit.expiry > Date.now()) return hit.value;

  try {
    const accounts = await connection.getProgramAccounts(
      new PublicKey(programId),
      { filters: buildBaseFilters() },
    );
    const attestations = accounts
      .map(({ account }) => deserialize(account.data))
      .filter((a): a is OnChainAttestation => a !== null);

    allCache.set(cacheKey, {
      value: attestations,
      expiry: Date.now() + CACHE_TTL_MS,
    });
    return attestations;
  } catch {
    return [];
  }
}

/**
 * Clear in-memory caches for both fetch functions. Call after a fresh
 * submit/attest from the /registry page so the next read sees the change.
 */
export function invalidateAttestationCaches(): void {
  confirmedCache.clear();
  allCache.clear();
}

/**
 * Derive the PDA where an Attestation for a given target program lives.
 * Matches `seeds = [b"attestation", target_program.as_ref()]` in submit.rs.
 * Useful when constructing a Submit transaction client-side.
 */
export function deriveAttestationPda(
  targetProgram: PublicKey,
  programId: string = TXGUARDIAN_REGISTRY_PROGRAM_ID,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("attestation"), targetProgram.toBuffer()],
    new PublicKey(programId),
  );
}

/**
 * Derive the singleton Registry PDA.
 */
export function deriveRegistryPda(
  programId: string = TXGUARDIAN_REGISTRY_PROGRAM_ID,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("registry")],
    new PublicKey(programId),
  );
}

// --- Registry singleton (admin + counters) ----------------------------------

const REGISTRY_DISCRIMINATOR: Buffer = createHash("sha256")
  .update("account:Registry")
  .digest()
  .subarray(0, 8);

/**
 * On-chain layout: discriminator(8) | admin(32) | submission_count(8) |
 * confirmed_count(8) | bump(1) = 57 bytes.
 */
const REGISTRY_SIZE = 8 + 32 + 8 + 8 + 1; // 57

export interface RegistrySummary {
  /** Curator pubkey (base58). */
  admin: string;
  /** Total submissions ever received (monotonic). */
  submissionCount: number;
  /** Currently confirmed (non-revoked) attestations. */
  confirmedCount: number;
}

/**
 * Read the singleton Registry account. Returns null if not yet initialized,
 * or if RPC fails. Callers should treat null as "show the empty state."
 */
export async function fetchRegistry(
  connection: Connection,
  programId: string = TXGUARDIAN_REGISTRY_PROGRAM_ID,
): Promise<RegistrySummary | null> {
  try {
    const [pda] = deriveRegistryPda(programId);
    const info = await connection.getAccountInfo(pda);
    if (!info || info.data.length !== REGISTRY_SIZE) return null;
    const buf = Buffer.from(info.data);
    if (!buf.subarray(0, 8).equals(REGISTRY_DISCRIMINATOR)) return null;
    const admin = new PublicKey(buf.subarray(8, 40)).toBase58();
    const submissionCount = Number(buf.readBigUInt64LE(40));
    const confirmedCount = Number(buf.readBigUInt64LE(48));
    return { admin, submissionCount, confirmedCount };
  } catch {
    return null;
  }
}
