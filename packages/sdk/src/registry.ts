import {
  Connection,
  PublicKey,
  type GetProgramAccountsFilter,
} from "@solana/web3.js";
import bs58 from "bs58";

/**
 * Anchor account discriminators are sha256("account:<Name>")[0..8]. We
 * pre-compute them as constants instead of running `createHash` at module
 * load, which would require Node's `node:crypto` and break the SDK in
 * browser contexts (the extension service worker, in particular).
 *
 * To reproduce these values:
 *
 *   node -e 'const {createHash} = require("crypto");
 *     const d = name => Array.from(createHash("sha256").update("account:"+name).digest().subarray(0,8));
 *     console.log("Attestation:        ", d("Attestation"));
 *     console.log("Registry:           ", d("Registry"));
 *     console.log("VerifiedAttestation:", d("VerifiedAttestation"));'
 *
 * If you change an Anchor account name in programs/txguardian-registry/src/state.rs,
 * recompute the corresponding discriminator here.
 */
const ATTESTATION_DISCRIMINATOR = new Uint8Array([
  0x98, 0x7d, 0xb7, 0x56, 0x24, 0x92, 0x79, 0x49,
]);
const REGISTRY_DISCRIMINATOR = new Uint8Array([
  0x2f, 0xae, 0x6e, 0xf6, 0xb8, 0xb6, 0xfc, 0xda,
]);
const VERIFIED_DISCRIMINATOR = new Uint8Array([
  0x7d, 0xcb, 0x49, 0x44, 0xae, 0xfc, 0x9e, 0x16,
]);

// ─── Universal byte helpers (browser + Node, no Buffer dependency) ──────

/** Equality check for two byte sequences. Length-checked. */
function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/**
 * Construct a DataView positioned over the given Uint8Array. Uint8Array
 * doesn't have read*LE methods (those are Node Buffer extensions); DataView
 * is the universal answer.
 */
function viewOf(buf: Uint8Array): DataView {
  return new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
}

/** Read an unsigned little-endian 64-bit integer as a JS BigInt. */
function readBigUInt64LE(buf: Uint8Array, offset: number): bigint {
  return viewOf(buf).getBigUint64(offset, true);
}

/** Read a signed little-endian 64-bit integer as a JS BigInt. */
function readBigInt64LE(buf: Uint8Array, offset: number): bigint {
  return viewOf(buf).getBigInt64(offset, true);
}

/** Decode null-padded UTF-8 bytes into a JS string, stopping at the first NUL. */
function decodeNullPaddedUtf8(bytes: Uint8Array): string {
  const nullIndex = bytes.indexOf(0);
  const slice = nullIndex === -1 ? bytes : bytes.subarray(0, nullIndex);
  return new TextDecoder("utf-8").decode(slice);
}

/** Coerce arbitrary RPC return shape (Buffer | Uint8Array) into Uint8Array. */
function toUint8(data: ArrayBufferLike | Uint8Array | number[]): Uint8Array {
  if (data instanceof Uint8Array) return data;
  return new Uint8Array(data as ArrayBufferLike);
}

// ─── Drainer attestations ───────────────────────────────────────────────

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

function deserialize(
  data: ArrayBufferLike | Uint8Array | number[],
): OnChainAttestation | null {
  const buf = toUint8(data);
  if (buf.length !== ACCOUNT_SIZE) return null;
  if (!bytesEqual(buf.subarray(0, 8), ATTESTATION_DISCRIMINATOR)) return null;

  const targetProgram = new PublicKey(buf.subarray(8, 40)).toBase58();
  const severityByte = buf[40]!;
  if (severityByte < 1 || severityByte > 3) return null;
  const severity = severityByte as AttestationSeverity;

  const statusByte = buf[41]!;
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
  const createdAt = Number(readBigInt64LE(buf, 106));
  const updatedAt = Number(readBigInt64LE(buf, 114));
  const reason = decodeNullPaddedUtf8(buf.subarray(122, 186));

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
          bytes: bs58.encode(new Uint8Array([STATUS_CONFIRMED_BYTE])),
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
 * Clear in-memory caches for all fetch functions. Call after a fresh
 * submit/attest from the /registry page so the next read sees the change.
 */
export function invalidateAttestationCaches(): void {
  confirmedCache.clear();
  allCache.clear();
  verifiedConfirmedCache.clear();
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
    [new TextEncoder().encode("attestation"), targetProgram.toBuffer()],
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
    [new TextEncoder().encode("registry")],
    new PublicKey(programId),
  );
}

// ─── Registry singleton (admin + counters) ──────────────────────────────

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
    const buf = toUint8(info.data);
    if (!bytesEqual(buf.subarray(0, 8), REGISTRY_DISCRIMINATOR)) return null;
    const admin = new PublicKey(buf.subarray(8, 40)).toBase58();
    const submissionCount = Number(readBigUInt64LE(buf, 40));
    const confirmedCount = Number(readBigUInt64LE(buf, 48));
    return { admin, submissionCount, confirmedCount };
  } catch {
    return null;
  }
}

// ─── Verified-program attestations (positive feedback path) ─────────────
//
// Counterpart to the drainer attestations above. Same admin-curated
// lifecycle, different PDA seed prefix ("verified") and a different
// Anchor account type (VerifiedAttestation). Consumed by
// detectUnknownPrograms to suppress the UNKNOWN_PROGRAM flag for programs
// the community has positively reviewed.
//
// Becomes active once the on-chain program is redeployed with the
// VerifiedAttestation account type. Until then fetchVerifiedAttestations
// returns an empty array (no matching accounts on chain yet), which is
// safe — the rule simply doesn't suppress anything extra.

export interface VerifiedAttestation {
  /** Solana program positively attested as safe (base58). */
  targetProgram: string;
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
   * Free-form short note from the submitter (project name, audit ref).
   * UNTRUSTED — same handling as `OnChainAttestation.reason`.
   */
  note: string;
}

/**
 * On-chain layout from state.rs VerifiedAttestation:
 *   discriminator(8) | target_program(32) | status(1) | submitter(32) |
 *   attested_by(32) | created_at(8) | updated_at(8) | note(64) | bump(1)
 */
const VERIFIED_ACCOUNT_SIZE = 8 + 32 + 1 + 32 + 32 + 8 + 8 + 64 + 1; // 186
const VERIFIED_STATUS_OFFSET = 8 + 32; // 40

function deserializeVerified(
  data: ArrayBufferLike | Uint8Array | number[],
): VerifiedAttestation | null {
  const buf = toUint8(data);
  if (buf.length !== VERIFIED_ACCOUNT_SIZE) return null;
  if (!bytesEqual(buf.subarray(0, 8), VERIFIED_DISCRIMINATOR)) return null;

  const targetProgram = new PublicKey(buf.subarray(8, 40)).toBase58();
  const statusByte = buf[40]!;
  const status: AttestationStatus =
    statusByte === STATUS_PENDING_BYTE
      ? "pending"
      : statusByte === STATUS_CONFIRMED_BYTE
        ? "confirmed"
        : statusByte === STATUS_REVOKED_BYTE
          ? "revoked"
          : "pending";

  const submitter = new PublicKey(buf.subarray(41, 73)).toBase58();
  const attestedByRaw = new PublicKey(buf.subarray(73, 105)).toBase58();
  const createdAt = Number(readBigInt64LE(buf, 105));
  const updatedAt = Number(readBigInt64LE(buf, 113));
  const note = decodeNullPaddedUtf8(buf.subarray(121, 185));

  return {
    targetProgram,
    status,
    submitter,
    attestedBy: attestedByRaw === PENDING_PUBKEY_B58 ? null : attestedByRaw,
    submittedAt: createdAt,
    updatedAt,
    note,
  };
}

const verifiedConfirmedCache: Map<
  string,
  { value: VerifiedAttestation[]; expiry: number }
> = new Map();

function buildVerifiedBaseFilters(): GetProgramAccountsFilter[] {
  return [
    { dataSize: VERIFIED_ACCOUNT_SIZE },
    {
      memcmp: {
        offset: 0,
        bytes: bs58.encode(VERIFIED_DISCRIMINATOR),
      },
    },
  ];
}

/**
 * Fetch CONFIRMED verified-program attestations. Cached for 60s by RPC URL.
 * Best-effort: errors return an empty array (rule simply doesn't suppress
 * any extra programs). Returns empty until the on-chain program has been
 * redeployed with the VerifiedAttestation account type.
 */
export async function fetchVerifiedAttestations(
  connection: Connection,
  programId: string = TXGUARDIAN_REGISTRY_PROGRAM_ID,
): Promise<VerifiedAttestation[]> {
  const cacheKey = `${connection.rpcEndpoint}|${programId}`;
  const hit = verifiedConfirmedCache.get(cacheKey);
  if (hit && hit.expiry > Date.now()) return hit.value;

  try {
    const filters: GetProgramAccountsFilter[] = [
      ...buildVerifiedBaseFilters(),
      {
        memcmp: {
          offset: VERIFIED_STATUS_OFFSET,
          bytes: bs58.encode(new Uint8Array([STATUS_CONFIRMED_BYTE])),
        },
      },
    ];
    const accounts = await connection.getProgramAccounts(
      new PublicKey(programId),
      { filters },
    );
    const attestations = accounts
      .map(({ account }) => deserializeVerified(account.data))
      .filter((a): a is VerifiedAttestation => a !== null);

    verifiedConfirmedCache.set(cacheKey, {
      value: attestations,
      expiry: Date.now() + CACHE_TTL_MS,
    });
    return attestations;
  } catch {
    return [];
  }
}

/**
 * Derive the PDA where a VerifiedAttestation for a given target program
 * lives. Matches `seeds = [b"verified", target_program.as_ref()]` in
 * submit_verified.rs.
 */
export function deriveVerifiedAttestationPda(
  targetProgram: PublicKey,
  programId: string = TXGUARDIAN_REGISTRY_PROGRAM_ID,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [new TextEncoder().encode("verified"), targetProgram.toBuffer()],
    new PublicKey(programId),
  );
}
