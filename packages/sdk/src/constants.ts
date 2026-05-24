/**
 * Well-known program IDs and a curated drainer blocklist.
 *
 * The KNOWN_PROGRAMS allowlist is the static fallback for "this program is
 * known-legitimate." Anything not on this list AND not on the on-chain
 * verified-attestation feed earns a LOW-severity UNKNOWN_PROGRAM flag.
 * Severity is intentionally low — the Solana ecosystem grows daily and a
 * static allowlist can't keep up. The flag is informational; it only
 * meaningfully affects the verdict when combined with other findings.
 * (Long-term home for new entries is the on-chain verified registry;
 * additions to this static list should still cite a public source.)
 *
 * The KNOWN_DRAINERS blocklist is sourced from public security disclosures.
 * It is intentionally short: the goal is high precision (no false positives),
 * not exhaustive coverage. Add entries with a citation in the trailing comment.
 */

export interface KnownProgram {
  name: string;
  /** Optional short description for UI surfaces. */
  description?: string;
}

/**
 * Allowlist of programs commonly used on Solana mainnet.
 * Keys are base58 program IDs; values are display metadata.
 */
export const KNOWN_PROGRAMS: Record<string, KnownProgram> = {
  // System & native
  "11111111111111111111111111111111": {
    name: "System Program",
    description: "Native account and lamport operations.",
  },
  "ComputeBudget111111111111111111111111111111": {
    name: "Compute Budget Program",
    description: "Sets compute units and priority fees.",
  },
  Stake11111111111111111111111111111111111111: {
    name: "Stake Program",
    description: "Delegated staking.",
  },
  Vote111111111111111111111111111111111111111: {
    name: "Vote Program",
    description: "Validator voting.",
  },
  "Memo1UhkJRfHyvLMcVucJwxXeuD728EqVDDwQDxFMNo": {
    name: "Memo Program (legacy)",
    description: "Attaches arbitrary memo to a transaction.",
  },
  MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr: {
    name: "Memo Program",
    description: "Attaches arbitrary memo to a transaction.",
  },

  // SPL Token + Token-2022
  TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA: {
    name: "SPL Token",
    description: "Classic SPL token program.",
  },
  TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb: {
    name: "Token-2022",
    description: "Token-2022 program with extensions.",
  },
  ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL: {
    name: "Associated Token Account",
    description: "Creates ATAs.",
  },

  // Major DeFi & NFT programs
  JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4: {
    name: "Jupiter Aggregator v6",
    description: "DEX aggregator.",
  },
  whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc: {
    name: "Orca Whirlpools",
    description: "Concentrated liquidity DEX.",
  },
  "9W959DqEETiGZocYWCQPaJ6sBmUzgfxXfqGeTEdp3aQP": {
    name: "Orca Aquafarm",
    description: "Orca farming.",
  },
  "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8": {
    name: "Raydium Liquidity Pool v4",
    description: "AMM pools.",
  },
  CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK: {
    name: "Raydium Concentrated Liquidity",
    description: "CLMM pools.",
  },
  MarBmsSgKXdrN1egZf5sqe1TMThczhMLJhAiqmJTAhh: {
    name: "Marinade Finance",
    description: "Liquid staking.",
  },
  dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH: {
    name: "Drift v2",
    description: "Perpetuals exchange.",
  },
  KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD: {
    name: "Kamino Lending",
    description: "Lending protocol.",
  },
  TSWAPaqyCSx2KABk68Shruf4rp7CxcNi8hAsbdwmHbN: {
    name: "Tensor",
    description: "NFT marketplace.",
  },
  M2mx93ekt1fmXSVkTrUL9xVFHkmME8HTUi5Cyc5aF7K: {
    name: "Magic Eden v2",
    description: "NFT marketplace.",
  },
  metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s: {
    name: "Metaplex Token Metadata",
    description: "NFT metadata standard.",
  },

  // ─── Expanded mainstream programs (added 2026-05) ────────────────────
  // Sourced from publicly documented program IDs on each protocol's docs
  // site or on Solscan's verified-program registry. Inclusion criterion:
  // significant mainnet usage + publicly auditable program ID. Add new
  // entries with a citation in the trailing comment.

  // DEX & swap
  PhoeNiXZ8ByJGLkxNfZRnkUfjvmuYqLR89jjFHGqdXY: {
    name: "Phoenix",
    description: "Order-book DEX.",
  }, // phoenix.trade/

  // Perps / margin / lending
  MFv2hWf31Z9kbCa1snEPYctwafyhdvnV7FZnsebVacA: {
    name: "Marginfi v2",
    description: "Lending / margin protocol.",
  }, // app.marginfi.com docs
  So1endDq2YkqhipRh3WViPa8hdiSpxWy6z3Z6tMCpAo: {
    name: "Solend",
    description: "Lending protocol.",
  }, // solend.fi docs

  // Liquid staking / stake pools
  Jito4APyf642JPZPx3hGc6WWJ8zPKtRbRs4P815Awbb: {
    name: "Jito Stake Pool",
    description: "JitoSOL liquid staking.",
  }, // jito.network docs
  SPoo1Ku8WFXoNDMHPsrGSTSG1Y47rzgn41SLUNakuHy: {
    name: "SPL Stake Pool",
    description: "Generic stake-pool program (Lido, others).",
  }, // github.com/solana-labs/solana-program-library/tree/master/stake-pool
  CrX7kMhLC3cSsXJdT7JDgqrRVWGnUpX3gfEfxxU2NVLi: {
    name: "Lido for Solana",
    description: "stSOL liquid staking.",
  }, // docs.solana.lido.fi/contracts/solido
  "5ocnV1qiCgaQR8Jb8xWnVbApfaygJ8tNoZfgPwsgx9kx": {
    name: "Sanctum LST router",
    description: "Liquid staking token routing.",
  }, // sanctum.so docs

  // Oracle infrastructure (appear in many composed transactions)
  FsJ3A3u2vn5cTVofAjvy6y5kwABJAqYWpe4975bi2epH: {
    name: "Pyth Oracle",
    description: "Price oracle network.",
  }, // pyth.network docs
  SW1TCH7qEPTdLsDHRgPuMQjbQxKdH2aBStViMFnt64f: {
    name: "Switchboard v2",
    description: "Decentralized oracle network.",
  }, // docs.switchboard.xyz

  // Cross-chain
  worm2ZoG2kUd4vFXhvjh93UUH596ayRfgQ2MgjNMTth: {
    name: "Wormhole Core Bridge",
    description: "Cross-chain messaging.",
  }, // wormhole.com docs
  wormDTUJ6AWPNvk59vGQbDvGJmqbDTdgWgAqcLBCgUb: {
    name: "Wormhole Token Bridge",
    description: "Cross-chain token transfers.",
  }, // wormhole.com docs

  // Jupiter ecosystem
  jupoNjAxXgZ4rjzxzPMP4oxduvQsQtZzyknqvzYNrNu: {
    name: "Jupiter Limit Order",
    description: "Limit orders on Jupiter.",
  }, // station.jup.ag/docs
  DCA265Vj8a9CEuX1eb1LWRnDT7uK6q1xMipnNyatn23M: {
    name: "Jupiter DCA",
    description: "Dollar-cost averaging on Jupiter.",
  }, // station.jup.ag/docs

  // NFT / cNFT
  BGUMAp9Gq7iTEuizy4pqaxsTyUCBK68MDfK752saRPUY: {
    name: "Metaplex Bubblegum",
    description: "Compressed NFT (cNFT) program.",
  }, // developers.metaplex.com/bubblegum
  CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d: {
    name: "Metaplex Core",
    description: "Lightweight next-gen NFT standard.",
  }, // developers.metaplex.com/core
  hausS13jsjafwWwGqZTUQRmWyvyxn9EQpqMwV1PBBmk: {
    name: "Metaplex Auction House",
    description: "Decentralized NFT marketplace primitive.",
  }, // developers.metaplex.com/auction-house

  // Account & data infrastructure
  cmtDvXumGCrqC1Age74AVPhSRVXJMd8PJS91L8KbNCK: {
    name: "SPL Account Compression",
    description: "Concurrent Merkle tree primitive (cNFTs depend on it).",
  }, // github.com/solana-labs/solana-program-library/tree/master/account-compression
  noopb9bkMVfRPU8AsbpTUg8AQkHtKwMYZiFUjNRtMmV: {
    name: "SPL Noop",
    description: "Logging primitive used by account-compression.",
  }, // github.com/solana-labs/solana-program-library/tree/master/account-compression/programs/noop

  // Address Lookup Tables — appear in any v0 transaction using ALTs
  AddressLookupTab1e1111111111111111111111111: {
    name: "Address Lookup Table",
    description: "Solana ALT program (referenced by v0 transactions).",
  }, // docs.solana.com/developing/lookup-tables
};

/**
 * Drainer blocklist. SHORT BY DESIGN — additions require a citation.
 *
 * This is the static fallback list. The primary feed lives on-chain in the
 * txguardian_registry program; that's where new entries should land. Hardcoded
 * additions here MUST source from a continuously updated, auditable feed
 * (Solana Foundation security disclosures, ScamSniffer, Blowfish public reports).
 *
 * Each entry MUST have:
 *   - `address`: base58 program id
 *   - `name`: short label for UI
 *   - `source`: where this came from (URL or report ID)
 *   - `addedAt`: ISO date
 */
export interface KnownDrainer {
  address: string;
  name: string;
  source: string;
  addedAt: string;
}

export const KNOWN_DRAINERS: KnownDrainer[] = [
  // Empty by design. The on-chain registry is the primary feed; this static
  // list exists only as a fallback for offline / failed-RPC scenarios. Adding
  // an address here without a verifiable public source is worse than nothing.
];

/**
 * Convenience lookup map for O(1) drainer checks.
 */
export const KNOWN_DRAINER_MAP: ReadonlyMap<string, KnownDrainer> = new Map(
  KNOWN_DRAINERS.map((d) => [d.address, d]),
);

// Token program IDs as constants (avoid string typos elsewhere in the codebase).
export const SPL_TOKEN_PROGRAM_ID = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
export const TOKEN_2022_PROGRAM_ID = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
export const COMPUTE_BUDGET_PROGRAM_ID = "ComputeBudget111111111111111111111111111111";
export const SYSTEM_PROGRAM_ID = "11111111111111111111111111111111";

export function isTokenProgram(programId: string): boolean {
  return programId === SPL_TOKEN_PROGRAM_ID || programId === TOKEN_2022_PROGRAM_ID;
}

export function isComputeBudgetProgram(programId: string): boolean {
  return programId === COMPUTE_BUDGET_PROGRAM_ID;
}

export function isKnownProgram(programId: string): boolean {
  return Object.prototype.hasOwnProperty.call(KNOWN_PROGRAMS, programId);
}

export function lookupProgramName(programId: string): string {
  return KNOWN_PROGRAMS[programId]?.name ?? "Unknown program";
}
