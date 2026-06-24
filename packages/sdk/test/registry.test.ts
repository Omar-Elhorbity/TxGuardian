/**
 * On-chain registry tests. Two things matter here:
 *   1. The byte-layout deserialize is correct (it parses attacker-submittable
 *      on-chain accounts — a desync would mislead the verdict). See SECURITY.md §3.
 *   2. Every fetch is best-effort: an RPC failure returns [] / null and never
 *      blocks the deterministic verdict.
 * Both are exercised with a mocked Connection (no network).
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import { Connection, PublicKey } from "@solana/web3.js";
import {
  fetchConfirmedAttestations,
  fetchAllAttestations,
  fetchVerifiedAttestations,
  fetchRegistry,
  invalidateAttestationCaches,
  deriveAttestationPda,
  deriveRegistryPda,
  deriveVerifiedAttestationPda,
} from "../src/registry";

const ATTESTATION_DISCRIMINATOR = [0x98, 0x7d, 0xb7, 0x56, 0x24, 0x92, 0x79, 0x49];
const REGISTRY_DISCRIMINATOR = [0x2f, 0xae, 0x6e, 0xf6, 0xb8, 0xb6, 0xfc, 0xda];
const VERIFIED_DISCRIMINATOR = [0x7d, 0xcb, 0x49, 0x44, 0xae, 0xfc, 0x9e, 0x16];

const TARGET = new PublicKey("So11111111111111111111111111111111111111112");
const SUBMITTER = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const ADMIN = new PublicKey("Dt6ccUKifBKegcxKGvgiHfyCDrJFeRwMmhvi7eCbFVS7");

/** Build the 187-byte Attestation account layout from state.rs. */
function buildAttestation(opts: { severity?: number; status?: number; reason?: string } = {}): Uint8Array {
  const { severity = 3, status = 1, reason = "phishing drainer" } = opts;
  const buf = new Uint8Array(187);
  buf.set(ATTESTATION_DISCRIMINATOR, 0);
  buf.set(TARGET.toBytes(), 8);
  buf[40] = severity;
  buf[41] = status;
  buf.set(SUBMITTER.toBytes(), 42);
  buf.set(ADMIN.toBytes(), 74); // attested_by
  const dv = new DataView(buf.buffer);
  dv.setBigInt64(106, 1_700_000_000n, true); // created_at
  dv.setBigInt64(114, 1_700_000_100n, true); // updated_at
  buf.set(new TextEncoder().encode(reason).subarray(0, 64), 122);
  buf[186] = 255; // bump
  return buf;
}

/** Build the 186-byte VerifiedAttestation account layout from state.rs. */
function buildVerified(opts: { status?: number; note?: string } = {}): Uint8Array {
  const { status = 1, note = "audited by example" } = opts;
  const buf = new Uint8Array(186);
  buf.set(VERIFIED_DISCRIMINATOR, 0);
  buf.set(TARGET.toBytes(), 8);
  buf[40] = status;
  buf.set(SUBMITTER.toBytes(), 41);
  buf.set(ADMIN.toBytes(), 73); // attested_by
  const dv = new DataView(buf.buffer);
  dv.setBigInt64(105, 1_700_000_000n, true);
  dv.setBigInt64(113, 1_700_000_100n, true);
  buf.set(new TextEncoder().encode(note).subarray(0, 64), 121);
  buf[185] = 254; // bump
  return buf;
}

function mockConn(
  rpcEndpoint: string,
  programAccounts: { account: { data: Uint8Array } }[] | Error,
): Connection {
  return {
    rpcEndpoint,
    getProgramAccounts: vi.fn(async () => {
      if (programAccounts instanceof Error) throw programAccounts;
      return programAccounts;
    }),
  } as unknown as Connection;
}

beforeEach(() => invalidateAttestationCaches());

describe("PDA derivation", () => {
  it("is deterministic and distinct per feed", () => {
    const [drainer] = deriveAttestationPda(TARGET);
    const [verified] = deriveVerifiedAttestationPda(TARGET);
    const [registry] = deriveRegistryPda();
    expect(drainer.toBase58()).toBe(deriveAttestationPda(TARGET)[0].toBase58());
    expect(drainer.toBase58()).not.toBe(verified.toBase58());
    expect(registry).toBeInstanceOf(PublicKey);
  });
});

describe("fetchConfirmedAttestations", () => {
  it("deserializes the on-chain byte layout faithfully", async () => {
    const conn = mockConn("https://rpc-a.test", [{ account: { data: buildAttestation() } }]);
    const res = await fetchConfirmedAttestations(conn);
    expect(res).toHaveLength(1);
    expect(res[0]!.targetProgram).toBe(TARGET.toBase58());
    expect(res[0]!.severity).toBe(3);
    expect(res[0]!.status).toBe("confirmed");
    expect(res[0]!.submitter).toBe(SUBMITTER.toBase58());
    expect(res[0]!.attestedBy).toBe(ADMIN.toBase58());
    expect(res[0]!.reason).toBe("phishing drainer");
  });

  it("returns [] when the RPC throws — never blocks the verdict", async () => {
    const conn = mockConn("https://rpc-b.test", new Error("RPC down"));
    expect(await fetchConfirmedAttestations(conn)).toEqual([]);
  });

  it("drops accounts whose byte length doesn't match the layout", async () => {
    const conn = mockConn("https://rpc-c.test", [{ account: { data: new Uint8Array(10) } }]);
    expect(await fetchConfirmedAttestations(conn)).toEqual([]);
  });

  it("caches by RPC endpoint (second call doesn't re-hit the RPC)", async () => {
    const conn = mockConn("https://rpc-d.test", [{ account: { data: buildAttestation() } }]);
    await fetchConfirmedAttestations(conn);
    await fetchConfirmedAttestations(conn);
    expect(conn.getProgramAccounts).toHaveBeenCalledTimes(1);
  });
});

describe("fetchAllAttestations", () => {
  it("returns attestations of any status (no confirmed filter)", async () => {
    const conn = mockConn("https://rpc-all.test", [
      { account: { data: buildAttestation({ status: 0 }) } }, // pending
    ]);
    const res = await fetchAllAttestations(conn);
    expect(res).toHaveLength(1);
    expect(res[0]!.status).toBe("pending");
  });
});

describe("fetchVerifiedAttestations", () => {
  it("deserializes the VerifiedAttestation layout", async () => {
    const conn = mockConn("https://rpc-v.test", [{ account: { data: buildVerified() } }]);
    const res = await fetchVerifiedAttestations(conn);
    expect(res).toHaveLength(1);
    expect(res[0]!.targetProgram).toBe(TARGET.toBase58());
    expect(res[0]!.status).toBe("confirmed");
    expect(res[0]!.note).toBe("audited by example");
  });

  it("returns [] on RPC error", async () => {
    const conn = mockConn("https://rpc-v2.test", new Error("boom"));
    expect(await fetchVerifiedAttestations(conn)).toEqual([]);
  });
});

describe("fetchRegistry", () => {
  it("reads the singleton registry account", async () => {
    const buf = new Uint8Array(57);
    buf.set(REGISTRY_DISCRIMINATOR, 0);
    buf.set(ADMIN.toBytes(), 8);
    const dv = new DataView(buf.buffer);
    dv.setBigUint64(40, 7n, true); // submission_count
    dv.setBigUint64(48, 5n, true); // confirmed_count
    const conn = {
      rpcEndpoint: "https://rpc-e.test",
      getAccountInfo: vi.fn(async () => ({ data: buf })),
    } as unknown as Connection;
    const reg = await fetchRegistry(conn);
    expect(reg).not.toBeNull();
    expect(reg!.admin).toBe(ADMIN.toBase58());
    expect(reg!.submissionCount).toBe(7);
    expect(reg!.confirmedCount).toBe(5);
  });

  it("returns null when the account is missing", async () => {
    const conn = {
      rpcEndpoint: "https://rpc-f.test",
      getAccountInfo: vi.fn(async () => null),
    } as unknown as Connection;
    expect(await fetchRegistry(conn)).toBeNull();
  });
});
